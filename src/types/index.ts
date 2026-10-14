// Shapes returned by the Django API (see the backend README for endpoints).

export type Role = "manager" | "scorekeeper" | "player";
export type GameStatus = "scheduled" | "completed" | "cancelled";
export type GameResult = "W" | "L" | "T";
export type AvailabilityStatus = "yes" | "no" | "unsure";

export const POSITIONS = ["P", "C", "1B", "2B", "3B", "SS", "LF", "LCF", "CF", "RCF", "RF", "ROV", "EH"] as const;
export type Position = (typeof POSITIONS)[number];

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Team {
  id: number;
  name: string;
  created_by: number | null;
  created_at: string;
  my_role: Role | null;
  /** Null when the team has no logo; changes whenever the logo does. */
  logo_version: string | null;
}

export interface Season {
  id: number;
  team: number;
  name: string;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
}

export interface Membership {
  id: number;
  team: number;
  season: number | null;
  display_name: string;
  role: Role;
  jersey_number: number | null;
  is_substitute: boolean;
  is_active: boolean;
  account: string | null;
  created_at: string;
}

export interface Game {
  id: number;
  season: number;
  team_id: number;
  opponent_name: string;
  scheduled_at: string;
  location: string;
  status: GameStatus;
  team_score: number | null;
  opponent_score: number | null;
  result: GameResult | null;
  my_availability: AvailabilityStatus | null;
}

export interface AvailabilityEntry {
  membership_id: number;
  display_name: string;
  jersey_number: number | null;
  is_substitute: boolean;
  status?: AvailabilityStatus;
  updated_at?: string;
}

export interface Availability {
  game: number;
  my_membership_id: number | null;
  summary: Record<AvailabilityStatus | "no_response", number>;
  responses: AvailabilityEntry[];
  missing: AvailabilityEntry[];
}

export interface LineupPlayer {
  membership_id: number;
  display_name: string;
  jersey_number: number | null;
  batting_order: number;
  defensive_position: Position;
}

export interface Lineup {
  game: number;
  updated_at: string | null;
  players: LineupPlayer[];
  warnings: string[];
}

export interface StatLine {
  membership_id: number;
  display_name: string;
  jersey_number: number | null;
  games_played?: number;
  at_bats: number;
  hits: number;
  singles: number;
  doubles: number;
  triples: number;
  home_runs: number;
  walks: number;
  sac_flies: number;
  total_bases: number;
  batting_average: number | null;
  on_base_percentage: number | null;
  slugging_percentage: number | null;
  batting_average_display: string;
  on_base_percentage_display: string;
  slugging_percentage_display: string;
  rank?: number;
}

export interface GameStats {
  game: number;
  status: GameStatus;
  counts_toward_season: boolean;
  /** True when the game was scored in the book; the lines are built from it. */
  from_book: boolean;
  players: StatLine[];
}

export type LeaderboardSort =
  | "batting_average"
  | "on_base_percentage"
  | "slugging_percentage"
  | "hits"
  | "home_runs"
  | "doubles"
  | "triples"
  | "walks"
  | "at_bats"
  | "games_played";

export interface Leaderboard {
  season: number;
  sort: LeaderboardSort;
  sort_options: LeaderboardSort[];
  obp_note: string;
  players: StatLine[];
}

export interface GameLogEntry extends StatLine {
  game_id: number;
  opponent_name: string;
  scheduled_at: string;
  game_status: GameStatus;
  counts_toward_season: boolean;
}

export interface PlayerStats {
  membership: Membership;
  season: number | null;
  totals: StatLine;
  games: GameLogEntry[];
}

/** The counting stats a manager enters for one player in one game. */
export interface StatInput {
  membership_id: number;
  at_bats: number;
  singles: number;
  doubles: number;
  triples: number;
  home_runs: number;
  walks: number;
  sac_flies: number;
}

export const PLATE_RESULTS = ["1B", "2B", "3B", "HR", "BB", "SF", "OUT"] as const;
export type PlateResult = (typeof PLATE_RESULTS)[number];

export interface BookPlayer {
  membership_id: number;
  display_name: string;
  jersey_number: number | null;
  batting_order?: number;
}

export interface PlateAppearance extends BookPlayer {
  id: number;
  sequence: number;
  inning: number;
  result: PlateResult;
}

export interface Book {
  game: number;
  game_status: GameStatus;
  counts_toward_season: boolean;
  can_edit: boolean;
  inning: number;
  outs: number;
  next_batter: BookPlayer | null;
  on_deck: BookPlayer | null;
  lineup: BookPlayer[];
  plate_appearances: PlateAppearance[];
}
