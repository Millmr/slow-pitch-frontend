import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import { createGame, listGames } from "../api/games";
import { getSeason } from "../api/teams";
import { AvailabilityChip } from "../components/AvailabilityPicker";
import ErrorMessage from "../components/ErrorMessage";
import LoadingState from "../components/LoadingState";
import { formatDay, formatTime, playedGames, resultText, toLocalInputValue, upcomingGames } from "../lib/format";
import { useAction, useApi } from "../lib/useApi";
import { useTrackTeam } from "../team/TeamContext";
import type { Game } from "../types";

export default function SchedulePage() {
  const seasonId = Number(useParams().seasonId);
  const season = useApi(() => getSeason(seasonId), [seasonId]);
  const { isManager } = useTrackTeam(season.data?.team, seasonId);
  const games = useApi(() => listGames(seasonId), [seasonId]);

  const all = games.data ?? [];
  const upcoming = upcomingGames(all);
  const upcomingIds = new Set(upcoming.map((g) => g.id));
  // Everything else: results, cancellations, and scheduled games whose date has passed.
  const past = all
    .filter((g) => !upcomingIds.has(g.id))
    .sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at));
  const hasResults = playedGames(all).length > 0;

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Schedule</h1>
        {season.data && <p className="page-sub">{season.data.name}</p>}
      </div>

      <ErrorMessage error={season.error ?? games.error} onRetry={games.reload} />
      {games.loading && !games.data && <LoadingState />}

      {games.data && (
        <>
          <section className="section">
            <h2 className="section-title">Coming up</h2>
            {upcoming.length ? <GameList games={upcoming} /> : <p className="empty">No games scheduled.</p>}
          </section>

          {isManager && <AddGame seasonId={seasonId} onAdded={games.reload} />}

          {past.length > 0 && (
            <section className="section">
              <h2 className="section-title">{hasResults ? "Results" : "Earlier"}</h2>
              <GameList games={past} />
            </section>
          )}
        </>
      )}
    </div>
  );
}

function GameList({ games }: { games: Game[] }) {
  return (
    <ul className="list">
      {games.map((game) => (
        <li key={game.id}>
          <Link to={`/games/${game.id}`} className="list-row list-link game-row">
            <span className="game-date">
              <span className="game-day">{formatDay(game.scheduled_at)}</span>
              <span className="game-time">{formatTime(game.scheduled_at)}</span>
            </span>
            <span className="list-main">
              vs {game.opponent_name}
              {game.location && <span className="list-detail">{game.location}</span>}
            </span>
            {game.status === "scheduled" ? (
              <AvailabilityChip status={game.my_availability} />
            ) : (
              <span className={`result result-${game.status === "cancelled" ? "X" : game.result}`}>{resultText(game)}</span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function AddGame({ seasonId, onAdded }: { seasonId: number; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [opponent, setOpponent] = useState("");
  const [when, setWhen] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    date.setHours(18, 30, 0, 0);
    return toLocalInputValue(date);
  });
  const [location, setLocation] = useState("");
  const action = useAction();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const game = await action.run(() =>
      createGame(seasonId, {
        opponent_name: opponent.trim(),
        // The input is local time; toISOString sends the matching UTC instant.
        scheduled_at: new Date(when).toISOString(),
        location: location.trim(),
      }),
    );
    if (game) {
      setOpponent("");
      setOpen(false);
      onAdded();
    }
  }

  if (!open) {
    return (
      <section className="section">
        <button type="button" className="button button-primary" onClick={() => setOpen(true)}>
          Add a game
        </button>
      </section>
    );
  }

  return (
    <section className="section">
      <h2 className="section-title">Add a game</h2>
      <form className="form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Opponent</span>
          <input value={opponent} onChange={(e) => setOpponent(e.target.value)} placeholder="Hit Happens" required />
        </label>
        <div className="form-row">
          <label className="field">
            <span>Date and time</span>
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} required />
          </label>
          <label className="field">
            <span>Field</span>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Field 3" />
          </label>
        </div>
        <ErrorMessage error={action.error} />
        <div className="form-actions">
          <button type="submit" className="button button-primary" disabled={action.pending}>
            Add game
          </button>
          <button type="button" className="button button-quiet" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}
