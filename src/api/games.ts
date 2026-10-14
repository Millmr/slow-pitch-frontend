import type { Availability, AvailabilityStatus, Game, GameStatus, Lineup, Position } from "../types";
import { api, query } from "./client";

export interface GameInput {
  opponent_name?: string;
  scheduled_at?: string;
  location?: string;
  status?: Exclude<GameStatus, "completed">;
}

export const listGames = (seasonId: number, status?: GameStatus) =>
  api.get<Game[]>(`/seasons/${seasonId}/games/${query({ status })}`);
export const getGame = (gameId: number) => api.get<Game>(`/games/${gameId}/`);
export const createGame = (seasonId: number, input: GameInput) =>
  api.post<Game>(`/seasons/${seasonId}/games/`, input);
export const updateGame = (gameId: number, input: GameInput) => api.patch<Game>(`/games/${gameId}/`, input);
export const recordResult = (gameId: number, teamScore: number, opponentScore: number) =>
  api.post<Game>(`/games/${gameId}/result/`, { team_score: teamScore, opponent_score: opponentScore });

// Availability
export const getAvailability = (gameId: number) => api.get<Availability>(`/games/${gameId}/availability/`);
export const setAvailability = (gameId: number, status: AvailabilityStatus, membershipId?: number) =>
  api.patch<Availability>(`/games/${gameId}/availability/`, {
    status,
    ...(membershipId ? { membership_id: membershipId } : {}),
  });

// Lineup
export interface LineupSpotInput {
  membership_id: number;
  batting_order: number;
  defensive_position: Position;
}

export const getLineup = (gameId: number) => api.get<Lineup>(`/games/${gameId}/lineup/`);
export const saveLineup = (gameId: number, players: LineupSpotInput[]) =>
  api.put<Lineup>(`/games/${gameId}/lineup/`, { players });
