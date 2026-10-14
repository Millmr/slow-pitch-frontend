import { Navigate, Route, Routes } from "react-router";
import AppLayout from "./components/AppLayout";
import RequireAuth from "./components/RequireAuth";
import BookPage from "./pages/BookPage";
import DashboardPage from "./pages/DashboardPage";
import GamePage from "./pages/GamePage";
import LeaderboardPage from "./pages/LeaderboardPage";
import LineupPage from "./pages/LineupPage";
import LoginPage from "./pages/LoginPage";
import NotFoundPage from "./pages/NotFoundPage";
import PlayerPage from "./pages/PlayerPage";
import RosterPage from "./pages/RosterPage";
import SchedulePage from "./pages/SchedulePage";
import StatsPage from "./pages/StatsPage";
import TeamsPage from "./pages/TeamsPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Navigate to="/teams" replace />} />
        <Route path="/teams" element={<TeamsPage />} />
        <Route path="/teams/:teamId" element={<DashboardPage />} />
        <Route path="/teams/:teamId/roster" element={<RosterPage />} />
        <Route path="/seasons/:seasonId/schedule" element={<SchedulePage />} />
        <Route path="/seasons/:seasonId/leaderboard" element={<LeaderboardPage />} />
        <Route path="/games/:gameId" element={<GamePage />} />
        <Route path="/games/:gameId/lineup" element={<LineupPage />} />
        <Route path="/games/:gameId/stats" element={<StatsPage />} />
        <Route path="/games/:gameId/book" element={<BookPage />} />
        <Route path="/players/:membershipId" element={<PlayerPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
