"use client"
import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, Minus } from "lucide-react";
import { createClient } from '@/utils/supabase/client';
import FollowEventManager from '@/utils/followEventManager';

interface Team {
  id: number;
  name: string;
  wins: number;
  losses: number;
  winningPercentage: number;
}

interface Player {
  id: number;
  nameFirstLast: string;
  currentTeam: {
    id: number;
    name: string;
    logo: string | null;
  };
  battingStats?: {
    homeRuns: number;
    battingAverage: string;
    runsBattedIn: number;
  };
  pitchingStats?: {
    earnedRunAverage: string;
    wins: number;
    losses: number;
  };
}

export default function Following() {
  const [followedTeams, setFollowedTeams] = useState<Team[]>([]);
  const [followedPlayers, setFollowedPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isInitialAuthChecking, setIsInitialAuthChecking] = useState(true);
  const [supabase] = useState(() => createClient());

  const handleUnfollow = async (type: 'team' | 'player', id: number) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      setLoading(true);
      
      const tableName = type === 'team' ? 'team_follows' : 'player_follows';
      const idField = type === 'team' ? 'team_id' : 'player_id';
      
      // Optimistically update UI
      if (type === 'team') {
        setFollowedTeams(prev => prev.filter(team => team.id !== id));
      } else {
        setFollowedPlayers(prev => prev.filter(player => player.id !== id));
      }

      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('user_id', session.user.id)
        .eq(idField, id);

      if (error) {
        // Revert on error
        if (type === 'team') {
          const team = followedTeams.find(t => t.id === id);
          if (team) setFollowedTeams(prev => [...prev, team]);
        } else {
          const player = followedPlayers.find(p => p.id === id);
          if (player) setFollowedPlayers(prev => [...prev, player]);
        }
        throw error;
      }

      // Notify other components about the change
      FollowEventManager.notify();
    } catch (err) {
      console.error(`Error unfollowing ${type}:`, err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFollowedItems = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        setIsLoggedIn(true);
        setLoading(true);

        // Fetch teams and players in parallel
        const [teamFollowsResponse, playerFollowsResponse] = await Promise.all([
          supabase
            .from('team_follows')
            .select('team_id')
            .eq('user_id', session.user.id),
          supabase
            .from('player_follows')
            .select('player_id')
            .eq('user_id', session.user.id)
        ]);

        const [teamsResponse, playersResponse] = await Promise.all([
          fetch('/api/teams'),
          fetch('/api/players')
        ]);

        const [allTeams, allPlayers] = await Promise.all([
          teamsResponse.json(),
          playersResponse.json()
        ]);

        if (teamFollowsResponse.data) {
          const teamIds = teamFollowsResponse.data.map(f => f.team_id);
          const followedTeamsData = allTeams.filter((team: Team) => 
            teamIds.includes(team.id)
          );
          setFollowedTeams(followedTeamsData);
        }

        if (playerFollowsResponse.data) {
          const playerIds = playerFollowsResponse.data.map(f => f.player_id);
          const followedPlayersData = allPlayers.filter((player: Player) => 
            playerIds.includes(player.id)
          );
          setFollowedPlayers(followedPlayersData);
        }
      } else {
        setIsLoggedIn(false);
        setFollowedTeams([]);
        setFollowedPlayers([]);
      }
    } catch (err) {
      console.error('Error fetching followed items:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  // Initial auth check
  useEffect(() => {
    const checkInitialAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setIsLoggedIn(!!session);
        if (session) {
          await fetchFollowedItems();
        }
      } finally {
        setIsInitialAuthChecking(false);
      }
    };

    checkInitialAuth();
  }, [supabase, fetchFollowedItems]);

  // Subscribe to follow/unfollow events
  useEffect(() => {
    const unsubscribe = FollowEventManager.subscribe(() => {
      fetchFollowedItems();
    });
    return () => unsubscribe();
  }, [fetchFollowedItems]);

  // Handle auth state changes
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
      if (session) {
        fetchFollowedItems();
      } else {
        setFollowedTeams([]);
        setFollowedPlayers([]);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, fetchFollowedItems]);

  if (isInitialAuthChecking) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center h-32">
          <p className="text-muted-foreground">Checking authentication...</p>
        </CardContent>
      </Card>
    );
  }

  if (!isLoggedIn) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-6 w-6" />
            Following
          </CardTitle>
          <CardDescription>Track your favorite teams and players</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-32">
          <p className="text-muted-foreground">Please log in to see your followed teams and players</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="h-6 w-6" />
          Following
        </CardTitle>
        <CardDescription>Your followed teams and players</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="teams" className="mb-4">
          <TabsList>
            <TabsTrigger value="teams">Teams ({followedTeams.length})</TabsTrigger>
            <TabsTrigger value="players">Players ({followedPlayers.length})</TabsTrigger>
          </TabsList>
          
          <TabsContent value="teams">
            {followedTeams.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                You haven't followed any teams yet
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Team</TableHead>
                      <TableHead className="text-right">W</TableHead>
                      <TableHead className="text-right">L</TableHead>
                      <TableHead className="text-right">PCT</TableHead>
                      <TableHead className="text-right">Unfollow </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {followedTeams.map((team) => (
                      <TableRow key={team.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <img
                              src={`https://www.mlbstatic.com/team-logos/${team.id}.svg`}
                              alt={team.name}
                              className="w-6 h-6"
                            />
                            {team.name}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{team.wins}</TableCell>
                        <TableCell className="text-right">{team.losses}</TableCell>
                        <TableCell className="text-right">
                          {(team.winningPercentage * 100).toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleUnfollow('team', team.id)}
                            disabled={loading}
                          >
                            <Minus className="h-4 w-4 text-red-400" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="players">
            {followedPlayers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                You haven't followed any players yet
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Player</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead className="text-right">Stats</TableHead>
                      <TableHead className="text-right">Unfollow </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {followedPlayers.map((player) => (
                      <TableRow key={player.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
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
                          <div className="flex items-center gap-2">
                            {player.currentTeam.logo ? (
                              <img
                                src={player.currentTeam.logo}
                                alt={player.currentTeam.name}
                                className="h-6 w-6"
                              />
                            ) : (
                              <Badge variant="secondary">{player.currentTeam.name}</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {player.battingStats ? (
                            <span>
                              {player.battingStats.homeRuns} HR, {player.battingStats.battingAverage} AVG
                            </span>
                          ) : player.pitchingStats ? (
                            <span>
                              {player.pitchingStats.earnedRunAverage} ERA, {player.pitchingStats.wins}-{player.pitchingStats.losses}
                            </span>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleUnfollow('player', player.id)}
                            disabled={loading}
                          >
                            <Minus className="h-4 w-4 text-red-400" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter>
        <p className="text-sm text-muted-foreground">
          Stats are updated daily
        </p>
      </CardFooter>
    </Card>
  );
}