import { NextRequest, NextResponse } from 'next/server'

// Define proper interfaces
interface MLBPlayer {
  id: number
  nameFirstLast: string
  currentTeam: {
    name: string
  }
}

interface PlayerStats {
  stats?: Array<{
    splits?: Array<{
      stat?: {
        homeRuns?: number
        avg?: number
      }
    }>
  }>
}

interface FanData {
  followed_player_ids: number[]
}

interface ProcessedPlayer {
  id: number
  nameFirstLast: string
  currentTeam: {
    name: string
  }
  stats: {
    homeRuns: number
    battingAverage: number
  }
  followers: number
}

async function processEndpointUrl(url: string, options: RequestInit = {}) {
  const defaultOptions: RequestInit = {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    ...options
  }

  const response = await fetch(url, defaultOptions)
  
  // Check if the response is ok before parsing
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status} for URL: ${url}`)
  }

  // Check the content type header
  const contentType = response.headers.get('content-type')
  if (!contentType?.includes('application/json')) {
    console.error(`Unexpected content type: ${contentType} from ${url}`)
    // Try to parse anyway, some APIs return JSON with incorrect content type
    try {
      const text = await response.text()
      return JSON.parse(text)
    } catch (error) {
      throw new Error(`Expected JSON response but got ${contentType} from ${url}`)
    }
  }

  try {
    const data = await response.json()
    return data
  } catch (error) {
    console.error(`Error parsing JSON from ${url}:`, error)
    throw new Error(`Failed to parse JSON response from ${url}`)
  }
}

const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes in milliseconds
const cache = new Map<string, { data: any; timestamp: number }>()

const rateLimiter = {
  tokens: 25,
  lastRefill: Date.now(),
  interval: 1000,

  async take() {
    const now = Date.now()
    if (now - this.lastRefill >= this.interval) {
      this.tokens = 25
      this.lastRefill = now
    }

    if (this.tokens > 0) {
      this.tokens--
      return true
    }
    return false
  }
}

async function parseNewlineDelimitedJSON(response: Response): Promise<any[]> {
  const text = await response.text()
  const lines = text.trim().split('\n')
  const results = []
  
  for (const line of lines) {
    try {
      if (line.trim()) {
        results.push(JSON.parse(line))
      }
    } catch (error) {
      console.error('Error parsing JSON line:', line, error)
    }
  }
  
  return results
}

async function processEndpointUrlWithRetry<T>(url: string, options: RequestInit = {}, isNDJSON = false, retries = 3): Promise<T> {
  let lastError: Error | null = null
  
  for (let i = 0; i < retries; i++) {
    if (!await rateLimiter.take()) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      continue
    }

    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(5000)
      })
      
      if (response.status === 429) {
        console.log('Rate limit hit, waiting...')
        await new Promise(resolve => setTimeout(resolve, 1000))
        continue
      }
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status} for URL: ${url}`)
      }
      
      return isNDJSON ? await parseNewlineDelimitedJSON(response) : await response.json()
    } catch (error) {
      console.error(`Error fetching ${url}:`, error)
      lastError = error instanceof Error ? error : new Error(String(error))
      if (i === retries - 1) break
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)))
    }
  }
  throw lastError || new Error('All retries failed')
}

async function fetchPlayerStatsForBatch(playerIds: number[]): Promise<Map<number, ProcessedPlayer['stats']>> {
  const statsMap = new Map<number, ProcessedPlayer['stats']>()
  
  const statsPromises = playerIds.map(async (playerId) => {
    try {
      const statsData = await processEndpointUrlWithRetry<PlayerStats>(
        `https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=season&season=2024&group=hitting&sportId=1`
      )
      
      statsMap.set(playerId, {
        homeRuns: statsData.stats?.[0]?.splits?.[0]?.stat?.homeRuns ?? 0,
        battingAverage: statsData.stats?.[0]?.splits?.[0]?.stat?.avg ?? 0
      })
    } catch (error) {
      console.error(`Error fetching stats for player ${playerId}:`, error)
      statsMap.set(playerId, { homeRuns: 0, battingAverage: 0 })
    }
  })
  
  // Process in batches of 5 to respect rate limits
  for (let i = 0; i < statsPromises.length; i += 5) {
    const batch = statsPromises.slice(i, i + 5)
    await Promise.all(batch)
    if (i + 5 < statsPromises.length) {
      await new Promise(resolve => setTimeout(resolve, 200))
    }
  }
  
  return statsMap
}

export const revalidate = 300

export async function GET() {
  try {
    // Get base player data
    let playersData
    try {
      playersData = await processEndpointUrl(
        'https://statsapi.mlb.com/api/v1/sports/1/players?season=2024'
      )
      if (!playersData?.people) {
        throw new Error('Invalid player data format received')
      }
    } catch (error) {
      console.error('Error fetching base player data:', error)
      return NextResponse.json({ error: 'Failed to fetch base player data' }, { status: 500 })
    }

    // Get fan interaction data
    // Get fan interaction data
let fanData
try {
    fanData = await processEndpointUrl(
      'https://storage.googleapis.com/gcp-mlb-hackathon-2025/datasets/mlb-fan-content-interaction-data/2025-mlb-fan-favs-follows.json'
    )
  } catch (error) {
    console.error('Error fetching fan data:', error)
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      cause: error.cause
    })
    return NextResponse.json({ 
      error: 'Failed to fetch fan interaction data',
      details: error.message 
    }, { status: 500 })
  }

    // Process players and their stats
    const processedPlayers = await Promise.all(
      playersData.people.map(async (player: any) => {
        try {
          // Get both hitting and pitching stats
          const [battingStatsData, pitchingStatsData] = await Promise.all([
            processEndpointUrl(
              `https://statsapi.mlb.com/api/v1/people/${player.id}/stats?stats=season&season=2024&group=hitting`
            ),
            processEndpointUrl(
              `https://statsapi.mlb.com/api/v1/people/${player.id}/stats?stats=season&season=2024&group=pitching`
            )
          ])

          const battingStats = battingStatsData.stats?.[0]?.splits?.[0]?.stat
          const pitchingStats = pitchingStatsData.stats?.[0]?.splits?.[0]?.stat

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
            followers: fanData.find((f: any) => 
              f.followed_player_ids?.includes(player.id)
            )?.followed_player_ids?.length ?? 0
          }
        } catch (error) {
          console.error(`Error processing player ${player.id}:`, error)
          // Return a minimal valid player object if processing fails
          return {
            id: player.id,
            nameFirstLast: player.nameFirstLast,
            currentTeam: player.currentTeam,
            followers: 0
          }
        }
      })
    )

    return NextResponse.json(processedPlayers)
  } catch (error) {
    console.error('Error in GET handler:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}