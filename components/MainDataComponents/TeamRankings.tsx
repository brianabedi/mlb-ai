"use client"
import React, { useEffect, useState } from 'react';
import { Plus, Minus, Check } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { createClient } from '@/utils/supabase/client';

interface Team {
  id: number;
  name: string;
  teamCode: string;
  teamName: string;
  shortName: string;
  wins: number;
  losses: number;
  winningPercentage: number;
  divisionRank: string;
  leagueRank: string;
}

type SortField = 'winningPercentage' | 'wins' | 'losses' | 'name';

export default function TeamRankings() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [followedTeams, setFollowedTeams] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('winningPercentage');
  const [supabase] = useState(() => createClient());
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const response = await fetch('/api/teams');
        if (!response.ok) {
          throw new Error('Failed to fetch team data');
        }
        const data: Team[] = await response.json();
        setTeams(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load teams');
      } finally {
        setLoading(false);
      }
    };

    fetchTeams();
  }, []);

  useEffect(() => {
    const fetchFollowedTeams = async () => {
      try {
        setIsAuthChecking(true);
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          const { data: follows, error: dbError } = await supabase
            .from('team_follows')
            .select('team_id')
            .eq('user_id', session.user.id);
          
          if (dbError) throw dbError;
          if (follows) {
            setFollowedTeams(follows.map(f => f.team_id));
          }
        } else {
          setFollowedTeams([]);
        }
      } catch (err) {
        console.error('Error fetching followed teams:', err);
        setFollowedTeams([]);
      } finally {
        setIsAuthChecking(false);
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchFollowedTeams();
      } else {
        setFollowedTeams([]);
      }
    });

    fetchFollowedTeams();

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const handleFollowToggle = async (teamId: number) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        // You might want to show a login dialog here
        console.error('User must be logged in to follow teams');
        return;
      }

      if (followedTeams.includes(teamId)) {
        setFollowedTeams(followedTeams.filter(id => id !== teamId));
        
        const { error } = await supabase
          .from('team_follows')
          .delete()
          .eq('user_id', session.user.id)
          .eq('team_id', teamId);

        if (error) {
          setFollowedTeams(prev => [...prev, teamId]);
          throw error;
        }
      } else {
        setFollowedTeams(prev => [...prev, teamId]);
        
        const { error } = await supabase
          .from('team_follows')
          .insert([
            { user_id: session.user.id, team_id: teamId }
          ])
          .select();

        if (error) {
          setFollowedTeams(prev => prev.filter(id => id !== teamId));
          throw error;
        }
      }
    } catch (err) {
      console.error('Error toggling team follow:', err);
    }
  };

  const sortTeams = (a: Team, b: Team, field: SortField): number => {
    switch (field) {
      case 'winningPercentage':
        return b.winningPercentage - a.winningPercentage;
      case 'wins':
        return b.wins - a.wins;
      case 'losses':
        return b.losses - a.losses;
      case 'name':
        return a.name.localeCompare(b.name);
      default:
        return 0;
    }
  };

  const filteredTeams = teams
    .filter((team: Team) => 
      team.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      team.shortName.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a: Team, b: Team) => sortTeams(a, b, sortBy));

  if (loading) {
    return (
      <Card className="w-full mt-4">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center h-32">
            <p className="text-gray-500">Loading team rankings...</p>
          </div>
        </CardContent>
      </Card>
    );
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
    );
  }

  return (
    <Card className="w-full mt-4">
      <CardHeader>
        <CardTitle>Team Rankings</CardTitle>
        <CardDescription>Current MLB team standings and statistics</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 mb-4">
          <Input
            placeholder="Search teams..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
          <Select
            value={sortBy}
            onValueChange={(value: SortField) => setSortBy(value)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="winningPercentage">Win %</SelectItem>
              <SelectItem value="wins">Wins</SelectItem>
              <SelectItem value="losses">Losses</SelectItem>
              <SelectItem value="name">Team Name</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="rounded-md border">
          <div className="max-h-[350px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rank</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead className="text-right">W</TableHead>
                  <TableHead className="text-right">L</TableHead>
                  <TableHead className="text-right">PCT</TableHead>
                  <TableHead className="text-right">DIV Rank</TableHead>
                  <TableHead className="text-right">LG Rank</TableHead>
                  <TableHead className="text-right">Follow</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTeams.map((team: Team, index: number) => (
                  <TableRow key={team.id}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
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
                    <TableCell className="text-right">{team.divisionRank}</TableCell>
                    <TableCell className="text-right">{team.leagueRank}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleFollowToggle(team.id)}
                      >
                        {followedTeams.includes(team.id) ? (
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
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <p className="text-sm text-gray-500">
          Total Teams: {filteredTeams.length}
        </p>
      </CardFooter>
    </Card>
  );
}