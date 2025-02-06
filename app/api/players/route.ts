// app/api/players/route.ts
import { NextRequest, NextResponse } from 'next/server'

const BATCH_SIZE = 10
const MAX_RETRIES = 2
const RETRY_DELAY = 500 // ms
const CONCURRENT_REQUESTS = 3

async function fetchWithRetry(url: string, options: RequestInit = {}, retryCount = 0): Promise<Response> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    return response
  } catch (error) {
    if (retryCount >= MAX_RETRIES) {
      throw error
    }
    
    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
    return fetchWithRetry(url, options, retryCount + 1)
  }
}

async function fetchPlayerStats(playerId: number) {
  try {
    const [battingResponse, pitchingResponse] = await Promise.all([
      fetchWithRetry(
        `https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=season&season=2024&group=hitting`
      ),
      fetchWithRetry(
        `https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=season&season=2024&group=pitching`
      )
    ])

    const [battingStatsData, pitchingStatsData] = await Promise.all([
      battingResponse.json(),
      pitchingResponse.json()
    ])

    return { battingStatsData, pitchingStatsData }
  } catch (error) {
    console.error(`Error fetching stats for player ${playerId}:`, error)
    return { battingStatsData: null, pitchingStatsData: null }
  }
}

async function processBatch(players: any[]) {
  return Promise.all(
    players.map(async (player) => {
      try {
        const { battingStatsData, pitchingStatsData } = await fetchPlayerStats(player.id)
        
        const battingStats = battingStatsData?.stats?.[0]?.splits?.[0]?.stat
        const pitchingStats = pitchingStatsData?.stats?.[0]?.splits?.[0]?.stat
        
        return {
          id: player.id,
          nameFirstLast: player.nameFirstLast,
          currentTeam: player.currentTeam,
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
        }
      } catch (error) {
        console.error(`Error processing player ${player.id}:`, error)
        return {
          id: player.id,
          nameFirstLast: player.nameFirstLast,
          currentTeam: player.currentTeam,
          followers: 0
        }
      }
    })
  )
}

async function processAllPlayers(players: any[]) {
  const batches = []
  for (let i = 0; i < players.length; i += BATCH_SIZE) {
    batches.push(players.slice(i, i + BATCH_SIZE))
  }

  const results = []
  for (let i = 0; i < batches.length; i += CONCURRENT_REQUESTS) {
    const currentBatches = batches.slice(i, i + CONCURRENT_REQUESTS)
    const batchResults = await Promise.all(currentBatches.map(processBatch))
    results.push(...batchResults.flat())
  }

  return results
}

export const revalidate = 300

export async function GET() {
  try {
    // Get base player data
    let playersData
    try {
      const response = await fetchWithRetry(
        'https://statsapi.mlb.com/api/v1/sports/1/players?season=2024'
      )
      playersData = await response.json()
      
      if (!playersData?.people) {
        throw new Error('Invalid player data format received')
      }
    } catch (error) {
      console.error('Error fetching base player data:', error)
      return NextResponse.json({ error: 'Failed to fetch base player data' }, { status: 500 })
    }

    // Get fan interaction data
    let fanData = []
    try {
      const response = await fetchWithRetry(
        'https://storage.googleapis.com/gcp-mlb-hackathon-2025/datasets/mlb-fan-content-interaction-data/2025-mlb-fan-favs-follows.json'
      )
      
      const text = await response.text()
      const cleanText = text.replace(/^\uFEFF/, '').trim()
      
      try {
        fanData = JSON.parse(cleanText)
      } catch (jsonError) {
        fanData = cleanText
          .split('\n')
          .filter(line => line.trim())
          .map(line => JSON.parse(line))
      }
    } catch (error) {
      console.error('Error fetching fan data:', error)
    }

    // Process all players with optimized concurrency
    const processedPlayers = await processAllPlayers(playersData.people)

    // Update follower counts
    processedPlayers.forEach(player => {
      player.followers = fanData.reduce((count: number, entry: any) => {
        if (Array.isArray(entry?.followed_player_ids) && 
            entry.followed_player_ids.includes(player.id)) {
          return count + 1
        }
        return count
      }, 0)
    })

    return NextResponse.json(processedPlayers)
  } catch (error) {
    console.error('Error in GET handler:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}