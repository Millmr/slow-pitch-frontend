import type { AvailabilityStatus, Game } from "../types";

const dayFormat = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" });
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

export const formatDay = (iso: string) => dayFormat.format(new Date(iso));
export const formatTime = (iso: string) => timeFormat.format(new Date(iso));
export const formatDayTime = (iso: string) => `${formatDay(iso)}, ${formatTime(iso)}`;

export const AVAILABILITY_LABELS: Record<AvailabilityStatus, string> = {
  yes: "In",
  unsure: "Maybe",
  no: "Out",
};

export function resultText(game: Game): string {
  if (game.status === "cancelled") return "Cancelled";
  if (game.status !== "completed" || game.team_score == null || game.opponent_score == null) return "";
  return `${game.result} ${game.team_score}–${game.opponent_score}`;
}

export function playerName(name: string, jersey: number | null): string {
  return jersey == null ? name : `${name} #${jersey}`;
}

/** Value for <input type="datetime-local"> from a Date, in local time. */
export function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function todayIso(): string {
  return toLocalInputValue(new Date()).slice(0, 10);
}

/** Upcoming scheduled games first, soonest first; a game stays "next" until a few hours after first pitch. */
export function upcomingGames(games: Game[]): Game[] {
  const cutoff = Date.now() - 4 * 60 * 60 * 1000;
  return games
    .filter((g) => g.status === "scheduled" && new Date(g.scheduled_at).getTime() >= cutoff)
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
}

export function playedGames(games: Game[]): Game[] {
  return games
    .filter((g) => g.status === "completed")
    .sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at));
}

export function record(games: Game[]): string {
  const played = playedGames(games);
  const count = (r: string) => played.filter((g) => g.result === r).length;
  const ties = count("T");
  return `${count("W")}–${count("L")}${ties ? `–${ties}` : ""}`;
}
