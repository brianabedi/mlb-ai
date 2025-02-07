// app/components/MainDatComponenets/PlayerRankings.tsx
"use client"
import React, { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Award, TrendingUp, Users, Plus, Minus } from "lucide-react"
import { createClient } from '@/utils/supabase/client'

interface PitchingStats {
  earnedRunAverage: string
  strikeouts: number
  wins: number
  losses: number
  saves: number
  inningsPitched: string
  whip: string
  strikeoutsPer9Inn: string
}

interface BattingStats {
  homeRuns: number
  battingAverage: string
  onBasePercentage: string
  slugging: string
  hits: number
  runsBattedIn: number
  stolenBases: number
  strikeouts: number
}

interface Player {
  id: number
  nameFirstLast: string
  currentTeam: {
    id: number;
    link: string;
    name: string;
    logo: string | null; 
  }
  battingStats?: BattingStats
  pitchingStats?: PitchingStats
  followers: number
}

export default function PlayerRankings() {
  const [players, setPlayers] = useState<Player[]>([])
  const [activeTab, setActiveTab] = useState('batting')
  const [sortBy, setSortBy] = useState<string>('homeRuns')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [followedPlayers, setFollowedPlayers] = useState<number[]>([])
  const [supabase] = useState(() => createClient())

  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        const response = await fetch('/api/players')
        if (!response.ok) {
          throw new Error('Failed to fetch player data')
        }
        const data = await response.json()
        console.log("sorted players here")
        console.log(data)
        setPlayers(data)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchPlayers()
  }, [])

  useEffect(() => {
    const fetchFollowedPlayers = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError) throw authError
        
        if (user) {
          const { data: follows, error: dbError } = await supabase
            .from('player_follows')
            .select('player_id')
            .eq('user_id', user.id)
          
          if (dbError) throw dbError
          if (follows) {
            setFollowedPlayers(follows.map(f => f.player_id))
          }
        }
      } catch (err) {
        console.error('Error fetching followed players:', err)
        setFollowedPlayers([])
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchFollowedPlayers()
      } else {
        setFollowedPlayers([])
      }
    })

    fetchFollowedPlayers()

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase])

  const handleFollowToggle = async (playerId: number) => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError) throw authError
      
      if (!user) {
        console.error('User must be logged in to follow players')
        return
      }

      if (followedPlayers.includes(playerId)) {
        // Optimistic update
        setFollowedPlayers(followedPlayers.filter(id => id !== playerId))
        
        const { error } = await supabase
          .from('player_follows')
          .delete()
          .eq('user_id', user.id)
          .eq('player_id', playerId)

        if (error) {
          // Revert on error
          setFollowedPlayers(prev => [...prev, playerId])
          throw error
        }
      } else {
        // Optimistic update
        setFollowedPlayers(prev => [...prev, playerId])
        
        const { error } = await supabase
          .from('player_follows')
          .insert([
            { user_id: user.id, player_id: playerId }
          ])
          .select()

        if (error) {
          // Revert on error
          setFollowedPlayers(prev => prev.filter(id => id !== playerId))
          throw error
        }
      }
    } catch (err) {
      console.error('Error toggling player follow:', err)
    }
  }

  const sortedPlayers = [...players].sort((a, b) => {
    switch (sortBy) {
      case 'followers':
        return b.followers - a.followers
      case 'homeRuns':
        return (b.battingStats?.homeRuns ?? 0) - (a.battingStats?.homeRuns ?? 0)
      case 'battingAverage':
        return parseFloat(b.battingStats?.battingAverage ?? '0') - parseFloat(a.battingStats?.battingAverage ?? '0')
      case 'era':
        return parseFloat(a.pitchingStats?.earnedRunAverage ?? '999') - parseFloat(b.pitchingStats?.earnedRunAverage ?? '999')
      case 'strikeouts':
        return (b.pitchingStats?.strikeouts ?? 0) - (a.pitchingStats?.strikeouts ?? 0)
      case 'wins':
        return (b.pitchingStats?.wins ?? 0) - (a.pitchingStats?.wins ?? 0)
      default:
        return 0
    }
  })

  return (
    <Card className="w-full  mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="h-6 w-6" />
          Player Rankings
        </CardTitle>
        <CardDescription>MLB players ranked by various statistics</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="batting" className="mb-4" onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="batting">Batting Stats</TabsTrigger>
            <TabsTrigger value="pitching">Pitching Stats</TabsTrigger>
          </TabsList>
          <TabsContent value="batting" className="space-y-4">
          <div className="flex flex-wrap gap-2 mb-2">
          <Button 
                variant={sortBy === 'homeRuns' ? 'default' : 'outline'}
                onClick={() => setSortBy('homeRuns')}
                className="flex items-center gap-2"
              >
                <TrendingUp className="h-4 w-4" />
                Home Runs
              </Button>

              <Button 
                variant={sortBy === 'battingAverage' ? 'default' : 'outline'}
                onClick={() => setSortBy('battingAverage')}
                className="flex items-center gap-2"
              >
                <TrendingUp className="h-4 w-4" />
                Batting Avg
              </Button>
              {/* <Button 
                variant={sortBy === 'followers' ? 'default' : 'outline'}
                onClick={() => setSortBy('followers')}
                className="flex items-center gap-2"
              >
                <Users className="h-4 w-4" />
                Followers
              </Button> */}
            </div>
          </TabsContent>
          <TabsContent value="pitching" className="space-y-4">
            <div className="flex gap-2">
              <Button 
                variant={sortBy === 'era' ? 'default' : 'outline'}
                onClick={() => setSortBy('era')}
                className="flex items-center gap-2"
              >
                <TrendingUp className="h-4 w-4" />
                ERA
              </Button>
              <Button 
                variant={sortBy === 'strikeouts' ? 'default' : 'outline'}
                onClick={() => setSortBy('strikeouts')}
                className="flex items-center gap-2"
              >
                <TrendingUp className="h-4 w-4" />
                Strikeouts
              </Button>
              <Button 
                variant={sortBy === 'wins' ? 'default' : 'outline'}
                onClick={() => setSortBy('wins')}
                className="flex items-center gap-2"
              >
                <TrendingUp className="h-4 w-4" />
                Wins
              </Button>
            </div>
          </TabsContent>
        </Tabs>
        
        {loading ? (
          <div className="text-center py-8">Loading player data...</div>
        ) : error ? (
          <div className="text-center py-8 text-red-500">{error}</div>
        ) : (
          <div className="max-h-[350px] overflow-y-auto"> {/* Added scrollable container */}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rank</TableHead>
                <TableHead>Player</TableHead>
                <TableHead>Team</TableHead>
                {activeTab === 'batting' ? (
                  <>
                    <TableHead className="text-right">HR</TableHead>
                    <TableHead className="text-right">AVG</TableHead>
                    <TableHead className="text-right">OBP</TableHead>
                    <TableHead className="text-right">SLG</TableHead>
                    <TableHead className="text-right">RBI</TableHead>
                  </>
                ) : (
                  <>
                    <TableHead className="text-right">ERA</TableHead>
                    <TableHead className="text-right">W-L</TableHead>
                    <TableHead className="text-right">IP</TableHead>
                    <TableHead className="text-right">WHIP</TableHead>
                    <TableHead className="text-right">K/9</TableHead>
                  </>
                )}
               <TableHead className="text-right">Follow</TableHead>

                {/* <TableHead className="text-right">Followers</TableHead> */}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedPlayers.slice(0, 25).map((player, index) => (
                <TableRow key={player.id}>
                  <TableCell className="font-medium">{index + 1}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8 relative">
                        <AvatarImage 
                          src={`https://securea.mlb.com/mlb/images/players/head_shot/${player.id}.jpg`} 
                          className="object-cover" 
                          alt={player.nameFirstLast} 
                        />
                        <AvatarFallback>
                          {player.nameFirstLast.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      {player.nameFirstLast}
                    </div>
                  </TableCell>
                  <div className="flex    justify-center ">

                   {player.currentTeam.logo ? (  
    <div className="h-6 w-6   "  >

       <img 
      src={player.currentTeam.logo} 
      alt={`${player.currentTeam.name} logo`}  
      className=" object-cover"  
    />
    </div>
   
  ) : (
    <Badge variant="secondary">{player.currentTeam.name}</Badge> // Fallback to name if no logo
  )}
  </div>
                  {activeTab === 'batting' ? (
                    <>
                      <TableCell className="text-right">{player.battingStats?.homeRuns ?? '-'}</TableCell>
                      <TableCell className="text-right">{player.battingStats?.battingAverage ?? '-'}</TableCell>
                      <TableCell className="text-right">{player.battingStats?.onBasePercentage ?? '-'}</TableCell>
                      <TableCell className="text-right">{player.battingStats?.slugging ?? '-'}</TableCell>
                      <TableCell className="text-right">{player.battingStats?.runsBattedIn ?? '-'}</TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell className="text-right">{player.pitchingStats?.earnedRunAverage ?? '-'}</TableCell>
                      <TableCell className="text-right">{`${player.pitchingStats?.wins ?? 0}-${player.pitchingStats?.losses ?? 0}`}</TableCell>
                      <TableCell className="text-right">{player.pitchingStats?.inningsPitched ?? '-'}</TableCell>
                      <TableCell className="text-right">{player.pitchingStats?.whip ?? '-'}</TableCell>
                      <TableCell className="text-right">{player.pitchingStats?.strikeoutsPer9Inn ?? '-'}</TableCell>
                    </>
                  )}
                  {/* <TableCell className="text-right">{player.followers.toLocaleString()}</TableCell> */}
                  <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleFollowToggle(player.id)}
                      >
                        {followedPlayers.includes(player.id) ? (
                          <Minus className="h-4 w-4 text-red-400" />
                        ) : (
                          <Plus className="h-4 w-4 text-blue-400" />
                        )}
                      </Button>
                    </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <p className="text-sm text-muted-foreground">
          Updated daily based on MLB statistics and social media metrics
        </p>
      </CardFooter>
    </Card>
  )
}