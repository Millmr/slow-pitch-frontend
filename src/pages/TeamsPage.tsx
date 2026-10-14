import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { createTeam, listTeams } from "../api/teams";
import ErrorMessage from "../components/ErrorMessage";
import LoadingState from "../components/LoadingState";
import TeamLogo from "../components/TeamLogo";
import { useAction, useApi } from "../lib/useApi";
import { useTeam } from "../team/TeamContext";

export default function TeamsPage() {
  const navigate = useNavigate();
  const { selectTeam } = useTeam();
  const teams = useApi(listTeams, []);
  const [name, setName] = useState("");
  const action = useAction();

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    const team = await action.run(() => createTeam(name.trim()));
    if (team) {
      selectTeam(team.id);
      navigate(`/teams/${team.id}`);
    }
  }

  return (
    <div className="page">
      <h1 className="page-title">Your teams</h1>

      {teams.loading && !teams.data && <LoadingState />}
      <ErrorMessage error={teams.error} onRetry={teams.reload} />

      {teams.data && teams.data.length === 0 && (
        <p className="empty">You're not on a team yet. Start one below, or ask your manager to add you to theirs.</p>
      )}

      {teams.data && teams.data.length > 0 && (
        <ul className="list">
          {teams.data.map((team) => (
            <li key={team.id}>
              <Link to={`/teams/${team.id}`} className="list-row list-link" onClick={() => selectTeam(team.id)}>
                <TeamLogo team={team} size={40} />
                <span className="list-main">{team.name}</span>
                <span className="list-meta">{team.my_role === "manager" ? "Manager" : "Player"}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <section className="section">
        <h2 className="section-title">Start a team</h2>
        <form className="form form-inline" onSubmit={handleCreate}>
          <label className="field">
            <span>Team name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="The Bat Intentions" required />
          </label>
          <button type="submit" className="button button-primary" disabled={action.pending}>
            Create team
          </button>
        </form>
        <ErrorMessage error={action.error} />
        <p className="hint">You'll be the team's manager.</p>
      </section>
    </div>
  );
}
