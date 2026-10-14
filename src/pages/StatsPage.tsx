import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { getGame, getLineup } from "../api/games";
import { getGameStats, saveGameStats } from "../api/stats";
import { listRoster } from "../api/teams";
import ErrorMessage from "../components/ErrorMessage";
import LoadingState from "../components/LoadingState";
import Stepper from "../components/Stepper";
import { formatDay, playerName } from "../lib/format";
import { useAction, useApi } from "../lib/useApi";
import { useTrackTeam } from "../team/TeamContext";
import type { Membership, StatInput, StatLine } from "../types";

type Counter = Exclude<keyof StatInput, "membership_id">;
const COUNTERS: { key: Counter; label: string }[] = [
  { key: "at_bats", label: "AB" },
  { key: "singles", label: "1B" },
  { key: "doubles", label: "2B" },
  { key: "triples", label: "3B" },
  { key: "home_runs", label: "HR" },
  { key: "walks", label: "BB" },
  { key: "sac_flies", label: "SF" },
];

const blank = (membershipId: number): StatInput => ({
  membership_id: membershipId,
  at_bats: 0,
  singles: 0,
  doubles: 0,
  triples: 0,
  home_runs: 0,
  walks: 0,
  sac_flies: 0,
});

const hitsOf = (s: StatInput) => s.singles + s.doubles + s.triples + s.home_runs;

export default function StatsPage() {
  const gameId = Number(useParams().gameId);
  const game = useApi(() => getGame(gameId), [gameId]);
  const { team, isManager } = useTrackTeam(game.data?.team_id, game.data?.season);
  const stats = useApi(() => getGameStats(gameId), [gameId]);

  if (game.error || stats.error) {
    return <div className="page"><ErrorMessage error={game.error ?? stats.error} /></div>;
  }
  if (!game.data || !stats.data || !team) return <div className="page"><LoadingState /></div>;

  const g = game.data;
  return (
    <div className="page">
      <div className="page-head">
        <Link to={`/games/${g.id}`} className="back">
          Back to game
        </Link>
        <h1 className="page-title">Stats vs {g.opponent_name}</h1>
        <p className="page-sub">{formatDay(g.scheduled_at)}</p>
      </div>
      {!stats.data.counts_toward_season && (
        <p className="notice">
          {g.status === "cancelled"
            ? "This game was cancelled, so these stats don't count toward the season."
            : "These stats count toward the season once the final score is saved."}
        </p>
      )}
      {stats.data.from_book && (
        <p className="notice">
          This game is scored in the book, so these numbers update from it.{" "}
          <Link to={`/games/${g.id}/book`}>Open the book</Link> to fix a play.
        </p>
      )}
      {isManager && g.status !== "cancelled" && !stats.data.from_book ? (
        <StatsEditor gameId={g.id} teamId={g.team_id} seasonId={g.season} saved={stats.data.players} onSaved={stats.setData} />
      ) : (
        <BoxScore lines={stats.data.players} />
      )}
    </div>
  );
}

function BoxScore({ lines }: { lines: StatLine[] }) {
  if (!lines.length) return <p className="empty">No stats entered for this game.</p>;
  return (
    <div className="table-wrap">
      <table className="stats-table">
        <thead>
          <tr>
            <th scope="col" className="col-name">Player</th>
            <th scope="col">AB</th>
            <th scope="col">H</th>
            <th scope="col">2B</th>
            <th scope="col">3B</th>
            <th scope="col">HR</th>
            <th scope="col">BB</th>
            <th scope="col">SF</th>
            <th scope="col">AVG</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.membership_id}>
              <th scope="row" className="col-name">{playerName(l.display_name, l.jersey_number)}</th>
              <td>{l.at_bats}</td>
              <td>{l.hits}</td>
              <td>{l.doubles}</td>
              <td>{l.triples}</td>
              <td>{l.home_runs}</td>
              <td>{l.walks}</td>
              <td>{l.sac_flies ?? 0}</td>
              <td>{l.batting_average_display}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface EditorProps {
  gameId: number;
  teamId: number;
  seasonId: number;
  saved: StatLine[];
  onSaved: (stats: Awaited<ReturnType<typeof saveGameStats>>) => void;
}

function StatsEditor({ gameId, teamId, seasonId, saved, onSaved }: EditorProps) {
  const lineup = useApi(() => getLineup(gameId), [gameId]);
  const roster = useApi(() => listRoster(teamId, { season: seasonId, includeInactive: true }), [teamId, seasonId]);
  const [rows, setRows] = useState<StatInput[] | null>(null);
  const [dirty, setDirty] = useState(false);
  const [adding, setAdding] = useState("");
  const action = useAction();

  // Start from saved stats; if there are none yet, pre-fill the lineup in batting order.
  useEffect(() => {
    if (rows !== null || !lineup.data) return;
    if (saved.length) {
      setRows(
        saved.map((l) => ({
          membership_id: l.membership_id,
          at_bats: l.at_bats,
          singles: l.singles,
          doubles: l.doubles,
          triples: l.triples,
          home_runs: l.home_runs,
          walks: l.walks,
          sac_flies: l.sac_flies ?? 0,
        })),
      );
    } else {
      setRows(lineup.data.players.map((p) => blank(p.membership_id)));
    }
  }, [rows, saved, lineup.data]);

  if (lineup.error || roster.error) return <ErrorMessage error={lineup.error ?? roster.error} />;
  if (rows === null || !roster.data) return <LoadingState inline />;

  const current = rows;
  const byId = new Map<number, Membership>(roster.data.map((m) => [m.id, m]));
  const listed = new Set(current.map((r) => r.membership_id));
  const addable = roster.data.filter((m) => m.is_active && !listed.has(m.id));
  const invalid = current.filter((r) => hitsOf(r) > r.at_bats).map((r) => r.membership_id);

  const change = (id: number, key: Counter, value: number) => {
    setRows(current.map((r) => (r.membership_id === id ? { ...r, [key]: value } : r)));
    setDirty(true);
  };
  const removeRow = (id: number) => {
    setRows(current.filter((r) => r.membership_id !== id));
    setDirty(true);
  };

  async function handleSave() {
    const result = await action.run(() => saveGameStats(gameId, current));
    if (result) {
      onSaved(result);
      setDirty(false);
    }
  }

  return (
    <>
      {current.length === 0 && <p className="empty">Add the players who batted.</p>}
      <ul className="stat-entry">
        {current.map((row) => {
          const member = byId.get(row.membership_id);
          const name = member ? playerName(member.display_name, member.jersey_number) : `Player ${row.membership_id}`;
          const hits = hitsOf(row);
          return (
            <li key={row.membership_id} className={`stat-card${invalid.includes(row.membership_id) ? " is-invalid" : ""}`}>
              <div className="stat-card-head">
                <span className="stat-card-name">{name}</span>
                <span className="stat-card-line">
                  {hits}-for-{row.at_bats}
                </span>
                <button type="button" className="button button-quiet button-small" onClick={() => removeRow(row.membership_id)}>
                  Remove
                </button>
              </div>
              <div className="stat-card-grid">
                {COUNTERS.map(({ key, label }) => (
                  <Stepper key={key} label={label} value={row[key]} onChange={(v) => change(row.membership_id, key, v)} />
                ))}
              </div>
              {hits > row.at_bats && <p className="field-error">More hits ({hits}) than at-bats ({row.at_bats}).</p>}
            </li>
          );
        })}
      </ul>

      {addable.length > 0 && (
        <div className="form form-inline">
          <label className="field">
            <span>Add a player</span>
            <select value={adding} onChange={(e) => setAdding(e.target.value)}>
              <option value="">Choose…</option>
              {addable.map((m) => (
                <option key={m.id} value={m.id}>
                  {playerName(m.display_name, m.jersey_number)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="button button-quiet"
            disabled={!adding}
            onClick={() => {
              setRows([...current, blank(Number(adding))]);
              setAdding("");
              setDirty(true);
            }}
          >
            Add
          </button>
        </div>
      )}

      <ErrorMessage error={action.error} />
      <div className="sticky-actions">
        <button
          type="button"
          className="button button-primary button-block"
          disabled={action.pending || invalid.length > 0}
          onClick={handleSave}
        >
          {action.pending ? "Saving…" : !dirty && saved.length > 0 ? "Stats saved" : "Save stats"}
        </button>
      </div>
    </>
  );
}
