import { Link, useParams, useSearchParams } from "react-router";
import { getLeaderboard } from "../api/stats";
import { getSeason } from "../api/teams";
import ErrorMessage from "../components/ErrorMessage";
import LoadingState from "../components/LoadingState";
import { useApi } from "../lib/useApi";
import { useTrackTeam } from "../team/TeamContext";
import type { LeaderboardSort, StatLine } from "../types";

interface Column {
  key: LeaderboardSort;
  label: string;
  title: string;
  value: (line: StatLine) => string | number;
}

const COLUMNS: Column[] = [
  { key: "games_played", label: "G", title: "Games played", value: (l) => l.games_played ?? 0 },
  { key: "at_bats", label: "AB", title: "At-bats", value: (l) => l.at_bats },
  { key: "hits", label: "H", title: "Hits", value: (l) => l.hits },
  { key: "doubles", label: "2B", title: "Doubles", value: (l) => l.doubles },
  { key: "triples", label: "3B", title: "Triples", value: (l) => l.triples },
  { key: "home_runs", label: "HR", title: "Home runs", value: (l) => l.home_runs },
  { key: "walks", label: "BB", title: "Walks", value: (l) => l.walks },
  { key: "batting_average", label: "AVG", title: "Batting average", value: (l) => l.batting_average_display },
  { key: "on_base_percentage", label: "OBP", title: "On-base percentage", value: (l) => l.on_base_percentage_display },
  { key: "slugging_percentage", label: "SLG", title: "Slugging percentage", value: (l) => l.slugging_percentage_display },
];

export default function LeaderboardPage() {
  const seasonId = Number(useParams().seasonId);
  const [params, setParams] = useSearchParams();
  const sort = (COLUMNS.find((c) => c.key === params.get("sort"))?.key ?? "batting_average") as LeaderboardSort;

  const season = useApi(() => getSeason(seasonId), [seasonId]);
  useTrackTeam(season.data?.team, seasonId);
  const board = useApi(() => getLeaderboard(seasonId, sort), [seasonId, sort]);

  const setSort = (key: LeaderboardSort) => setParams({ sort: key }, { replace: true });
  const sorted = COLUMNS.find((c) => c.key === sort)!;
  // The stat you're ranking by sits next to the name so it's visible on a phone.
  const columns = [sorted, ...COLUMNS.filter((c) => c !== sorted)];

  return (
    <div className="page page-wide">
      <div className="page-head">
        <h1 className="page-title">Leaderboard</h1>
        {season.data && <p className="page-sub">{season.data.name}, ranked by {sorted.title.toLowerCase()}</p>}
      </div>

      <label className="field field-inline sort-picker">
        <span>Rank by</span>
        <select value={sort} onChange={(e) => setSort(e.target.value as LeaderboardSort)}>
          {COLUMNS.map((c) => (
            <option key={c.key} value={c.key}>
              {c.title}
            </option>
          ))}
        </select>
      </label>

      <ErrorMessage error={season.error ?? board.error} onRetry={board.reload} />
      {board.loading && !board.data && <LoadingState />}

      {board.data && board.data.players.length === 0 && (
        <p className="empty">Stats show up here once a game has a final score and player stats.</p>
      )}

      {board.data && board.data.players.length > 0 && (
        <>
          <div className="table-wrap">
            <table className="stats-table leaderboard">
              <thead>
                <tr>
                  <th scope="col" className="col-rank">#</th>
                  <th scope="col" className="col-name">Player</th>
                  {columns.map((c) => (
                    <th key={c.key} scope="col" aria-sort={c.key === sort ? "descending" : undefined}>
                      <button type="button" title={`Rank by ${c.title.toLowerCase()}`} className={c.key === sort ? "is-sorted" : ""} onClick={() => setSort(c.key)}>
                        {c.label}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {board.data.players.map((line) => (
                  <tr key={line.membership_id}>
                    <td className="col-rank">{line.rank}</td>
                    <th scope="row" className="col-name">
                      <Link to={`/players/${line.membership_id}?season=${seasonId}`}>{line.display_name}</Link>
                    </th>
                    {columns.map((c) => (
                      <td key={c.key} className={c.key === sort ? "is-sorted" : ""}>
                        {c.value(line)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint">Completed games only. {board.data.obp_note}</p>
        </>
      )}
    </div>
  );
}
