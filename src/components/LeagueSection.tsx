import { useState, type FormEvent } from "react";
import { getLeague, linkLeague, previewLeague, syncLeague, unlinkLeague } from "../api/teams";
import { useAction, useApi } from "../lib/useApi";
import type { League, LeaguePreview, LeagueSyncSummary } from "../types";
import ErrorMessage from "./ErrorMessage";

interface Props {
  seasonId: number;
  teamName: string;
  isManager: boolean;
  /** Called after a sync changes games, so the schedule reloads. */
  onSynced: () => void;
}

/** League standings plus the link/sync controls for the season's league schedule. */
export default function LeagueSection({ seasonId, teamName, isManager, onSynced }: Props) {
  const league = useApi(() => getLeague(seasonId), [seasonId]);
  const [summary, setSummary] = useState<LeagueSyncSummary | null>(null);

  if (!league.data) return null; // quiet while loading; the schedule is the main thing here
  const data = league.data;

  const synced = (next: League & { sync?: LeagueSyncSummary }) => {
    league.setData(next);
    if (next.sync) setSummary(next.sync);
    onSynced();
  };

  if (!data.linked) {
    return isManager ? <LinkLeague seasonId={seasonId} teamName={teamName} onLinked={synced} /> : null;
  }

  return (
    <section className="section league">
      <div className="section-head">
        <h2 className="section-title">Standings</h2>
        {isManager && <SyncButton seasonId={seasonId} onSynced={synced} />}
      </div>
      {summary && <SyncSummary summary={summary} onDismiss={() => setSummary(null)} />}
      {data.standings.length > 0 ? (
        <Standings league={data} />
      ) : (
        <p className="empty">The league hasn't posted standings yet.</p>
      )}
      <p className="league-meta">
        {data.league_name && <span>{data.league_name}</span>}
        <span>
          {data.synced_at ? `Updated ${timeAgo(data.synced_at)}` : "Not synced yet"}
          {" · "}
          <a href={data.url} target="_blank" rel="noreferrer">
            League page
          </a>
        </span>
      </p>
      {isManager && <Unlink seasonId={seasonId} onUnlinked={(next) => league.setData(next)} />}
    </section>
  );
}

function Standings({ league }: { league: League }) {
  return (
    <div className="table-wrap">
      <table className="stats-table standings">
        <thead>
          <tr>
            <th scope="col" className="col-rank">#</th>
            <th scope="col" className="col-name">Team</th>
            <th scope="col">W</th>
            <th scope="col">L</th>
            <th scope="col">GB</th>
            <th scope="col" className="col-streak">Streak</th>
          </tr>
        </thead>
        <tbody>
          {league.standings.map((row) => (
            <tr key={row.team} className={row.is_us ? "is-us" : undefined} aria-current={row.is_us || undefined}>
              <td className="col-rank">{row.place}</td>
              <th scope="row" className="col-name">{row.team}</th>
              <td>{row.wins}</td>
              <td>{row.losses}</td>
              <td>{row.games_back === "--" ? "–" : row.games_back}</td>
              <td className="col-streak">{shortStreak(row.streak)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SyncButton({ seasonId, onSynced }: { seasonId: number; onSynced: (league: League) => void }) {
  const action = useAction();
  return (
    <div className="league-sync">
      <button
        type="button"
        className="button button-quiet button-small"
        disabled={action.pending}
        onClick={async () => {
          const next = await action.run(() => syncLeague(seasonId));
          if (next) onSynced(next);
        }}
      >
        {action.pending ? "Syncing…" : "Sync now"}
      </button>
      <ErrorMessage error={action.error} />
    </div>
  );
}

function SyncSummary({ summary, onDismiss }: { summary: LeagueSyncSummary; onDismiss: () => void }) {
  const parts = [
    summary.created && `${summary.created} new ${summary.created === 1 ? "game" : "games"}`,
    summary.updated && `${summary.updated} updated`,
    summary.scored && `${summary.scored} ${summary.scored === 1 ? "score" : "scores"} filled in`,
    summary.cancelled && `${summary.cancelled} cancelled`,
  ].filter(Boolean);
  return (
    <div className="notice league-summary" role="status">
      <p>{parts.length ? `Synced: ${parts.join(", ")}.` : "Synced. Everything was already up to date."}</p>
      {summary.notes.length > 0 && (
        <ul>
          {summary.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
      <button type="button" className="link-button" onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  );
}

function LinkLeague({
  seasonId,
  teamName,
  onLinked,
}: {
  seasonId: number;
  teamName: string;
  onLinked: (league: League) => void;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<LeaguePreview | null>(null);
  const [team, setTeam] = useState("");
  const action = useAction();

  async function findTeams(event: FormEvent) {
    event.preventDefault();
    const result = await action.run(() => previewLeague(seasonId, url.trim()));
    if (result) {
      setPreview(result);
      const match = result.teams.find((name) => name.toLowerCase() === teamName.toLowerCase());
      setTeam(match ?? "");
    }
  }

  async function link(event: FormEvent) {
    event.preventDefault();
    const result = await action.run(() => linkLeague(seasonId, url.trim(), team));
    if (result) onLinked(result);
  }

  if (!open) {
    return (
      <section className="section">
        <div className="league-cta">
          <div>
            <h2 className="section-title">Use the league schedule</h2>
            <p className="hint">Paste your TeamSideline link to pull in every game, field, score and the standings.</p>
          </div>
          <button type="button" className="button button-primary" onClick={() => setOpen(true)}>
            Link league
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="section">
      <h2 className="section-title">Link the league schedule</h2>
      {!preview ? (
        <form className="form" onSubmit={findTeams}>
          <label className="field">
            <span>TeamSideline schedule link</span>
            <input
              type="url"
              inputMode="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://teamsideline.com/common/StandingsResultsPrintView.aspx?d=…"
              required
            />
            <small>Open your league on TeamSideline, choose the printable standings and schedule, and copy that link.</small>
          </label>
          <ErrorMessage error={action.error} />
          <div className="form-actions">
            <button type="submit" className="button button-primary" disabled={action.pending || !url.trim()}>
              {action.pending ? "Reading the league page…" : "Find our team"}
            </button>
            <button type="button" className="button button-quiet" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <form className="form" onSubmit={link}>
          <p className="hint">{preview.league_name}</p>
          <label className="field">
            <span>Which team is yours?</span>
            <select value={team} onChange={(e) => setTeam(e.target.value)} required>
              <option value="" disabled>
                Choose…
              </option>
              {preview.teams.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <p className="hint">
            Your games, fields and posted scores are added to this season. Lineups, roll call and the book are
            never touched, and a score you've entered here always wins over the league's.
          </p>
          <ErrorMessage error={action.error} />
          <div className="form-actions">
            <button type="submit" className="button button-primary" disabled={action.pending || !team}>
              {action.pending ? "Importing…" : "Link and import"}
            </button>
            <button type="button" className="button button-quiet" onClick={() => setPreview(null)}>
              Back
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function Unlink({ seasonId, onUnlinked }: { seasonId: number; onUnlinked: (league: League) => void }) {
  const action = useAction();
  return (
    <p className="league-unlink">
      <button
        type="button"
        className="link-button"
        disabled={action.pending}
        onClick={async () => {
          if (!window.confirm("Stop syncing from the league page? Games already imported stay on the schedule.")) return;
          const next = await action.run(() => unlinkLeague(seasonId));
          if (next) onUnlinked(next);
        }}
      >
        Unlink league
      </button>
      <ErrorMessage error={action.error} />
    </p>
  );
}

/** "Won 3" -> "W3", "Lost 10" -> "L10". */
function shortStreak(streak: string): string {
  const match = /^(won|lost|tied?)\s+(\d+)$/i.exec(streak.trim());
  if (!match) return streak;
  return `${match[1][0].toUpperCase()}${match[2]}`;
}

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

function timeAgo(iso: string): string {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return "just now";
}
