import { NavLink, Outlet, useNavigate } from "react-router";
import { useAuth } from "../auth/AuthContext";
import { useTeam } from "../team/TeamContext";
import TeamLogo from "./TeamLogo";

export default function AppLayout() {
  const { user, signOut } = useAuth();
  const { team, teamId, seasonId, season, seasons, selectSeason } = useTeam();
  const navigate = useNavigate();

  // Schedule and Stats belong to a season, so they only appear once one exists.
  const activeSeasonId = season?.id ?? null;
  const tabs = teamId
    ? [
        { to: `/teams/${teamId}`, label: "Home", end: true },
        ...(activeSeasonId ? [{ to: `/seasons/${activeSeasonId}/schedule`, label: "Schedule", end: false }] : []),
        { to: `/teams/${teamId}/roster`, label: "Roster", end: false },
        ...(activeSeasonId ? [{ to: `/seasons/${activeSeasonId}/leaderboard`, label: "Stats", end: false }] : []),
      ]
    : [];

  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <NavLink to="/teams" className="brand" aria-label="Your teams">
            <TeamLogo team={team} size={36} />
            <span className="brand-team">{team?.name ?? "Slow-Pitch"}</span>
          </NavLink>
          <div className="topbar-actions">
            {seasons.length > 1 && (
              <label className="season-select">
                <span className="visually-hidden">Season</span>
                <select
                  value={seasonId ?? ""}
                  onChange={(event) => {
                    const id = Number(event.target.value);
                    selectSeason(id);
                    // Season pages carry the season in the URL; follow the switch.
                    const match = window.location.pathname.match(/^\/seasons\/\d+\/(schedule|leaderboard)/);
                    if (match) navigate(`/seasons/${id}/${match[1]}`);
                  }}
                >
                  {seasons.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {seasons.length === 1 && season && <span className="season-name">{season.name}</span>}
            <button type="button" className="signout" onClick={handleSignOut} title={user ? `Signed in as ${user.username}` : undefined}>
              Sign out
            </button>
          </div>
        </div>
        {tabs.length > 0 && (
          <nav className="tabs" aria-label="Team">
            {tabs.map((tab) => (
              <NavLink key={tab.label} to={tab.to} end={tab.end} className="tab">
                {tab.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>
      <main className={`content${tabs.length ? " has-tabs" : ""}`}>
        <Outlet />
      </main>
    </div>
  );
}
