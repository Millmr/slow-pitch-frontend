import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import { getAvailability, listGames } from "../api/games";
import { addRosterMember, listRoster, updateMembership } from "../api/teams";
import { AvailabilityChip } from "../components/AvailabilityPicker";
import ErrorMessage from "../components/ErrorMessage";
import LoadingState from "../components/LoadingState";
import { formatDay, formatTime, upcomingGames } from "../lib/format";
import { useAction, useApi } from "../lib/useApi";
import { useTrackTeam } from "../team/TeamContext";
import type { Availability, AvailabilityStatus, Game, Membership, Role } from "../types";

type Filter = "all" | AvailabilityStatus | "none";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Games in the next 7 days; if there are none, just the next game on the schedule. */
function gamesThisWeek(games: Game[]): { games: Game[]; isThisWeek: boolean } {
  const upcoming = upcomingGames(games);
  const week = upcoming.filter((g) => new Date(g.scheduled_at).getTime() - Date.now() <= WEEK_MS);
  return week.length ? { games: week, isThisWeek: true } : { games: upcoming.slice(0, 1), isThisWeek: false };
}

export default function RosterPage() {
  const { team, season, isManager, error } = useTrackTeam(Number(useParams().teamId));
  const seasonId = season?.id ?? null;

  // Wait for the team to load so we know the season and whether you're a manager.
  const roster = useApi(
    () => (team ? listRoster(team.id, { season: seasonId, includeInactive: isManager }) : Promise.resolve<Membership[]>([])),
    [team?.id, seasonId, isManager],
  );
  const [editingId, setEditingId] = useState<number | null>(null);

  // Who's coming to this week's game.
  const games = useApi(
    () => (season ? listGames(season.id, "scheduled") : Promise.resolve<Game[]>([])),
    [season?.id],
  );
  const week = gamesThisWeek(games.data ?? []);
  const [chosenGameId, setChosenGameId] = useState<number | null>(null);
  const game = week.games.find((g) => g.id === chosenGameId) ?? week.games[0] ?? null;
  const availability = useApi(
    () => (game ? getAvailability(game.id) : Promise.resolve<Availability | null>(null)),
    [game?.id],
  );
  const statusOf = new Map<number, AvailabilityStatus>();
  availability.data?.responses.forEach((r) => r.status && statusOf.set(r.membership_id, r.status));
  const [filter, setFilter] = useState<Filter>("all");

  const members = roster.data ?? [];
  const active = members.filter((m) => m.is_active);
  const inactive = members.filter((m) => !m.is_active);
  const filterOf = (m: Membership): Filter => statusOf.get(m.id) ?? (m.is_substitute ? "all" : "none");
  const shown = game && availability.data && filter !== "all" ? active.filter((m) => filterOf(m) === filter) : active;

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Roster</h1>
        {season && <p className="page-sub">{season.name}</p>}
      </div>

      <ErrorMessage error={error ?? roster.error} onRetry={roster.reload} />
      {(!team || roster.loading) && !error && active.length === 0 && <LoadingState />}

      {team && !roster.loading && roster.data && active.length === 0 && (
        <p className="empty">{isManager ? "Add your players below." : "No one's on the roster yet."}</p>
      )}

      {game && active.length > 0 && (
        <WeekBar
          games={week.games}
          game={game}
          isThisWeek={week.isThisWeek}
          onChooseGame={(id) => {
            setChosenGameId(id);
            setFilter("all");
          }}
          members={active}
          filterOf={filterOf}
          filter={filter}
          onFilter={setFilter}
          loading={availability.loading && !availability.data}
        />
      )}
      <ErrorMessage error={availability.error} onRetry={availability.reload} />

      {active.length > 0 && shown.length === 0 && (
        <p className="empty">
          Nobody here.{" "}
          <button type="button" className="link-button" onClick={() => setFilter("all")}>
            Show everyone
          </button>
        </p>
      )}

      {shown.length > 0 && (
        <ul className="list roster">
          {shown.map((member) => (
            <RosterRow
              key={member.id}
              member={member}
              status={game && availability.data ? statusOf.get(member.id) ?? null : undefined}
              canEdit={isManager}
              editing={editingId === member.id}
              onEdit={() => setEditingId(editingId === member.id ? null : member.id)}
              onSaved={() => {
                setEditingId(null);
                roster.reload();
              }}
            />
          ))}
        </ul>
      )}

      {isManager && team && <AddPlayer teamId={team.id} seasonId={seasonId} onAdded={roster.reload} />}

      {isManager && inactive.length > 0 && (
        <section className="section">
          <h2 className="section-title">No longer active</h2>
          <ul className="list roster">
            {inactive.map((member) => (
              <RosterRow
                key={member.id}
                member={member}
                canEdit
                editing={editingId === member.id}
                onEdit={() => setEditingId(editingId === member.id ? null : member.id)}
                onSaved={() => {
                  setEditingId(null);
                  roster.reload();
                }}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

const FILTERS: { key: Exclude<Filter, "all">; label: string }[] = [
  { key: "yes", label: "In" },
  { key: "unsure", label: "Maybe" },
  { key: "no", label: "Out" },
  { key: "none", label: "No answer" },
];

interface WeekBarProps {
  games: Game[];
  game: Game;
  isThisWeek: boolean;
  onChooseGame: (gameId: number) => void;
  members: Membership[];
  filterOf: (member: Membership) => Filter;
  filter: Filter;
  onFilter: (filter: Filter) => void;
  loading: boolean;
}

/** This week's game with In / Maybe / Out / No answer counts that filter the roster. */
function WeekBar({ games, game, isThisWeek, onChooseGame, members, filterOf, filter, onFilter, loading }: WeekBarProps) {
  const count = (key: Filter) => members.filter((m) => filterOf(m) === key).length;
  return (
    <section className="week-bar" aria-label="Availability">
      <div className="week-bar-head">
        <div>
          <p className="week-bar-label">{isThisWeek ? "This week" : "Next game"}</p>
          <Link to={`/games/${game.id}`} className="week-bar-game">
            vs {game.opponent_name}
          </Link>
          <p className="week-bar-when">
            {formatDay(game.scheduled_at)}, {formatTime(game.scheduled_at)}
          </p>
        </div>
        {games.length > 1 && (
          <label className="field week-bar-pick">
            <span className="visually-hidden">Game</span>
            <select value={game.id} onChange={(e) => onChooseGame(Number(e.target.value))}>
              {games.map((g) => (
                <option key={g.id} value={g.id}>
                  {formatDay(g.scheduled_at)} vs {g.opponent_name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="week-bar-counts" role="group" aria-label="Show players who are">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={`count count-${key}`}
            aria-pressed={filter === key}
            disabled={loading}
            onClick={() => onFilter(filter === key ? "all" : key)}
          >
            <span className="count-number">{loading ? "–" : count(key)}</span>
            <span className="count-label">{label}</span>
          </button>
        ))}
      </div>
      {filter !== "all" && (
        <button type="button" className="link-button week-bar-clear" onClick={() => onFilter("all")}>
          Show everyone
        </button>
      )}
    </section>
  );
}

interface RowProps {
  member: Membership;
  /** Availability for the selected game: undefined when there's no game, null for no answer. */
  status?: AvailabilityStatus | null;
  canEdit: boolean;
  editing: boolean;
  onEdit: () => void;
  onSaved: () => void;
}

function RosterRow({ member, status, canEdit, editing, onEdit, onSaved }: RowProps) {
  return (
    <li className={`roster-row${member.is_active ? "" : " is-inactive"}`}>
      <div className="list-row">
        <span className="jersey">{member.jersey_number ?? "–"}</span>
        <div className="list-main">
          <Link to={`/players/${member.id}`} className="roster-name">
            {member.display_name}
          </Link>
          {(member.role !== "player" || member.is_substitute || !member.account) && (
            <span className="roster-tags">
              {member.role === "manager" && <span className="tag">Manager</span>}
              {member.role === "scorekeeper" && <span className="tag">Scorekeeper</span>}
              {member.is_substitute && <span className="tag">Sub</span>}
              {!member.account && <span className="tag tag-quiet">No account</span>}
            </span>
          )}
        </div>
        {status !== undefined && !(status === null && member.is_substitute) && <AvailabilityChip status={status} />}
        {canEdit && (
          <button type="button" className="button button-quiet button-small" aria-expanded={editing} onClick={onEdit}>
            {editing ? "Close" : "Edit"}
          </button>
        )}
      </div>
      {editing && <EditMember member={member} onSaved={onSaved} />}
    </li>
  );
}

function EditMember({ member, onSaved }: { member: Membership; onSaved: () => void }) {
  const [name, setName] = useState(member.display_name);
  const [jersey, setJersey] = useState(member.jersey_number?.toString() ?? "");
  const [role, setRole] = useState<Role>(member.role);
  const [isSub, setIsSub] = useState(member.is_substitute);
  const [isActive, setIsActive] = useState(member.is_active);
  const [username, setUsername] = useState(member.account ?? "");
  const action = useAction();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const saved = await action.run(() =>
      updateMembership(member.id, {
        display_name: name.trim(),
        jersey_number: jersey === "" ? null : Number(jersey),
        role,
        is_substitute: isSub,
        is_active: isActive,
        username: username.trim(),
      }),
    );
    if (saved) onSaved();
  }

  return (
    <form className="form roster-edit" onSubmit={handleSubmit}>
      <div className="form-row">
        <label className="field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="field field-narrow">
          <span>Jersey</span>
          <input type="number" inputMode="numeric" min={0} value={jersey} onChange={(e) => setJersey(e.target.value)} />
        </label>
      </div>
      <div className="form-row">
        <label className="field">
          <span>Role</span>
          <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="player">Player</option>
            <option value="scorekeeper">Scorekeeper (keeps the book)</option>
            <option value="manager">Manager</option>
          </select>
        </label>
        <label className="field">
          <span>Linked account</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Their username"
            autoCapitalize="none"
          />
        </label>
      </div>
      <label className="check">
        <input type="checkbox" checked={isSub} onChange={(e) => setIsSub(e.target.checked)} />
        Substitute (not expected at every game)
      </label>
      <label className="check">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        Active on the roster
      </label>
      <ErrorMessage error={action.error} />
      <div className="form-actions">
        <button type="submit" className="button button-primary" disabled={action.pending}>
          Save changes
        </button>
      </div>
    </form>
  );
}

function AddPlayer({ teamId, seasonId, onAdded }: { teamId: number; seasonId: number | null; onAdded: () => void }) {
  const [name, setName] = useState("");
  const [jersey, setJersey] = useState("");
  const [username, setUsername] = useState("");
  const [isSub, setIsSub] = useState(false);
  const [everySeason, setEverySeason] = useState(false);
  const action = useAction();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const added = await action.run(() =>
      addRosterMember(teamId, {
        display_name: name.trim() || undefined,
        username: username.trim() || undefined,
        jersey_number: jersey === "" ? null : Number(jersey),
        is_substitute: isSub,
        season: everySeason ? null : seasonId,
      }),
    );
    if (added) {
      setName("");
      setJersey("");
      setUsername("");
      setIsSub(false);
      onAdded();
    }
  }

  return (
    <section className="section">
      <h2 className="section-title">Add a player</h2>
      <form className="form" onSubmit={handleSubmit}>
        <div className="form-row">
          <label className="field">
            <span>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sam Rivera" />
          </label>
          <label className="field field-narrow">
            <span>Jersey</span>
            <input type="number" inputMode="numeric" min={0} value={jersey} onChange={(e) => setJersey(e.target.value)} />
          </label>
        </div>
        <label className="field">
          <span>Username (if they've signed up)</span>
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" />
          <small>Leave blank to add them now and link their account later.</small>
        </label>
        <label className="check">
          <input type="checkbox" checked={isSub} onChange={(e) => setIsSub(e.target.checked)} />
          Substitute
        </label>
        <label className="check">
          <input type="checkbox" checked={everySeason} onChange={(e) => setEverySeason(e.target.checked)} />
          On the team every season, not just this one
        </label>
        <ErrorMessage error={action.error} />
        <div className="form-actions">
          <button type="submit" className="button button-primary" disabled={action.pending || (!name.trim() && !username.trim())}>
            Add player
          </button>
        </div>
      </form>
    </section>
  );
}
