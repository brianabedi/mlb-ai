// app/api/game_predictions/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

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

interface GamePrediction {
  game_pk: string;
  game_date: string;
  home_team_id: number;
  away_team_id: number;
  predicted_winner: number;
  expires_at: string;
  home_team_stats?: any;
  away_team_stats?: any;
}
function fetchTeamName(teamId: number): string {
  return MLB_TEAMS[teamId] || `Team ${teamId}`;
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

async function fetchGamesForDateRange(startDate: string, days: number = 3) {
  const games = [];
  const fetchPromises = [];
  
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const formattedDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000))
      .toISOString()
      .split('T')[0];
    
    fetchPromises.push(
      fetchWithTimeout(
        `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${formattedDate}`
      )
      .then(response => response.json())
      .then(data => {
        if (data.dates?.[0]?.games) {
          return data.dates[0].games.map((game: any) => ({
            ...game,
            gameDate: formattedDate
          }));
        }
        return [];
      })
      .catch(error => {
        console.error(`Error fetching games for date ${formattedDate}:`, error);
        return [];
      })
    );
  }
  
  const results = await Promise.all(fetchPromises);
  return results.flat();
}

async function fetchTeamStats(teamId: number) {
  if (teamStatsCache.has(teamId) && 
      Date.now() - teamStatsCache.get(teamId)!.timestamp < TEAM_STATS_CACHE_DURATION) {
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
  
  if (now - lastApiCall < RETRY_AFTER) {
    throw new Error(`Please wait ${Math.ceil((RETRY_AFTER - (now - lastApiCall)) / 1000)} seconds before requesting new predictions`);
  }
  
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
        throw error;
      }
    }
  }

  throw new Error('Rate limit reached after multiple retries.');
}

async function storePredictions(supabase: any, predictions: any[], gamesWithStats: any[]) {
  const predictionsToInsert = predictions.map(prediction => {
    const gameInfo = gamesWithStats.find(game => String(game.gamePk) === String(prediction.gamePk));
    if (!gameInfo) {
      console.error(`No matching game found for prediction: ${JSON.stringify(prediction)}`);
      throw new Error(`No matching game found for gamePk: ${prediction.gamePk}`);
    }

    // Set expiration to 24 hours after the game date
    const gameDate = new Date(gameInfo.gameDate);
    const expiresAt = new Date(gameDate);
    expiresAt.setHours(expiresAt.getHours() + 24);

    return {
      game_pk: prediction.gamePk,
      game_date: gameInfo.gameDate,
      home_team_id: gameInfo.homeTeam.id,
      away_team_id: gameInfo.awayTeam.id,
      home_team_name: gameInfo.homeTeam.name,
      away_team_name: gameInfo.awayTeam.name,
      predicted_winner: prediction.predictedWinner,
      home_team_stats: gameInfo.homeTeam.stats,
      away_team_stats: gameInfo.awayTeam.stats,
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

export async function GET(req: NextRequest) {
  console.log('Starting GET request');
  const startTime = Date.now();

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Find games for the next few days
    console.log('Finding next date with games...');
    let nextGameDate = new Date();
    let upcomingGames = [];
    
    for (let i = 0; i <= 30; i++) {
      const checkDate = new Date();
      checkDate.setDate(checkDate.getDate() + i);
      const response = await fetchWithTimeout(
        `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${
          checkDate.toISOString().split('T')[0]
        }`
      );
      const data = await response.json();
      
      if (data.dates?.[0]?.games?.length > 0) {
        nextGameDate = checkDate;
        // Fetch 3 days worth of games starting from this date
        upcomingGames = await fetchGamesForDateRange(
          checkDate.toISOString().split('T')[0],
          3
        );
        break;
      }
    }

    if (upcomingGames.length === 0) {
      console.log('No upcoming games found');
      return NextResponse.json([]);
    }

    // Filter to valid MLB teams
    const validGames = upcomingGames.filter(game => 
      MLB_TEAMS[game.teams.home.team.id] && 
      MLB_TEAMS[game.teams.away.team.id]
    );

    if (validGames.length === 0) {
      console.log('No valid games found after filtering');
      return NextResponse.json([]);
    }

    // Get game IDs we need predictions for
    const requiredGameIds = validGames.map(game => game.gamePk);

    // Check for existing predictions that haven't expired
    const { data: existingPredictions, error: dbError } = await supabase
      .from('game_predictions')
      .select('*')
      .in('game_pk', requiredGameIds)
      .gt('expires_at', new Date().toISOString())
      .order('game_date', { ascending: true });

    if (dbError) {
      console.error('Error fetching predictions:', dbError);
      throw dbError;
    }

    // Process existing predictions
    const validPredictions: GamePrediction[] = existingPredictions || [];
    const predictionMap = new Map(validPredictions.map(pred => [pred.game_pk, pred]));
    
    // Find which games need new predictions
    const gamesNeedingPredictions = validGames.filter(game => {
      const existingPrediction = predictionMap.get(game.gamePk);
      return !existingPrediction; // Only get predictions for games we don't have
    });

    // If all games have valid predictions, return them
    if (gamesNeedingPredictions.length === 0) {
      const formattedPredictions = validGames.map(game => {
        const prediction = predictionMap.get(game.gamePk)!;
        return {
          gamePk: game.gamePk,
          gameDate: game.gameDate,
          homeTeam: {
            id: game.teams.home.team.id,
            name: MLB_TEAMS[game.teams.home.team.id]
          },
          awayTeam: {
            id: game.teams.away.team.id,
            name: MLB_TEAMS[game.teams.away.team.id]
          },
          predictedWinner: prediction.predicted_winner
        };
      });
      
      console.log(`Returning all cached predictions in ${Date.now() - startTime}ms`);
      return NextResponse.json(formattedPredictions);
    }

    console.log(`Generating predictions for ${gamesNeedingPredictions.length} games...`);

    // Generate predictions only for games that need them
    const gamesWithStats = await Promise.all(
      gamesNeedingPredictions.map(async (game) => {
        const [homeTeamStats, awayTeamStats] = await Promise.all([
          fetchTeamStats(game.teams.home.team.id),
          fetchTeamStats(game.teams.away.team.id)
        ]);
        
        return {
          gamePk: game.gamePk,
          gameDate: game.gameDate,
          homeTeam: {
            id: game.teams.home.team.id,
            name: MLB_TEAMS[game.teams.home.team.id],
            stats: homeTeamStats
          },
          awayTeam: {
            id: game.teams.away.team.id,
            name: MLB_TEAMS[game.teams.away.team.id],
            stats: awayTeamStats
          }
        };
      })
    );

    const predictionsText = await generatePredictions(gamesWithStats);
    const newPredictions = JSON.parse(predictionsText);
    
    // Store new predictions
    await storePredictions(supabase, newPredictions, gamesWithStats);

    // Combine existing and new predictions
    const allPredictions = validGames.map(game => {
      const existingPrediction = predictionMap.get(game.gamePk);
      const newPrediction = newPredictions.find(p => String(p.gamePk) === String(game.gamePk));
      
      const predictionToUse = existingPrediction || newPrediction;

      return {
        gamePk: game.gamePk,
        gameDate: game.gameDate,
        homeTeam: {
          id: game.teams.home.team.id,
          name: MLB_TEAMS[game.teams.home.team.id]
        },
        awayTeam: {
          id: game.teams.away.team.id,
          name: MLB_TEAMS[game.teams.away.team.id]
        },
        predictedWinner: predictionToUse.predictedWinner
      };
    });

    console.log(`Request completed in ${Date.now() - startTime}ms`);
    return NextResponse.json(allPredictions);

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