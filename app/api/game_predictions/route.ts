// app/api/game_predictions/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { RateLimiterMemory } from 'rate-limiter-flexible';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Cache for predictions
const predictionsCache = new Map<string, { timestamp: number; prediction: any }>();
const teamStatsCache = new Map<number, { timestamp: number; stats: any[] }>();


const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
const TEAM_STATS_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const RETRY_AFTER = 60 * 1000; // 1 minute
let lastApiCall = 0;

// Rate Limiter
const limiter = new RateLimiterMemory({
    points: 10, // 10 requests
    duration: 60, // per 60 seconds
  });

const fetchWithTimeout = async (url: string, timeout = 5000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      next: { revalidate: 60 }, // Cache for 60 seconds
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MLB Game Predictions Bot/1.0)'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
};

async function findNextGameDate() {
  for (let i = 0; i < 30; i++) {
    try {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const formattedDate = date.toISOString().split('T')[0];
      
      const response = await fetchWithTimeout(
        `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${formattedDate}`
      );
      const data = await response.json();
      
      if (data.dates?.[0]?.games?.length > 0) {
        return formattedDate;
      }
    } catch (error) {
      console.error(`Error fetching games for date ${i} days ahead:`, error);
      continue;
    }
  }
  throw new Error('No upcoming games found in the next 30 days');
}

async function fetchGamesForDateRange(startDate: string, days: number = 2) {
  const games = [];
  
  for (let i = 0; i < days; i++) {
    try {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const formattedDate = date.toISOString().split('T')[0];
      
      const response = await fetchWithTimeout(
        `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${formattedDate}`
      );
      const data = await response.json();
      
      if (data.dates?.[0]?.games) {
        games.push(...data.dates[0].games.map((game: any) => ({
          ...game,
          gameDate: formattedDate
        })));
      }
    } catch (error) {
      console.error(`Error fetching games for date ${startDate} + ${i} days:`, error);
      continue;
    }
  }
  
  return games;
}

async function validateTeam(teamId: number) {
  try {
    const response = await fetchWithTimeout(
      `https://statsapi.mlb.com/api/v1/teams/${teamId}`
    );
    const data = await response.json();
    return data.teams && data.teams.length > 0;
  } catch (error) {
    console.warn(`Team validation failed for ID ${teamId}`);
    return false;
  }
}

async function fetchTeamStats(teamId: number) {
    if (teamStatsCache.has(teamId) && Date.now() - teamStatsCache.get(teamId)!.timestamp < TEAM_STATS_CACHE_DURATION) {
        return teamStatsCache.get(teamId)!.stats;
      }

  try {
    const response = await fetchWithTimeout(
      `https://statsapi.mlb.com/api/v1/teams/${teamId}/stats?stats=season&group=pitching,hitting`
    );
    const data = await response.json();
    teamStatsCache.set(teamId, { timestamp: Date.now(), stats: data.stats });
    return data.stats;
  } catch (error) {
    console.warn(`Could not fetch stats for team ${teamId}, using default stats`);
    return [
      {
        type: { displayName: "pitching" },
        splits: [{ stat: {} }]
      },
      {
        type: { displayName: "hitting" },
        splits: [{ stat: {} }]
      }
    ];
  }
}

async function generatePredictions(gamesWithStats: any[]) {
  const now = Date.now();
  
  // Check if we need to wait before making another API call
  if (now - lastApiCall < RETRY_AFTER) {
    throw new Error(`Please wait ${Math.ceil((RETRY_AFTER - (now - lastApiCall)) / 1000)} seconds before requesting new predictions`);
  }
  
  // Update last API call timestamp
  lastApiCall = now;

  const model = genAI.getGenerativeModel({ model: "gemini-pro" });
  const prompt = `You are a baseball analytics expert. Analyze these MLB games and predict the winners. 

Input Game Data:
${JSON.stringify(gamesWithStats, null, 2)}

IMPORTANT: Respond ONLY with a JSON array in the following exact format, with no additional text or explanation:
[
  {
    "gamePk": "game_pk_here",
    "predictedWinner": team_id_here
  }
]

Base your predictions on the team stats provided. Your response must be valid JSON that can be parsed with JSON.parse().`;

let retryCount = 0;
const MAX_RETRIES = 3;

while (retryCount < MAX_RETRIES) {
  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error: any) {
    if (error.status === 429) {
      const waitTime = (2 ** retryCount) * 1000;
      console.log(`Rate limit hit. Retrying in ${waitTime / 1000} seconds.`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      retryCount++;
    } else {
      throw error; // Re-throw other errors
    }
  }
}

throw new Error('Rate limit reached after multiple retries.'); // If max retries are exceeded
}

export async function GET(req: NextRequest) {
    try {
    const ip = req.headers.get('x-forwarded-for') || ''; 

    await limiter.consume(ip);

    const today = new Date().toISOString().split('T')[0];
    let startDate = today;
    let games = await fetchGamesForDateRange(today);

    if (games.length === 0) {
      startDate = await findNextGameDate();
      games = await fetchGamesForDateRange(startDate);
    }

    
    if (!games.length) {
      return NextResponse.json(
        { error: 'No games scheduled for the specified period' },
        { status: 404 }
      );
    }

    // Filter games to only include those with valid teams
    const validGames = [];
    for (const game of games) {
      const homeTeamValid = await validateTeam(game.teams.home.team.id);
      const awayTeamValid = await validateTeam(game.teams.away.team.id);
      
      if (homeTeamValid && awayTeamValid) {
        validGames.push(game);
      } else {
        console.warn(`Skipping game ${game.gamePk} due to invalid team(s)`);
      }
    }

    if (validGames.length === 0) {
      return NextResponse.json(
        { error: 'No valid games found with active teams' },
        { status: 404 }
      );
    }

    // For each valid game, fetch team stats
    const gamesWithStats = await Promise.all(
      validGames.map(async (game: any) => {
        const homeTeamStats = await fetchTeamStats(game.teams.home.team.id);
        const awayTeamStats = await fetchTeamStats(game.teams.away.team.id);
        
        return {
          gamePk: game.gamePk,
          gameDate: game.gameDate,
          homeTeam: {
            id: game.teams.home.team.id,
            name: game.teams.home.team.name,
            stats: homeTeamStats
          },
          awayTeam: {
            id: game.teams.away.team.id,
            name: game.teams.away.team.name,
            stats: awayTeamStats
          }
        };
      })
    );

    let predictionsText;
    try {
      predictionsText = await generatePredictions(gamesWithStats);
    } catch (error: any) {
      if (error.message.includes('Rate limit')) {
        return NextResponse.json(
          { error: error.message },
          {
            status: 429,
            headers: {
              'Retry-After': '60' // You might want to adjust this based on your retry logic
            }
          }
        );
      }
      throw error;
    }

    // Try to extract JSON from the response
    let predictions;
    try {
      predictions = JSON.parse(predictionsText);
    } catch (e) {
      const jsonMatch = predictionsText.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (jsonMatch) {
        predictions = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No valid JSON array found in response');
      }
    }
    
    // Validate the predictions format
    if (!Array.isArray(predictions) || !predictions.every(p => p.gamePk && p.predictedWinner)) {
      return NextResponse.json(
        { error: 'Invalid prediction format' },
        { status: 400 }
      );
    }

    // Combine predictions with team information
    const combinedPredictions = predictions.map(prediction => {
      const gameInfo = gamesWithStats.find(game => game.gamePk === prediction.gamePk);
      if (!gameInfo) return null;

      return {
        gamePk: prediction.gamePk,
        gameDate: gameInfo.gameDate,
        homeTeam: {
          id: gameInfo.homeTeam.id,
          name: gameInfo.homeTeam.name
        },
        awayTeam: {
          id: gameInfo.awayTeam.id,
          name: gameInfo.awayTeam.name
        },
        predictedWinner: prediction.predictedWinner
      };
    }).filter(Boolean);

    if (combinedPredictions.length === 0) {
      return NextResponse.json(
        { error: 'Failed to match predictions with game information' },
        { status: 400 }
      );
    }

    combinedPredictions.forEach(prediction => {
        predictionsCache.set(prediction.gamePk, { timestamp: Date.now(), prediction });
    });


    return NextResponse.json(combinedPredictions);
  } catch (rej: any) { 
    if (rej instanceof Error) {
        console.error("Rate limit error:", rej)
    }
    return new NextResponse('Too Many Requests', { status: 429 });
  }
}