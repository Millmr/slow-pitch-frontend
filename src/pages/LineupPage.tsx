import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router";
import { getAvailability, getGame, getLineup, saveLineup } from "../api/games";
import { listRoster } from "../api/teams";
import { AvailabilityChip } from "../components/AvailabilityPicker";
import BattingSlot from "../components/BattingSlot";
import ErrorMessage from "../components/ErrorMessage";
import LoadingState from "../components/LoadingState";
import { formatDay, playerName } from "../lib/format";
import { useAction, useApi } from "../lib/useApi";
import { useTrackTeam } from "../team/TeamContext";
import { POSITIONS, type AvailabilityStatus, type Membership, type Position } from "../types";

interface Spot {
  membershipId: number;
  position: Position;
}

// Order positions get handed out when a player is added to the lineup.
const FILL_ORDER: Position[] = ["P", "C", "1B", "2B", "3B", "SS", "LF", "LCF", "RCF", "RF"];
const AVAILABILITY_RANK: Record<AvailabilityStatus | "none", number> = { yes: 0, unsure: 1, none: 2, no: 3 };

function nextOpenPosition(spots: Spot[]): Position {
  const taken = new Set(spots.map((s) => s.position));
  return FILL_ORDER.find((p) => !taken.has(p)) ?? "EH";
}

export default function LineupPage() {
  const gameId = Number(useParams().gameId);
  const game = useApi(() => getGame(gameId), [gameId]);
  const { team, isManager, loading: teamLoading } = useTrackTeam(game.data?.team_id, game.data?.season);
  const lineup = useApi(() => getLineup(gameId), [gameId]);
  const availability = useApi(() => getAvailability(gameId), [gameId]);
  const roster = useApi(
    () => (game.data ? listRoster(game.data.team_id, { season: game.data.season }) : Promise.resolve<Membership[]>([])),
    [game.data?.team_id, game.data?.season],
  );

  const [spots, setSpots] = useState<Spot[] | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const action = useAction();

  // Start from the saved lineup once it arrives.
  useEffect(() => {
    if (lineup.data && spots === null) {
      setSpots(lineup.data.players.map((p) => ({ membershipId: p.membership_id, position: p.defensive_position })));
    }
  }, [lineup.data, spots]);

  const members = useMemo(() => new Map((roster.data ?? []).map((m) => [m.id, m])), [roster.data]);
  const statusOf = useMemo(() => {
    const map = new Map<number, AvailabilityStatus>();
    availability.data?.responses.forEach((r) => r.status && map.set(r.membership_id, r.status));
    return map;
  }, [availability.data]);

  const error = game.error ?? lineup.error ?? roster.error;
  if (error) return <div className="page"><ErrorMessage error={error} /></div>;
  if (!game.data || spots === null || !roster.data || teamLoading || !team) {
    return <div className="page"><LoadingState /></div>;
  }
  if (!isManager) return <Navigate to={`/games/${gameId}`} replace />;

  const current = spots;
  const inLineup = new Set(current.map((s) => s.membershipId));
  const bench = roster.data
    .filter((m) => !inLineup.has(m.id))
    .sort(
      (a, b) =>
        AVAILABILITY_RANK[statusOf.get(a.id) ?? "none"] - AVAILABILITY_RANK[statusOf.get(b.id) ?? "none"] ||
        a.display_name.localeCompare(b.display_name),
    );

  const positionCounts = new Map<Position, number>();
  current.forEach((s) => positionCounts.set(s.position, (positionCounts.get(s.position) ?? 0) + 1));
  const isDuplicate = (p: Position) => p !== "EH" && (positionCounts.get(p) ?? 0) > 1;
  const hasDuplicates = current.some((s) => isDuplicate(s.position));

  const update = (next: Spot[]) => {
    setSpots(next);
    setSavedAt(null);
  };
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= current.length) return;
    const next = [...current];
    [next[index], next[target]] = [next[target], next[index]];
    update(next);
  };
  const add = (membershipId: number) => update([...current, { membershipId, position: nextOpenPosition(current) }]);
  const remove = (index: number) => update(current.filter((_, i) => i !== index));
  const setPosition = (index: number, position: Position) =>
    update(current.map((s, i) => (i === index ? { ...s, position } : s)));
  const addEveryoneIn = () => {
    let next = [...current];
    bench
      .filter((m) => statusOf.get(m.id) === "yes")
      .forEach((m) => {
        next = [...next, { membershipId: m.id, position: nextOpenPosition(next) }];
      });
    update(next);
  };

  async function handleSave() {
    const saved = await action.run(() =>
      saveLineup(
        gameId,
        current.map((s, i) => ({ membership_id: s.membershipId, batting_order: i + 1, defensive_position: s.position })),
      ),
    );
    if (saved) {
      setWarnings(saved.warnings);
      setSavedAt(new Date().toISOString());
    }
  }

  const g = game.data;
  return (
    <div className="page lineup-page">
      <div className="page-head">
        <Link to={`/games/${g.id}`} className="back">
          Back to game
        </Link>
        <h1 className="page-title">Lineup vs {g.opponent_name}</h1>
        <p className="page-sub">{formatDay(g.scheduled_at)}</p>
      </div>

      {current.length === 0 ? (
        <p className="empty">Tap players below to add them in batting order.</p>
      ) : (
        <ol className="lineup-card lineup-editor">
          {current.map((spot, index) => {
            const member = members.get(spot.membershipId);
            const name = member ? playerName(member.display_name, member.jersey_number) : `Player ${spot.membershipId}`;
            return (
              <li key={spot.membershipId} className="lineup-line">
                <BattingSlot order={index + 1} />
                <span className="lineup-name">
                  {name}
                  {statusOf.get(spot.membershipId) === "no" && <span className="tag tag-warn">Said out</span>}
                </span>
                <select
                  className={`position-select${isDuplicate(spot.position) ? " is-duplicate" : ""}`}
                  aria-label={`Position for ${name}`}
                  value={spot.position}
                  onChange={(e) => setPosition(index, e.target.value as Position)}
                >
                  {POSITIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <span className="lineup-moves">
                  <button type="button" aria-label={`Move ${name} up`} disabled={index === 0} onClick={() => move(index, -1)}>
                    ▲
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${name} down`}
                    disabled={index === current.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    ▼
                  </button>
                  <button type="button" aria-label={`Take ${name} out of the lineup`} onClick={() => remove(index)}>
                    ✕
                  </button>
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {hasDuplicates && <p className="notice notice-warn">Two players share a position. Only EH can be used more than once.</p>}
      {warnings.length > 0 && (
        <ul className="notice notice-warn">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
      <ErrorMessage error={action.error} />

      <div className="sticky-actions">
        <button type="button" className="button button-primary button-block" disabled={action.pending || hasDuplicates} onClick={handleSave}>
          {action.pending ? "Saving…" : savedAt ? "Lineup saved" : "Save lineup"}
        </button>
      </div>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">Bench</h2>
          {bench.some((m) => statusOf.get(m.id) === "yes") && (
            <button type="button" className="button button-quiet button-small" onClick={addEveryoneIn}>
              Add everyone who's in
            </button>
          )}
        </div>
        {bench.length === 0 ? (
          <p className="empty">Everyone on the roster is in the lineup.</p>
        ) : (
          <ul className="list">
            {bench.map((m) => (
              <li key={m.id}>
                <button type="button" className="list-row list-button" onClick={() => add(m.id)}>
                  <span className="list-main">
                    {playerName(m.display_name, m.jersey_number)}
                    {m.is_substitute && <span className="tag">Sub</span>}
                  </span>
                  <AvailabilityChip status={statusOf.get(m.id)} />
                  <span className="add-mark" aria-hidden="true">
                    +
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
