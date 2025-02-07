import { NextResponse } from 'next/server';

interface TeamRecord {
  gamesPlayed?: number;
  wins?: number;
  losses?: number;
  winningPercentage?: number;
}

interface TeamApiResponse {
  teams: Array<{
    id: number;
    name: string;
    teamCode: string;
    teamName: string;
    shortName: string;
    record?: TeamRecord;
    divisionRank?: string;
    leagueRank?: string;
  }>;
}

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

async function fetchTeamData(): Promise<Team[]> {
  try {
    const response = await fetch('https://statsapi.mlb.com/api/v1/teams?sportId=1&season=2024&hydrate=league,division');

    if (!response.ok) {
      throw new Error(`MLB API responded with status: ${response.status}`);
    }

    const data: TeamApiResponse = await response.json();
    const teams = data.teams.map((team) => ({
      id: team.id,
      name: team.name,
      teamCode: team.teamCode,
      teamName: team.teamName,
      shortName: team.shortName,
      wins: team.record?.wins || 0,
      losses: team.record?.losses || 0,
      winningPercentage: team.record?.winningPercentage || 0,
      divisionRank: team.divisionRank || 'N/A',
      leagueRank: team.leagueRank || 'N/A',
    }));

    return teams.sort((a: Team, b: Team) => b.winningPercentage - a.winningPercentage);
  } catch (error) {
    console.error('Error fetching team data:', error);
    return [];
  }
}

export async function GET() {
  const teams = await fetchTeamData();
  return NextResponse.json(teams);
}