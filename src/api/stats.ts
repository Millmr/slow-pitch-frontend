import type { GameStats, Leaderboard, LeaderboardSort, PlayerStats, StatInput } from "../types";
import { api, query } from "./client";

export const getGameStats = (gameId: number) => api.get<GameStats>(`/games/${gameId}/stats/`);
export const saveGameStats = (gameId: number, players: StatInput[]) =>
  api.put<GameStats>(`/games/${gameId}/stats/`, { players });

export const getLeaderboard = (seasonId: number, sort: LeaderboardSort) =>
  api.get<Leaderboard>(`/seasons/${seasonId}/leaderboard/${query({ sort })}`);

export const getPlayerStats = (membershipId: number, seasonId?: number | null) =>
  api.get<PlayerStats>(`/memberships/${membershipId}/stats/${query({ season: seasonId })}`);
