import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toApiError, type ApiError } from "../api/client";
import { getTeam, listSeasons } from "../api/teams";
import { useAuth } from "../auth/AuthContext";
import type { Season, Team } from "../types";

// Remembers which team and season you're looking at, so the navigation can
// link to the right schedule, roster and leaderboard from any page.

interface TeamValue {
  teamId: number | null;
  seasonId: number | null;
  team: Team | null;
  seasons: Season[];
  season: Season | null;
  isManager: boolean;
  loading: boolean;
  error: ApiError | null;
  selectTeam: (teamId: number) => void;
  selectSeason: (seasonId: number | null) => void;
  refresh: () => void;
  /** Replace the loaded team (e.g. after uploading a logo) without reloading. */
  updateTeam: (team: Team) => void;
}

const TEAM_KEY = "slowpitch.teamId";
const SEASON_KEY = "slowpitch.seasonId";

function readNumber(key: string): number | null {
  try {
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function writeNumber(key: string, value: number | null): void {
  try {
    if (value) localStorage.setItem(key, String(value));
    else localStorage.removeItem(key);
  } catch {
    // Not fatal: we just won't remember the choice next visit.
  }
}

function defaultSeason(seasons: Season[]): number | null {
  return (seasons.find((s) => s.is_active) ?? seasons[0])?.id ?? null;
}

const TeamContext = createContext<TeamValue | null>(null);

export function TeamProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [teamId, setTeamId] = useState<number | null>(() => readNumber(TEAM_KEY));
  const [seasonId, setSeasonId] = useState<number | null>(() => readNumber(SEASON_KEY));
  const [team, setTeam] = useState<Team | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [version, setVersion] = useState(0);

  // Forget the selection when someone signs out.
  useEffect(() => {
    if (token) return;
    setTeamId(null);
    setSeasonId(null);
    setTeam(null);
    setSeasons([]);
  }, [token]);

  useEffect(() => writeNumber(TEAM_KEY, teamId), [teamId]);
  useEffect(() => writeNumber(SEASON_KEY, seasonId), [seasonId]);

  useEffect(() => {
    if (!teamId || !token) return;
    let active = true;
    setLoading(true);
    setError(null);
    Promise.all([getTeam(teamId), listSeasons(teamId)]).then(
      ([loadedTeam, loadedSeasons]) => {
        if (!active) return;
        setTeam(loadedTeam);
        setSeasons(loadedSeasons);
        setSeasonId((current) =>
          current && loadedSeasons.some((s) => s.id === current) ? current : defaultSeason(loadedSeasons),
        );
        setLoading(false);
      },
      (err: unknown) => {
        if (!active) return;
        setTeam(null);
        setSeasons([]);
        setError(toApiError(err));
        setLoading(false);
      },
    );
    return () => {
      active = false;
    };
  }, [teamId, token, version]);

  const selectTeam = useCallback((id: number) => setTeamId(id), []);

  const selectSeason = useCallback((id: number | null) => setSeasonId(id), []);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  const updateTeam = useCallback((next: Team) => setTeam(next), []);

  const value = useMemo<TeamValue>(() => {
    // Until the newly selected team loads, don't expose the previous team's data.
    const currentTeam = team && team.id === teamId ? team : null;
    const currentSeasons = currentTeam ? seasons : [];
    return {
      teamId,
      seasonId,
      team: currentTeam,
      seasons: currentSeasons,
      season: currentSeasons.find((s) => s.id === seasonId) ?? null,
      isManager: currentTeam?.my_role === "manager",
      loading,
      error,
      selectTeam,
      selectSeason,
      refresh,
      updateTeam,
    };
  }, [teamId, seasonId, team, seasons, loading, error, selectTeam, selectSeason, refresh, updateTeam]);

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
}

export function useTeam(): TeamValue {
  const value = useContext(TeamContext);
  if (!value) throw new Error("useTeam must be used inside TeamProvider");
  return value;
}

/**
 * Point the team context at the team (and season) a page belongs to. Returns
 * the context, with team data hidden until it's the team this page asked for.
 */
export function useTrackTeam(teamId: number | null | undefined, seasonId?: number | null): TeamValue {
  const value = useTeam();
  const { selectTeam, selectSeason } = value;
  useEffect(() => {
    if (teamId) selectTeam(teamId);
  }, [teamId, selectTeam]);
  useEffect(() => {
    if (seasonId) selectSeason(seasonId);
  }, [seasonId, selectSeason]);

  if (!teamId || value.team?.id === teamId) return value;
  return { ...value, team: null, seasons: [], season: null, isManager: false, loading: true };
}
