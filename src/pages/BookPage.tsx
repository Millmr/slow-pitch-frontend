import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { deletePlay, getBook, getGame, recordPlay, updatePlay } from "../api/games";
import { listRoster } from "../api/teams";
import BattingSlot from "../components/BattingSlot";
import ErrorMessage from "../components/ErrorMessage";
import LoadingState from "../components/LoadingState";
import { formatDay, playerName } from "../lib/format";
import { useAction, useApi } from "../lib/useApi";
import { useTrackTeam } from "../team/TeamContext";
import { PLATE_RESULTS, type Book, type BookPlayer, type Membership, type PlateAppearance, type PlateResult } from "../types";

const RESULT_LABELS: Record<PlateResult, string> = {
  "1B": "Single",
  "2B": "Double",
  "3B": "Triple",
  HR: "Home run",
  BB: "Walk",
  SF: "Sac fly",
  OUT: "Out",
};
const HITS: PlateResult[] = ["1B", "2B", "3B", "HR"];
const AT_BATS: PlateResult[] = ["1B", "2B", "3B", "HR", "OUT"];
const REFRESH_MS = 15000;

function ordinal(n: number): string {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${suffix}`;
}

export default function BookPage() {
  const gameId = Number(useParams().gameId);
  const game = useApi(() => getGame(gameId), [gameId]);
  const { isManager } = useTrackTeam(game.data?.team_id, game.data?.season);
  const book = useApi(() => getBook(gameId), [gameId]);
  const roster = useApi(
    () => (game.data ? listRoster(game.data.team_id, { season: game.data.season }) : Promise.resolve<Membership[]>([])),
    [game.data?.team_id, game.data?.season],
  );

  // Followers (not keeping the book) see new plays without refreshing.
  const canEdit = book.data?.can_edit ?? false;
  const reloadBook = book.reload;
  useEffect(() => {
    if (!book.data || canEdit) return;
    const timer = setInterval(reloadBook, REFRESH_MS);
    return () => clearInterval(timer);
  }, [book.data, canEdit, reloadBook]);

  const error = game.error ?? book.error;
  if (error) return <div className="page"><ErrorMessage error={error} onRetry={book.reload} /></div>;
  if (!game.data || !book.data) return <div className="page"><LoadingState /></div>;

  const g = game.data;
  const b = book.data;
  return (
    <div className="page book-page">
      <div className="page-head">
        <Link to={`/games/${g.id}`} className="back">
          Back to game
        </Link>
        <h1 className="page-title">Book vs {g.opponent_name}</h1>
        <p className="page-sub">{formatDay(g.scheduled_at)}</p>
      </div>

      {g.status === "cancelled" && <p className="notice">This game was cancelled.</p>}
      {g.status === "scheduled" && b.plate_appearances.length > 0 && (
        <p className="notice">
          These stats count toward the season once the final score is saved on the{" "}
          <Link to={`/games/${g.id}`}>game page</Link>.
        </p>
      )}

      {b.can_edit && g.status !== "cancelled" ? (
        <Scorer book={b} roster={roster.data ?? []} isManager={isManager} onChange={book.setData} />
      ) : (
        <Status book={b} />
      )}

      <section className="section">
        <h2 className="section-title">Book</h2>
        <BookGrid book={b} editable={b.can_edit && g.status !== "cancelled"} onChange={book.setData} />
        {!b.can_edit && <p className="hint">Updates every few seconds while the game is being scored.</p>}
      </section>
    </div>
  );
}

function Outs({ outs }: { outs: number }) {
  return (
    <span className="outs" aria-label={`${outs} ${outs === 1 ? "out" : "outs"}`}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={`out-dot${i < outs ? " is-out" : ""}`} aria-hidden="true" />
      ))}
    </span>
  );
}

function Status({ book }: { book: Book }) {
  return (
    <section className="book-status" aria-label="Game state">
      <span className="book-inning">{ordinal(book.inning)} inning</span>
      <Outs outs={book.outs} />
      {book.next_batter && <span className="book-up">Up: {book.next_batter.display_name}</span>}
    </section>
  );
}

interface ScorerProps {
  book: Book;
  roster: Membership[];
  isManager: boolean;
  onChange: (book: Book) => void;
}

/** The live controls: who's up, the result buttons, undo and end inning. */
function Scorer({ book, roster, isManager, onChange }: ScorerProps) {
  const action = useAction();
  const [batterId, setBatterId] = useState<number | null>(null);
  const [inningOverride, setInningOverride] = useState<number | null>(null);

  const inning = inningOverride && inningOverride > book.inning ? inningOverride : book.inning;
  const outs = inning === book.inning ? book.outs : 0;
  const batter: BookPlayer | null =
    (batterId && toPlayer(roster.find((m) => m.id === batterId), book)) || book.next_batter;
  const today = batter ? book.plate_appearances.filter((pa) => pa.membership_id === batter.membership_id) : [];
  const last = book.plate_appearances[book.plate_appearances.length - 1];

  async function record(result: PlateResult) {
    if (!batter) return;
    const updated = await action.run(() =>
      recordPlay(book.game, result, {
        membershipId: batterId ?? undefined,
        inning: inning !== book.inning ? inning : undefined,
      }),
    );
    if (updated) {
      onChange(updated);
      setBatterId(null);
      setInningOverride(null);
    }
  }

  async function undo() {
    if (!last) return;
    const updated = await action.run(async () => {
      await deletePlay(book.game, last.id);
      return getBook(book.game);
    });
    if (updated) onChange(updated);
  }

  return (
    <section className="scorer" aria-label="Keep the book">
      <div className="book-status">
        <span className="book-inning">{ordinal(inning)} inning</span>
        <Outs outs={outs} />
        <button
          type="button"
          className="button button-quiet button-small book-end-inning"
          disabled={action.pending}
          onClick={() => setInningOverride(inning + 1)}
          title="For run limits or a scoring mistake"
        >
          End inning
        </button>
      </div>

      <div className="now-batting">
        <p className="now-batting-label">Now batting</p>
        {batter ? (
          <div className="now-batting-player">
            {batter.batting_order ? <BattingSlot order={batter.batting_order} /> : <span className="pinch">PH</span>}
            <div>
              <p className="now-batting-name">{playerName(batter.display_name, batter.jersey_number)}</p>
              <p className="now-batting-today">
                {today.length ? `Today: ${today.map((pa) => pa.result).join(", ")}` : "First time up today"}
              </p>
            </div>
          </div>
        ) : (
          <p className="empty">
            Pick who's batting{book.lineup.length === 0 && isManager ? ", or " : "."}
            {book.lineup.length === 0 && isManager && <Link to={`/games/${book.game}/lineup`}>build the lineup</Link>}
            {book.lineup.length === 0 && isManager && " so the order runs itself."}
          </p>
        )}
        <label className="field field-inline change-batter">
          <span>{batter ? "Someone else up?" : "Batter"}</span>
          <select value={batterId ?? ""} onChange={(e) => setBatterId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">{book.next_batter ? `${book.next_batter.display_name} (next in order)` : "Choose…"}</option>
            {roster.map((m) => (
              <option key={m.id} value={m.id}>
                {playerName(m.display_name, m.jersey_number)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="result-pad" role="group" aria-label="Result">
        {PLATE_RESULTS.map((result) => (
          <button
            key={result}
            type="button"
            className={`result-button result-button-${result}`}
            disabled={!batter || action.pending}
            onClick={() => record(result)}
          >
            <span className="result-code">{result}</span>
            <span className="result-name">{RESULT_LABELS[result]}</span>
          </button>
        ))}
      </div>
      <ErrorMessage error={action.error} />

      <div className="scorer-footer">
        <span className="on-deck">{book.on_deck && !batterId ? `On deck: ${book.on_deck.display_name}` : ""}</span>
        {last && (
          <button type="button" className="button button-quiet button-small" disabled={action.pending} onClick={undo}>
            Undo {last.display_name}'s {last.result}
          </button>
        )}
      </div>
    </section>
  );
}

function toPlayer(member: Membership | undefined, book: Book): BookPlayer | null {
  if (!member) return null;
  const spot = book.lineup.find((p) => p.membership_id === member.id);
  return {
    membership_id: member.id,
    display_name: member.display_name,
    jersey_number: member.jersey_number,
    batting_order: spot?.batting_order,
  };
}

/** Rows of batters by innings, like the paper scorebook. Tap a play to fix it. */
function BookGrid({ book, editable, onChange }: { book: Book; editable: boolean; onChange: (book: Book) => void }) {
  const [selected, setSelected] = useState<PlateAppearance | null>(null);
  const action = useAction();

  const pas = book.plate_appearances;
  if (!pas.length) return <p className="empty">No plays recorded yet.</p>;

  // Lineup order first, then anyone else who batted (pinch hitters).
  const rows: BookPlayer[] = [...book.lineup];
  pas.forEach((pa) => {
    if (!rows.some((r) => r.membership_id === pa.membership_id)) rows.push(pa);
  });
  const lastInning = Math.max(book.inning, ...pas.map((pa) => pa.inning));
  const innings = Array.from({ length: lastInning }, (_, i) => i + 1);

  async function change(play: PlateAppearance, result: PlateResult | "delete") {
    const updated = await action.run(async () => {
      if (result === "delete") {
        await deletePlay(book.game, play.id);
        return getBook(book.game);
      }
      return updatePlay(book.game, play.id, { result });
    });
    if (updated) {
      onChange(updated);
      setSelected(null);
    }
  }

  return (
    <>
      <div className="table-wrap">
        <table className="book-grid">
          <thead>
            <tr>
              <th scope="col" className="col-name">Batter</th>
              {innings.map((n) => (
                <th key={n} scope="col">{n}</th>
              ))}
              <th scope="col" title="Hits for at-bats">H-AB</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const mine = pas.filter((pa) => pa.membership_id === row.membership_id);
              const hits = mine.filter((pa) => HITS.includes(pa.result)).length;
              const atBats = mine.filter((pa) => AT_BATS.includes(pa.result)).length;
              return (
                <tr key={row.membership_id}>
                  <th scope="row" className="col-name">
                    {row.batting_order ? <span className="book-order">{row.batting_order}</span> : null}
                    {row.display_name}
                  </th>
                  {innings.map((n) => (
                    <td key={n}>
                      {mine
                        .filter((pa) => pa.inning === n)
                        .map((pa) =>
                          editable ? (
                            <button
                              key={pa.id}
                              type="button"
                              className={`play play-${pa.result}${selected?.id === pa.id ? " is-selected" : ""}`}
                              aria-label={`${row.display_name}, inning ${n}: ${RESULT_LABELS[pa.result]}. Change`}
                              onClick={() => setSelected(selected?.id === pa.id ? null : pa)}
                            >
                              {pa.result}
                            </button>
                          ) : (
                            <span key={pa.id} className={`play play-${pa.result}`}>
                              {pa.result}
                            </span>
                          ),
                        )}
                    </td>
                  ))}
                  <td className="book-total">{atBats || hits ? `${hits}-${atBats}` : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="play-editor" role="dialog" aria-label="Change play">
          <p className="play-editor-title">
            {selected.display_name}, {ordinal(selected.inning)} inning: {RESULT_LABELS[selected.result]}
          </p>
          <div className="play-editor-options">
            {PLATE_RESULTS.filter((r) => r !== selected.result).map((r) => (
              <button key={r} type="button" className="button button-quiet button-small" disabled={action.pending} onClick={() => change(selected, r)}>
                {r}
              </button>
            ))}
            <button type="button" className="button button-danger button-small" disabled={action.pending} onClick={() => change(selected, "delete")}>
              Remove
            </button>
            <button type="button" className="button button-quiet button-small" onClick={() => setSelected(null)}>
              Cancel
            </button>
          </div>
          <ErrorMessage error={action.error} />
        </div>
      )}
    </>
  );
}
