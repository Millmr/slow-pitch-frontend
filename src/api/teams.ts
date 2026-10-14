import type { Membership, Role, Season, Team } from "../types";
import { api, query } from "./client";

// Teams
export const listTeams = () => api.get<Team[]>("/teams/");
export const getTeam = (teamId: number) => api.get<Team>(`/teams/${teamId}/`);
export const createTeam = (name: string) => api.post<Team>("/teams/", { name });
export const renameTeam = (teamId: number, name: string) => api.patch<Team>(`/teams/${teamId}/`, { name });

// Logo
export function uploadTeamLogo(teamId: number, file: File) {
  const form = new FormData();
  form.append("logo", file);
  return api.put<Team>(`/teams/${teamId}/logo/`, form);
}
export const removeTeamLogo = (teamId: number) => api.delete(`/teams/${teamId}/logo/`);
export const fetchTeamLogo = (teamId: number, version: string) =>
  api.blob(`/teams/${teamId}/logo/?v=${encodeURIComponent(version)}`);

// Seasons
export interface SeasonInput {
  name: string;
  start_date: string;
  end_date?: string | null;
  is_active?: boolean;
}

export const listSeasons = (teamId: number) => api.get<Season[]>(`/teams/${teamId}/seasons/`);
export const getSeason = (seasonId: number) => api.get<Season>(`/seasons/${seasonId}/`);
export const createSeason = (teamId: number, input: SeasonInput) =>
  api.post<Season>(`/teams/${teamId}/seasons/`, input);

// Roster
export interface MembershipInput {
  display_name?: string;
  username?: string | null;
  season?: number | null;
  role?: Role;
  jersey_number?: number | null;
  is_substitute?: boolean;
  is_active?: boolean;
}

export const listRoster = (teamId: number, options: { season?: number | null; includeInactive?: boolean } = {}) =>
  api.get<Membership[]>(
    `/teams/${teamId}/roster/${query({ season: options.season, include_inactive: options.includeInactive })}`,
  );

export const addRosterMember = (teamId: number, input: MembershipInput) =>
  api.post<Membership>(`/teams/${teamId}/roster/`, input);

export const updateMembership = (membershipId: number, input: MembershipInput) =>
  api.patch<Membership>(`/memberships/${membershipId}/`, input);
