import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import { listGames, setAvailability } from "../api/games";
import { createSeason } from "../api/teams";
import AvailabilityPicker from "../components/AvailabilityPicker";
import ErrorMessage from "../components/ErrorMessage";
import LoadingState from "../components/LoadingState";
import TeamLogoSettings from "../components/TeamLogoSettings";
import { formatDay, formatTime, playedGames, record, resultText, todayIso, upcomingGames } from "../lib/format";
import { useAction, useApi } from "../lib/useApi";
import { useTrackTeam } from "../team/TeamContext";
import type { AvailabilityStatus, Game } from "../types";

export default function DashboardPage() {
  const teamId = Number(useParams().teamId);
  const { team, seasons, season, isManager, loading, error, refresh, selectSeason, updateTeam } = useTrackTeam(teamId);
  const seasonId = season?.id ?? null;

  const games = useApi(
    () => (season ? listGames(season.id) : Promise.resolve<Game[]>([])),
    [season?.id],
  );

  if (error) return <div className="page"><ErrorMessage error={error} onRetry={refresh} /></div>;
  if (!team || loading) return <div className="page"><LoadingState /></div>;

  if (seasons.length === 0) {
    return (
      <div className="page">
        <h1 className="page-title">{team.name}</h1>
        {isManager ? (
          <>
            <p className="empty">Add your first season to start scheduling games.</p>
            <SeasonForm
              teamId={team.id}
              onCreated={(id) => {
                selectSeason(id);
                refresh();
              }}
            />
          </>
        ) : (
          <p className="empty">Your manager hasn't set up a season yet.</p>
        )}
        {isManager && <TeamLogoSettings team={team} onChanged={updateTeam} />}
      </div>
    );
  }

  const all = games.data ?? [];
  const next = upcomingGames(all)[0];
  const recent = playedGames(all).slice(0, 3);

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">{team.name}</h1>
        {season && (
          <p className="page-sub">
            <span>{season.name}</span>
            {recent.length > 0 && <span className="record">{record(all)}</span>}
          </p>
        )}
      </div>

      {games.loading && !games.data && <LoadingState />}
      <ErrorMessage error={games.error} onRetry={games.reload} />

      {games.data && (
        <>
          <section className="section">
            <h2 className="section-title">Next game</h2>
            {next ? (
              <NextGame game={next} onChanged={games.reload} />
            ) : (
              <p className="empty">
                Nothing on the schedule.{" "}
                {isManager && seasonId && <Link to={`/seasons/${seasonId}/schedule`}>Add a game</Link>}
              </p>
            )}
          </section>

          <section className="section">
            <h2 className="section-title">Recent results</h2>
            {recent.length === 0 ? (
              <p className="empty">No games played yet this season.</p>
            ) : (
              <ul className="list">
                {recent.map((game) => (
                  <li key={game.id}>
                    <Link to={`/games/${game.id}`} className="list-row list-link">
                      <span className={`result result-${game.result}`}>{resultText(game)}</span>
                      <span className="list-main">vs {game.opponent_name}</span>
                      <span className="list-meta">{formatDay(game.scheduled_at)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {isManager && <NewSeason teamId={team.id} onCreated={(id) => { selectSeason(id); refresh(); }} />}
      {isManager && <TeamLogoSettings team={team} onChanged={updateTeam} />}
    </div>
  );
}

function NextGame({ game, onChanged }: { game: Game; onChanged: () => void }) {
  const action = useAction();
  const [mine, setMine] = useState<AvailabilityStatus | null>(game.my_availability);

  async function choose(status: AvailabilityStatus) {
    const previous = mine;
    setMine(status);
    const result = await action.run(() => setAvailability(game.id, status));
    if (result) onChanged();
    else setMine(previous);
  }

  return (
    <div className="next-game">
      <Link to={`/games/${game.id}`} className="next-game-main">
        <span className="next-game-when">
          <span className="next-game-day">{formatDay(game.scheduled_at)}</span>
          <span className="next-game-time">{formatTime(game.scheduled_at)}</span>
        </span>
        <span className="next-game-opponent">vs {game.opponent_name}</span>
        {game.location && <span className="next-game-location">{game.location}</span>}
      </Link>
      <AvailabilityPicker value={mine} onChange={choose} disabled={action.pending} />
      <ErrorMessage error={action.error} />
    </div>
  );
}

function NewSeason({ teamId, onCreated }: { teamId: number; onCreated: (id: number) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="section">
      {open ? (
        <>
          <h2 className="section-title">New season</h2>
          <SeasonForm
            teamId={teamId}
            onCreated={(id) => {
              setOpen(false);
              onCreated(id);
            }}
            onCancel={() => setOpen(false)}
          />
        </>
      ) : (
        <button type="button" className="button button-quiet" onClick={() => setOpen(true)}>
          Start a new season
        </button>
      )}
    </section>
  );
}

function SeasonForm({ teamId, onCreated, onCancel }: { teamId: number; onCreated: (id: number) => void; onCancel?: () => void }) {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(todayIso());
  const action = useAction();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const season = await action.run(() => createSeason(teamId, { name: name.trim(), start_date: startDate }));
    if (season) onCreated(season.id);
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="form-row">
        <label className="field">
          <span>Season name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Fall 2026" required />
        </label>
        <label className="field">
          <span>Starts</span>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
        </label>
      </div>
      <ErrorMessage error={action.error} />
      <div className="form-actions">
        <button type="submit" className="button button-primary" disabled={action.pending}>
          Create season
        </button>
        {onCancel && (
          <button type="button" className="button button-quiet" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
