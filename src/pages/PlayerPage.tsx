import { Link, useParams, useSearchParams } from "react-router";
import { getPlayerStats } from "../api/stats";
import ErrorMessage from "../components/ErrorMessage";
import LoadingState from "../components/LoadingState";
import { formatDay, playerName } from "../lib/format";
import { useApi } from "../lib/useApi";
import { useTrackTeam } from "../team/TeamContext";

export default function PlayerPage() {
  const membershipId = Number(useParams().membershipId);
  const [params] = useSearchParams();
  const requestedSeason = Number(params.get("season")) || null;
  const stats = useApi(() => getPlayerStats(membershipId, requestedSeason), [membershipId, requestedSeason]);
  useTrackTeam(stats.data?.membership.team, stats.data?.season);

  if (stats.error) return <div className="page"><ErrorMessage error={stats.error} onRetry={stats.reload} /></div>;
  if (!stats.data) return <div className="page"><LoadingState /></div>;

  const { membership, totals, games } = stats.data;
  const tiles = [
    { label: "AVG", value: totals.batting_average_display },
    { label: "OBP", value: totals.on_base_percentage_display },
    { label: "SLG", value: totals.slugging_percentage_display },
    { label: "H", value: totals.hits },
    { label: "HR", value: totals.home_runs },
    { label: "G", value: totals.games_played ?? 0 },
  ];

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">{playerName(membership.display_name, membership.jersey_number)}</h1>
        <p className="page-sub">
          {membership.role === "manager" ? "Manager" : membership.is_substitute ? "Substitute" : "Player"}
          {!membership.is_active && ", no longer active"}
        </p>
      </div>

      <dl className="stat-tiles">
        {tiles.map((t) => (
          <div key={t.label} className="stat-tile">
            <dt>{t.label}</dt>
            <dd>{t.value}</dd>
          </div>
        ))}
      </dl>
      <p className="hint">
        {totals.hits}-for-{totals.at_bats}, {totals.walks} walks, {totals.doubles} doubles, {totals.triples} triples.
      </p>

      <section className="section">
        <h2 className="section-title">Game log</h2>
        {games.length === 0 ? (
          <p className="empty">No games with stats yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="stats-table">
              <thead>
                <tr>
                  <th scope="col" className="col-name">Game</th>
                  <th scope="col">AB</th>
                  <th scope="col">H</th>
                  <th scope="col">HR</th>
                  <th scope="col">BB</th>
                </tr>
              </thead>
              <tbody>
                {games.map((g) => (
                  <tr key={g.game_id} className={g.counts_toward_season ? "" : "is-muted"}>
                    <th scope="row" className="col-name">
                      <Link to={`/games/${g.game_id}`}>
                        {formatDay(g.scheduled_at)} vs {g.opponent_name}
                      </Link>
                      {!g.counts_toward_season && <span className="list-detail">Doesn't count yet</span>}
                    </th>
                    <td>{g.at_bats}</td>
                    <td>{g.hits}</td>
                    <td>{g.home_runs}</td>
                    <td>{g.walks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
