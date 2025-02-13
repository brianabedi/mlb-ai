// app/api/game_predictions/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js'

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');


const RETRY_AFTER = 60 * 1000; // 1 minute
let lastApiCall = 0;

const TEAM_STATS_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const teamStatsCache = new Map<number, { timestamp: number; stats: any[] }>();


const MLB_TEAMS: { [key: number]: string } = {
  108: 'Los Angeles Angels',
  109: 'Arizona Diamondbacks',
  110: 'Baltimore Orioles',
  111: 'Boston Red Sox',
  112: 'Chicago Cubs',
  113: 'Cincinnati Reds',
  114: 'Cleveland Guardians',
  115: 'Colorado Rockies',
  116: 'Detroit Tigers',
  117: 'Houston Astros',
  118: 'Kansas City Royals',
  119: 'Los Angeles Dodgers',
  120: 'Washington Nationals',
  121: 'New York Mets',
  133: 'Oakland Athletics',
  134: 'Pittsburgh Pirates',
  135: 'San Diego Padres',
  136: 'Seattle Mariners',
  137: 'San Francisco Giants',
  138: 'St. Louis Cardinals',
  139: 'Tampa Bay Rays',
  140: 'Texas Rangers',
  141: 'Toronto Blue Jays',
  142: 'Minnesota Twins',
  143: 'Philadelphia Phillies',
  144: 'Atlanta Braves',
  145: 'Chicago White Sox',
  146: 'Miami Marlins',
  147: 'New York Yankees',
  158: 'Milwaukee Brewers'
};

function fetchTeamName(teamId: number): string {
  return MLB_TEAMS[teamId] || `Team ${teamId}`;
}

  async function storePredictions(supabase: any, predictions: any[], gamesWithStats: any[]) {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  
    const predictionsToInsert = predictions.map(prediction => {
      const gameInfo = gamesWithStats.find(game => String(game.gamePk) === String(prediction.gamePk));
      if (!gameInfo) {
        console.error(`No matching game found for prediction: ${JSON.stringify(prediction)}`);
        throw new Error(`No matching game found for gamePk: ${prediction.gamePk}`);
      }
      return {
        game_pk: prediction.gamePk,
        game_date: gameInfo.gameDate,
        home_team_id: gameInfo.homeTeam.id,
        away_team_id: gameInfo.awayTeam.id,
        predicted_winner: prediction.predictedWinner,
        expires_at: expiresAt.toISOString()
      };
    });
  
    const { error } = await supabase
      .from('game_predictions')
      .insert(predictionsToInsert);
  
    if (error) {
      console.error('Error storing predictions in Supabase:', error);
      throw error;
    }
  }

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
      const formattedDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000))
      .toISOString()
      .split('T')[0];      
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

async function fetchGamesForDateRange(startDate: string, days: number = 3) {
  const games = [];
  
  for (let i = 0; i < days; i++) {
    try {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const formattedDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000))
      .toISOString()
      .split('T')[0];
      
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
  console.log('Starting GET request');

  try {

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Query existing predictions
    const { data: existingPredictions, error: dbError } = await supabase
    .from('game_predictions')
    .select('*')
    .gte('game_date', now.toISOString().split('T')[0])
    .lte('game_date', thirtyDaysFromNow.toISOString().split('T')[0])
    .gt('expires_at', now.toISOString())
    .order('game_date', { ascending: true });

  if (dbError) {
    console.error('Error fetching predictions:', dbError);
    throw dbError;
  }

       // If we have valid predictions, return them
       if (existingPredictions && existingPredictions.length > 0) {
        const formattedPredictions = existingPredictions.map((pred) => ({
          gamePk: pred.game_pk,
          gameDate: pred.game_date,
          homeTeam: {
            id: pred.home_team_id,
            name: fetchTeamName(pred.home_team_id)
          },
          awayTeam: {
            id: pred.away_team_id,
            name: fetchTeamName(pred.away_team_id)
          },
          predictedWinner: pred.predicted_winner
        }));
        
        return NextResponse.json(formattedPredictions);
      }
  
      // If no predictions exist, fetch new games and generate predictions
      console.log('No existing predictions found, fetching new games...');
      let games = await fetchGamesForDateRange(now.toISOString().split('T')[0]);
      
      if (games.length === 0) {
        console.log('No games found for current date, looking for next game date...');
        const nextGameDate = await findNextGameDate();
        games = await fetchGamesForDateRange(nextGameDate);
      }
  
      if (games.length === 0) {
        console.log('No upcoming games found');
        return NextResponse.json([]);
      }
  
      // Filter games to only include those with valid teams
      console.log('Validating teams for games...');
      const validGames = [];
      for (const game of games) {
        const homeTeamValid = await validateTeam(game.teams.home.team.id);
        const awayTeamValid = await validateTeam(game.teams.away.team.id);
        
        if (homeTeamValid && awayTeamValid) {
          validGames.push(game);
        }
      }
  
      if (validGames.length === 0) {
        console.log('No valid games found after team validation');
        return NextResponse.json([]);
      }
  
      // Fetch stats and generate predictions for new games
      console.log('Fetching team stats and generating predictions...');
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
  
      // Generate new predictions
      const predictionsText = await generatePredictions(gamesWithStats);
      const predictions = JSON.parse(predictionsText);
      
      // Store new predictions
      await storePredictions(supabase, predictions, gamesWithStats);
  
      // Format and return the new predictions
      const formattedPredictions = predictions.map((prediction: any) => {
        const gameInfo = gamesWithStats.find(
          game => String(game.gamePk) === String(prediction.gamePk)
        );
  
        if (!gameInfo) {
          console.error(`No matching game found for prediction: ${JSON.stringify(prediction)}`);
          return null;
        }
  
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
  
      return NextResponse.json(formattedPredictions);
  
    } catch (error: any) {
      console.error('Error in game predictions:', error);
      
      if (error.message?.includes('Rate limit')) {
        return new NextResponse('Too Many Requests', { status: 429 });
      }
      
      return NextResponse.json(
        { error: 'Failed to fetch or generate predictions' }, 
        { status: 500 }
      );
    }
  }