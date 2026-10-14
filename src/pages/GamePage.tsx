import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import { getAvailability, getBook, getGame, getLineup, recordResult, setAvailability, updateGame } from "../api/games";
import AvailabilityPicker, { AvailabilityChip } from "../components/AvailabilityPicker";
import BattingSlot from "../components/BattingSlot";
import ErrorMessage from "../components/ErrorMessage";
import LoadingState from "../components/LoadingState";
import { formatDayTime, playerName } from "../lib/format";
import { useAction, useApi } from "../lib/useApi";
import { useTrackTeam } from "../team/TeamContext";
import type { Availability, AvailabilityEntry, AvailabilityStatus, Book, Game } from "../types";

export default function GamePage() {
  const gameId = Number(useParams().gameId);
  const game = useApi(() => getGame(gameId), [gameId]);
  const { team, isManager, canKeepBook } = useTrackTeam(game.data?.team_id, game.data?.season);
  const availability = useApi(() => getAvailability(gameId), [gameId]);
  const lineup = useApi(() => getLineup(gameId), [gameId]);
  const book = useApi(() => getBook(gameId), [gameId]);

  if (game.error) return <div className="page"><ErrorMessage error={game.error} onRetry={game.reload} /></div>;
  if (!game.data) return <div className="page"><LoadingState /></div>;

  const g = game.data;
  const reloadAll = () => {
    game.reload();
    availability.reload();
  };

  return (
    <div className="page">
      <Scoreboard game={g} teamName={team?.name ?? "Us"} />
      {g.status !== "cancelled" && <BookCallout game={g} book={book.data} canKeepBook={canKeepBook} />}

      {g.status === "scheduled" && availability.data?.my_membership_id && (
        <section className="section">
          <h2 className="section-title">Can you make it?</h2>
          <MyAvailability game={g} onChanged={reloadAll} />
        </section>
      )}

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">Lineup</h2>
          {isManager && g.status !== "cancelled" && (
            <Link className="button button-quiet button-small" to={`/games/${g.id}/lineup`}>
              {lineup.data?.players.length ? "Edit lineup" : "Build lineup"}
            </Link>
          )}
        </div>
        <ErrorMessage error={lineup.error} onRetry={lineup.reload} />
        {lineup.data && lineup.data.players.length === 0 && <p className="empty">No lineup posted yet.</p>}
        {lineup.data && lineup.data.players.length > 0 && (
          <ol className="lineup-card">
            {lineup.data.players.map((p) => (
              <li key={p.membership_id} className="lineup-line">
                <BattingSlot order={p.batting_order} />
                <span className="lineup-name">{playerName(p.display_name, p.jersey_number)}</span>
                <span className="position">{p.defensive_position}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="section">
        <h2 className="section-title">Who's coming</h2>
        <ErrorMessage error={availability.error} onRetry={availability.reload} />
        {availability.loading && !availability.data && <LoadingState inline />}
        {availability.data && (
          <AvailabilityBoard
            data={availability.data}
            gameId={g.id}
            editable={isManager && g.status === "scheduled"}
            onChanged={availability.reload}
          />
        )}
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">Box score</h2>
          <Link className="button button-quiet button-small" to={`/games/${g.id}/stats`}>
            {isManager ? "Enter stats" : "View stats"}
          </Link>
        </div>
        {isManager && g.status !== "cancelled" && <ResultForm game={g} onSaved={game.setData} />}
      </section>

      {isManager && <GameStatusActions game={g} onSaved={reloadAll} />}
    </div>
  );
}

function ordinal(n: number): string {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${suffix}`;
}

/** The headline action on a game: keep (or follow) the book, with the live state once it's started. */
function BookCallout({ game, book, canKeepBook }: { game: Game; book: Book | undefined; canKeepBook: boolean }) {
  const plays = book?.plate_appearances.length ?? 0;
  const live = plays > 0 && game.status === "scheduled";
  let detail: string;
  if (live && book) {
    const outs = `${book.outs} ${book.outs === 1 ? "out" : "outs"}`;
    detail = `${ordinal(book.inning)} inning, ${outs}.${book.next_batter ? ` ${book.next_batter.display_name} is up.` : ""}`;
  } else if (plays > 0) {
    detail = `${plays} plate appearances recorded. See the whole game.`;
  } else {
    detail = canKeepBook ? "Record each at-bat as it happens. Stats fill in on their own." : "Follow every at-bat once the game starts.";
  }
  return (
    <Link to={`/games/${game.id}/book`} className={`book-callout${live ? " is-live" : ""}`}>
      <img src="/softball.svg" alt="" width={44} height={44} className="book-callout-ball" />
      <span className="book-callout-text">
        <span className="book-callout-title">
          {canKeepBook ? "Keep the book" : "Follow the book"}
          {live && <span className="live-tag">Live</span>}
        </span>
        <span className="book-callout-detail">{detail}</span>
      </span>
    </Link>
  );
}

function Scoreboard({ game, teamName }: { game: Game; teamName: string }) {
  const final = game.status === "completed";
  return (
    <section className={`scoreboard scoreboard-${game.status}`} aria-label="Game">
      <p className="scoreboard-when">
        {formatDayTime(game.scheduled_at)}
        {game.location && <span className="scoreboard-where">{game.location}</span>}
      </p>
      <div className="scoreboard-teams">
        <div className="scoreboard-team">
          <span className="scoreboard-name">{teamName}</span>
          {final && <span className="scoreboard-score">{game.team_score}</span>}
        </div>
        {!final && <span className="scoreboard-vs">vs</span>}
        <div className="scoreboard-team">
          <span className="scoreboard-name">{game.opponent_name}</span>
          {final && <span className="scoreboard-score">{game.opponent_score}</span>}
        </div>
      </div>
      <p className="scoreboard-status">
        {game.status === "completed" && (game.result === "W" ? "Final, win" : game.result === "L" ? "Final, loss" : "Final, tie")}
        {game.status === "cancelled" && "Cancelled"}
        {game.status === "scheduled" && "Scheduled"}
      </p>
    </section>
  );
}

function MyAvailability({ game, onChanged }: { game: Game; onChanged: () => void }) {
  const [mine, setMine] = useState<AvailabilityStatus | null>(game.my_availability);
  const action = useAction();

  async function choose(status: AvailabilityStatus) {
    const previous = mine;
    setMine(status);
    if (await action.run(() => setAvailability(game.id, status))) onChanged();
    else setMine(previous);
  }

  return (
    <>
      <AvailabilityPicker value={mine} onChange={choose} disabled={action.pending} />
      <ErrorMessage error={action.error} />
    </>
  );
}

const GROUPS: { status: AvailabilityStatus; label: string }[] = [
  { status: "yes", label: "In" },
  { status: "unsure", label: "Maybe" },
  { status: "no", label: "Out" },
];

function AvailabilityBoard({
  data,
  gameId,
  editable,
  onChanged,
}: {
  data: Availability;
  gameId: number;
  editable: boolean;
  onChanged: () => void;
}) {
  const action = useAction();

  async function setFor(entry: AvailabilityEntry, status: AvailabilityStatus) {
    if (await action.run(() => setAvailability(gameId, status, entry.membership_id))) onChanged();
  }

  const row = (entry: AvailabilityEntry) => (
    <li key={entry.membership_id} className="list-row">
      <span className="list-main">
        {playerName(entry.display_name, entry.jersey_number)}
        {entry.is_substitute && <span className="tag">Sub</span>}
      </span>
      {editable ? (
        <select
          aria-label={`Availability for ${entry.display_name}`}
          value={entry.status ?? ""}
          disabled={action.pending}
          onChange={(e) => setFor(entry, e.target.value as AvailabilityStatus)}
        >
          <option value="" disabled>
            No answer
          </option>
          <option value="yes">In</option>
          <option value="unsure">Maybe</option>
          <option value="no">Out</option>
        </select>
      ) : (
        <AvailabilityChip status={entry.status} />
      )}
    </li>
  );

  return (
    <div className="availability-board">
      <p className="tally">
        <span className="tally-yes">{data.summary.yes} in</span>
        <span className="tally-unsure">{data.summary.unsure} maybe</span>
        <span className="tally-no">{data.summary.no} out</span>
        <span className="tally-none">{data.summary.no_response} haven't answered</span>
      </p>
      {GROUPS.map(({ status, label }) => {
        const entries = data.responses.filter((r) => r.status === status);
        if (!entries.length) return null;
        return (
          <div key={status} className="availability-group">
            <h3 className="group-title">{label}</h3>
            <ul className="list">{entries.map(row)}</ul>
          </div>
        );
      })}
      {data.missing.length > 0 && (
        <div className="availability-group">
          <h3 className="group-title">Haven't answered</h3>
          <ul className="list">{data.missing.map(row)}</ul>
        </div>
      )}
      <ErrorMessage error={action.error} />
    </div>
  );
}

function ResultForm({ game, onSaved }: { game: Game; onSaved: (game: Game) => void }) {
  const [ours, setOurs] = useState(game.team_score?.toString() ?? "");
  const [theirs, setTheirs] = useState(game.opponent_score?.toString() ?? "");
  const action = useAction();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const saved = await action.run(() => recordResult(game.id, Number(ours), Number(theirs)));
    if (saved) onSaved(saved);
  }

  return (
    <form className="form result-form" onSubmit={handleSubmit}>
      <div className="form-row">
        <label className="field field-score">
          <span>Our score</span>
          <input type="number" inputMode="numeric" min={0} value={ours} onChange={(e) => setOurs(e.target.value)} required />
        </label>
        <label className="field field-score">
          <span>{game.opponent_name}</span>
          <input type="number" inputMode="numeric" min={0} value={theirs} onChange={(e) => setTheirs(e.target.value)} required />
        </label>
      </div>
      <ErrorMessage error={action.error} />
      <div className="form-actions">
        <button type="submit" className="button button-primary" disabled={action.pending}>
          {game.status === "completed" ? "Update final score" : "Save final score"}
        </button>
      </div>
    </form>
  );
}

function GameStatusActions({ game, onSaved }: { game: Game; onSaved: () => void }) {
  const action = useAction();
  const change = async (status: "scheduled" | "cancelled") => {
    if (status === "cancelled" && game.status === "completed" && !window.confirm("Cancelling clears the score and takes this game's stats out of the season. Continue?")) {
      return;
    }
    if (await action.run(() => updateGame(game.id, { status }))) onSaved();
  };

  return (
    <section className="section section-quiet">
      {game.status === "cancelled" ? (
        <button type="button" className="button button-quiet" disabled={action.pending} onClick={() => change("scheduled")}>
          Put back on the schedule
        </button>
      ) : (
        <button type="button" className="button button-danger" disabled={action.pending} onClick={() => change("cancelled")}>
          Cancel game
        </button>
      )}
      <ErrorMessage error={action.error} />
    </section>
  );
}
