// app/api/game_predictions/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';


const logger = {
  info: (message: string, meta?: any) => {
    console.log(`[INFO] ${message}`, meta ? JSON.stringify(meta, null, 2) : '');
  },
  error: (message: string, error: any, meta?: any) => {
    console.error(`[ERROR] ${message}:`, error, meta ? JSON.stringify(meta, null, 2) : '');
  },
  warn: (message: string, meta?: any) => {
    console.warn(`[WARN] ${message}`, meta ? JSON.stringify(meta, null, 2) : '');
  },
  debug: (message: string, meta?: any) => {
    console.debug(`[DEBUG] ${message}`, meta ? JSON.stringify(meta, null, 2) : '');
  }
};


const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// const RETRY_AFTER = 60 * 1000; // 60 seconds
const TEAM_STATS_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours 

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
// async function checkRateLimit() {
//   const now = Date.now();
//   logger.debug('Checking rate limit');
//   try {
//     // Use Supabase as a rate limit store
//     const { data: rateLimitData, error } = await supabase
//       .from('rate_limits')
//       .select('last_call')
//       .single();

//     if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
//       logger.error('Rate limit check failed', error);

//       throw error;
//     }

//     if (rateLimitData && now - new Date(rateLimitData.last_call).getTime() < RETRY_AFTER) {
//       const waitTime = Math.ceil((RETRY_AFTER - (now - new Date(rateLimitData.last_call).getTime())) / 1000);
//       logger.warn(`Rate limit in effect`, { waitTime });
//       throw new Error(`Rate limit exceeded. Please wait ${waitTime} seconds.`);  }

//     // Update last call time
//     await supabase
//       .from('rate_limits')
//       .upsert({ id: 1, last_call: new Date().toISOString() });
//   } catch (error) {
//     logger.error('Rate limit check error', error);
//     throw error;
//   }
// }

const fetchWithTimeout = async (url: string, timeout = 5000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  logger.debug('Fetching URL with timeout', { url, timeout });

  try {
    const response = await fetch(url, {
      next: { revalidate: 60 }, // Cache for 60 seconds
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MLB Game Predictions Bot/1.0)'
      }
    });
    
    if (!response.ok) {
      logger.error('HTTP error in fetchWithTimeout', { status: response.status, url });

      throw new Error(`HTTP error! status: ${response.status}`);
    }
    logger.debug('Successfully fetched URL', { url });

    return response;
  }catch (error) {
    logger.error('Error in fetchWithTimeout', error, { url });
    throw error;
  }  finally {
    clearTimeout(timeoutId);
  }
};

async function getTeamStats(teamId: number) {
  logger.debug('Fetching team stats', { teamId });

  try {
    const { data: cachedStats, error: cacheError } = await supabase
      .from('team_stats_cache')
      .select('stats, timestamp')
      .eq('team_id', teamId)
      .single();

    if (!cacheError && cachedStats && 
        Date.now() - new Date(cachedStats.timestamp).getTime() < TEAM_STATS_CACHE_DURATION) {
      logger.debug('Using cached team stats', { teamId });
      return cachedStats.stats;
    }

    const response = await fetchWithTimeout(
      `https://statsapi.mlb.com/api/v1/teams/${teamId}/stats?stats=season&group=pitching,hitting`
    );
    const data = await response.json();
    
    logger.debug('Updating team stats cache', { teamId });
    await supabase
      .from('team_stats_cache')
      .upsert({
        team_id: teamId,
        stats: data.stats,
        timestamp: new Date().toISOString()
      });
    
    return data.stats;
  } catch (error) {
    logger.warn(`Could not fetch stats for team ${teamId}, using default stats`, { error });
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

async function generatePredictions(gamesWithStats: any[]) {
  logger.info('Generating predictions', { gameCount: gamesWithStats.length });
  // await checkRateLimit();

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
]`;

  let retryCount = 0;
  const MAX_RETRIES = 3;

  while (retryCount < MAX_RETRIES) {
    try {
      logger.debug('Attempting to generate prediction', { attempt: retryCount + 1 });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      logger.info('Successfully generated predictions');
      return response.text();
    } catch (error: any) {
      if (error.status === 429) {
        const waitTime = (2 ** retryCount) * 1000;
        logger.warn('Rate limit hit, retrying', { retryCount, waitTime });
        await new Promise(resolve => setTimeout(resolve, waitTime));
        retryCount++;
      } else {
        logger.error('Error generating predictions', error);
        throw error;
      }
    }
  }

  // logger.error('Rate limit reached after multiple retries');
  throw new Error('Rate limit reached after multiple retries.');
}

async function storePredictions(supabase: any, predictions: any[], gamesWithStats: any[]) {
  logger.info('Storing predictions', { 
    predictionCount: predictions.length,
    gameCount: gamesWithStats.length 
  });

  const predictionsToInsert = predictions.map(prediction => {
    const gameInfo = gamesWithStats.find(game => String(game.gamePk) === String(prediction.gamePk));
    if (!gameInfo) {
      logger.error('No matching game found for prediction', { prediction });
      throw new Error(`No matching game found for gamePk: ${prediction.gamePk}`);
    }

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

  try {
    const { error } = await supabase
      .from('game_predictions')
      .insert(predictionsToInsert);

    if (error) {
      logger.error('Error storing predictions in Supabase', error);
      throw error;
    }
    
    logger.info('Successfully stored predictions', { count: predictionsToInsert.length });
  } catch (error) {
    logger.error('Failed to store predictions', error);
    throw error;
  }
}

export async function GET(req: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  logger.info('Starting GET request', { requestId });
  const startTime = Date.now();
  try {
    // First check Supabase for any upcoming games in the next 10 days
    const currentDate = new Date();
    const futureDate = new Date();
    futureDate.setDate(currentDate.getDate() + 10);
    
    logger.debug('Checking Supabase for upcoming games', { 
      requestId,
      startDate: currentDate.toISOString(),
      endDate: futureDate.toISOString()
    });

    const { data: existingGames, error: gamesError } = await supabase
      .from('game_predictions')
      .select('*')
      .gte('game_date', currentDate.toISOString())
      .lte('game_date', futureDate.toISOString())
      .gt('expires_at', currentDate.toISOString())
      .order('game_date', { ascending: true });

    if (gamesError) {
      logger.error('Error fetching games from Supabase:', { requestId, error: gamesError });
      throw gamesError;
    }

    // If we found games in Supabase, use those instead of calling MLB API
    if (existingGames && existingGames.length > 0) {
      logger.info('Found existing games in Supabase', { 
        requestId, 
        gameCount: existingGames.length 
      });
      
      const formattedPredictions = existingGames.map(game => ({
        gamePk: game.game_pk,
        gameDate: game.game_date,
        homeTeam: {
          id: game.home_team_id,
          name: MLB_TEAMS[game.home_team_id]
        },
        awayTeam: {
          id: game.away_team_id,
          name: MLB_TEAMS[game.away_team_id]
        },
        predictedWinner: game.predicted_winner
      }));

      return NextResponse.json(formattedPredictions);
    }

    // If no games found in Supabase, proceed with MLB API calls
    logger.debug('No games found in Supabase, checking MLB API', { requestId });
    let nextGameDate = new Date();
    let upcomingGames = [];
    
    for (let i = 0; i <= 10; i++) {
      const checkDate = new Date();
      checkDate.setDate(checkDate.getDate() + i);
      const dateStr = checkDate.toISOString().split('T')[0];
      logger.debug('Checking MLB API for date', { requestId, date: dateStr });

      const response = await fetchWithTimeout(
        `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${dateStr}`
      );
      const data = await response.json();
      
      if (data.dates?.[0]?.games?.length > 0) {
        nextGameDate = checkDate;
        logger.info('Found games in MLB API', { 
          requestId, 
          date: dateStr, 
          gameCount: data.dates[0].games.length 
        });
        
        upcomingGames = await fetchGamesForDateRange(dateStr, 3);
        break;
      }
    }

    // Rest of the existing logic remains the same
    if (upcomingGames.length === 0) {
      logger.info('No upcoming games found', { requestId });
      return NextResponse.json([]);
    }

    const validGames = upcomingGames.filter(game => 
      MLB_TEAMS[game.teams.home.team.id] && 
      MLB_TEAMS[game.teams.away.team.id]
    );

    if (validGames.length === 0) {
      logger.info('No valid games found after filtering', { requestId });
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
          getTeamStats(game.teams.home.team.id),
          getTeamStats(game.teams.away.team.id)
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
      const newPrediction = newPredictions.find((p: { gamePk: any; }) => String(p.gamePk) === String(game.gamePk));
      
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

    logger.info(`Request completed`, { 
      requestId,
      duration: Date.now() - startTime,
      gameCount: allPredictions.length
    });
    return NextResponse.json(allPredictions);

  } catch (error: any) {
    logger.error('Error in game predictions:', { requestId, error });
    
    if (error.message?.includes('Rate limit')) {
      return new NextResponse('Too Many Requests', { status: 429 });
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch or generate predictions' }, 
      { status: 500 }
    );
  }
}