// app/api/players/route.ts
import { NextRequest, NextResponse } from 'next/server'

// Optimize constants for better performance
const BATCH_SIZE = 25
const MAX_RETRIES = 2
const RETRY_DELAY = 500
const CONCURRENT_REQUESTS = 5
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes
const STALE_WHILE_REVALIDATE_DURATION = 30 * 60 * 1000 // 30 minutes

interface CacheEntry {
  timestamp: number;
  data: any[];
  isRevalidating?: boolean;
}

// Implement request deduplication
const pendingRequests: Map<string, Promise<any>> = new Map();

// Improved cache with memory efficiency
let cache: CacheEntry = { timestamp: 0, data: [] };

// Implement request deduplication with cache
async function fetchWithCache(url: string, options: RequestInit = {}): Promise<Response> {
  const cacheKey = url;
  
  // Return existing pending request if one exists
  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey)!;
  }

  const fetchPromise = fetchWithRetry(url, options).finally(() => {
    pendingRequests.delete(cacheKey);
  });
  
  pendingRequests.set(cacheKey, fetchPromise);
  return fetchPromise;
}

async function fetchWithRetry(url: string, options: RequestInit = {}, retryCount = 0): Promise<Response> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response;
  } catch (error) {
    if (retryCount >= MAX_RETRIES) {
      throw error;
    }
    
    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1))); // Exponential backoff
    return fetchWithRetry(url, options, retryCount + 1);
  }
}

// Optimize player stats fetching with parallel requests and error handling
async function fetchPlayerStats(playerId: number, currentTeamLink: string) {
  const urls = [
    `https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=season&season=2024&group=hitting`,
    `https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=season&season=2024&group=pitching`,
    `https://statsapi.mlb.com${currentTeamLink}`
  ];

  try {
    const responses = await Promise.all(
      urls.map(url => fetchWithCache(url))
    );

    const [battingStatsData, pitchingStatsData, teamData] = await Promise.all(
      responses.map(response => response.json())
    );

    return { battingStatsData, pitchingStatsData, teamData };
  } catch (error) {
    console.error(`Error fetching stats for player ${playerId}:`, error);
    return { battingStatsData: null, pitchingStatsData: null, teamData: null };
  }
}

// Optimize batch processing with improved error handling and typing
async function processBatch(players: any[]) {
  return Promise.all(
    players.map(async (player) => {
      try {
        const { battingStatsData, pitchingStatsData } = await fetchPlayerStats(
          player.id,
          player.currentTeam.link
        );

        const battingStats = battingStatsData?.stats?.[0]?.splits?.[0]?.stat;
        const pitchingStats = pitchingStatsData?.stats?.[0]?.splits?.[0]?.stat;
        
        // Precompute team logo URL
        const logoUrl = `https://www.mlbstatic.com/team-logos/${player.currentTeam.id}.svg`;

        return {
          id: player.id,
          nameFirstLast: player.nameFirstLast,
          currentTeam: {
            id: player.currentTeam.id,
            link: player.currentTeam.link,
            name: player.currentTeam.name,
            logo: logoUrl
          },
          battingStats: battingStats ? {
            homeRuns: battingStats.homeRuns,
            battingAverage: battingStats.avg,
            onBasePercentage: battingStats.obp,
            slugging: battingStats.slg,
            hits: battingStats.hits,
            runsBattedIn: battingStats.rbi,
            stolenBases: battingStats.stolenBases,
            strikeouts: battingStats.strikeouts
          } : undefined,
          pitchingStats: pitchingStats ? {
            earnedRunAverage: pitchingStats.era,
            strikeouts: pitchingStats.strikeouts,
            wins: pitchingStats.wins,
            losses: pitchingStats.losses,
            saves: pitchingStats.saves,
            inningsPitched: pitchingStats.inningsPitched,
            whip: pitchingStats.whip,
            strikeoutsPer9Inn: pitchingStats.strikeoutsPer9Inn
          } : undefined,
          followers: 0
        };
      } catch (error) {
        console.error(`Error processing player ${player.id}:`, error);
        return null;
      }
    })
  ).then(results => results.filter(Boolean)); // Remove failed entries
}

// Optimize concurrent processing
async function processAllPlayers(players: any[]) {
  const batches = [];
  for (let i = 0; i < players.length; i += BATCH_SIZE) {
    batches.push(players.slice(i, i + BATCH_SIZE));
  }

  const results = [];
  for (let i = 0; i < batches.length; i += CONCURRENT_REQUESTS) {
    const currentBatches = batches.slice(i, i + CONCURRENT_REQUESTS);
    const batchResults = await Promise.all(currentBatches.map(processBatch));
    results.push(...batchResults.flat());
  }

  return results;
}

// Optimize fan data fetching and processing
async function fetchFanData() {
  try {
    const response = await fetchWithCache(
      'https://storage.googleapis.com/gcp-mlb-hackathon-2025/datasets/mlb-fan-content-interaction-data/2025-mlb-fan-favs-follows.json'
    );
    
    const text = await response.text();
    const cleanText = text.replace(/^\uFEFF/, '').trim();
    
    try {
      return JSON.parse(cleanText);
    } catch (jsonError) {
      return cleanText
        .split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line));
    }
  } catch (error) {
    console.error('Error fetching fan data:', error);
    return [];
  }
}

async function fetchAndProcessPlayers() {
  // Fetch player and fan data in parallel
  const [playersResponse, fanData] = await Promise.all([
    fetchWithCache('https://statsapi.mlb.com/api/v1/sports/1/players?season=2024'),
    fetchFanData()
  ]);

  const playersData = await playersResponse.json();
  
  if (!playersData?.people) {
    throw new Error('Invalid player data format received');
  }

  // Process players
  const processedPlayers = await processAllPlayers(playersData.people);

  // Update follower counts efficiently
  const followerCounts = new Map();
  fanData.forEach((entry: any) => {
    if (Array.isArray(entry?.followed_player_ids)) {
      entry.followed_player_ids.forEach((playerId: number) => {
        followerCounts.set(playerId, (followerCounts.get(playerId) || 0) + 1);
      });
    }
  });

  // Apply follower counts
  processedPlayers.forEach(player => {
    player.followers = followerCounts.get(player.id) || 0;
  });

  return processedPlayers;
}

// Optimized cache management
async function getPlayersWithCache() {
  const now = Date.now();

  if (now - cache.timestamp < CACHE_DURATION) {
    return cache.data;
  }

  if (now - cache.timestamp < STALE_WHILE_REVALIDATE_DURATION && !cache.isRevalidating) {
    cache.isRevalidating = true;
    fetchAndProcessPlayers()
      .then(newData => {
        cache = { timestamp: Date.now(), data: newData, isRevalidating: false };
      })
      .catch(error => {
        console.error('Background revalidation failed:', error);
        cache.isRevalidating = false;
      });
    return cache.data;
  }

  const newData = await fetchAndProcessPlayers();
  cache = { timestamp: now, data: newData };
  return newData;
}

export const revalidate = 300;

export async function GET() {
  try {
    const players = await getPlayersWithCache();
    return NextResponse.json(players);
  } catch (error) {
    console.error('Error in GET handler:', error);

    if (cache.data.length > 0) {
      console.log('Returning stale cache due to error');
      return NextResponse.json(cache.data);
    }

    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}