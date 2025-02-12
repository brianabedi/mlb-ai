// app/components/MainDatComponenets/PlayerRankings.tsx
"use client"
import React, { useState, useEffect, useCallback } from 'react'
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
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
import FollowEventManager from '@/utils/followEventManager';

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
  const [showLoginDialog, setShowLoginDialog] = useState(false)
  const [isAuthChecking, setIsAuthChecking] = useState(true)

  const fetchPlayers = useCallback(async () => {
    try {
      const response = await fetch('/api/players');
      if (!response.ok) {
        throw new Error('Failed to fetch player data');
      }
      const data = await response.json();
      setPlayers(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFollowedPlayers = useCallback(async () => {
    try {
      setIsAuthChecking(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        const { data: follows, error: dbError } = await supabase
          .from('player_follows')
          .select('player_id')
          .eq('user_id', session.user.id);
        
        if (dbError) throw dbError;
        if (follows) {
          setFollowedPlayers(follows.map(f => f.player_id));
        }
      } else {
        setFollowedPlayers([]);
      }
    } catch (err) {
      console.error('Error fetching followed players:', err);
      setFollowedPlayers([]);
    } finally {
      setIsAuthChecking(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchFollowedPlayers();
      } else {
        setFollowedPlayers([]);
      }
    });

    fetchFollowedPlayers();

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, fetchFollowedPlayers]);

  useEffect(() => {
    const unsubscribe = FollowEventManager.subscribe(() => {
      fetchFollowedPlayers();
    });
  
    return () => {
      unsubscribe();
    };
  }, [fetchFollowedPlayers]);
  
  const handleFollowToggle = async (playerId: number) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setShowLoginDialog(true);
        return;
      }

      if (followedPlayers.includes(playerId)) {
        // Optimistically update UI
        setFollowedPlayers(followedPlayers.filter(id => id !== playerId));
        
        const { error } = await supabase
          .from('player_follows')
          .delete()
          .eq('user_id', session.user.id)
          .eq('player_id', playerId);

        if (error) {
          // Revert on error
          setFollowedPlayers(prev => [...prev, playerId]);
          throw error;
        }
        
        // Notify other components about the change
        FollowEventManager.notify();
      } else {
        // Optimistically update UI
        setFollowedPlayers(prev => [...prev, playerId]);
        
        const { error } = await supabase
          .from('player_follows')
          .insert([
            { user_id: session.user.id, player_id: playerId }
          ])
          .select();

        if (error) {
          // Revert on error
          setFollowedPlayers(prev => prev.filter(id => id !== playerId));
          throw error;
        }
        
        // Notify other components about the change
        FollowEventManager.notify();
      }
    } catch (err) {
      console.error('Error toggling player follow:', err);
    }
  };

  const sortedPlayers = [...players].sort((a, b) => {
    switch (sortBy) {
      case 'followers':
        return b.followers - a.followers;
      case 'homeRuns':
        return (b.battingStats?.homeRuns ?? 0) - (a.battingStats?.homeRuns ?? 0);
      case 'battingAverage':
        return parseFloat(b.battingStats?.battingAverage ?? '0') - parseFloat(a.battingStats?.battingAverage ?? '0');
      case 'era':
        return parseFloat(a.pitchingStats?.earnedRunAverage ?? '999') - parseFloat(b.pitchingStats?.earnedRunAverage ?? '999');
      case 'strikeouts':
        return (b.pitchingStats?.strikeouts ?? 0) - (a.pitchingStats?.strikeouts ?? 0);
      case 'wins':
        return (b.pitchingStats?.wins ?? 0) - (a.pitchingStats?.wins ?? 0);
      default:
        return 0;
    }
  });

  if (loading) {
    return (
      <Card className="w-full mt-4">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center h-32">
            <p className="text-gray-500">Loading player rankings...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="w-full mt-4">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center h-32">
            <p className="text-red-500">Error: {error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }


  return ( <>
     <AlertDialog open={showLoginDialog} onOpenChange={setShowLoginDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Login Required</AlertDialogTitle>
            <AlertDialogDescription>
              Please log in to follow players and receive updates about their performance.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
            {/* <AlertDialogAction onClick={() => window.location.href = '/login'}>
              Log In
            </AlertDialogAction> */}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
 
                  <TableCell>
                    {player.currentTeam.logo ? (
                      <div className="flex justify-center">
                        <div className="h-6 w-6">
                          <img 
                            src={player.currentTeam.logo} 
                            alt={`${player.currentTeam.name} logo`}  
                            className="object-cover"
                          />
                        </div>
                      </div>
                    ) : (
                      <Badge variant="secondary">{player.currentTeam.name}</Badge>
                    )}
                  </TableCell>
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
    </Card></>
  )
}