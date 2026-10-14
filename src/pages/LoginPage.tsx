import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router";
import { toApiError, wakeServer } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import ErrorMessage from "../components/ErrorMessage";
import LoadingOverlay from "../components/LoadingOverlay";
import ThemeToggle from "../components/ThemeToggle";

type Mode = "signin" | "register";

export default function LoginPage() {
  const { token, signIn, register } = useAuth();
  const navigate = useNavigate();
  // Signing in always starts at the team list.
  const next = "/teams";

  const [mode, setMode] = useState<Mode>("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Start waking the API now so it's ready by the time the form is submitted.
  useEffect(() => {
    if (!token) wakeServer();
  }, [token]);

  if (token) return <Navigate to={next} replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      if (mode === "signin") await signIn(username.trim(), password);
      else await register({ username: username.trim(), password, first_name: firstName.trim(), last_name: lastName.trim() });
      navigate(next, { replace: true });
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="auth">
      <ThemeToggle className="auth-theme" />
      {pending && <LoadingOverlay label={mode === "signin" ? "Signing in…" : "Creating your account…"} />}
      <div className="auth-panel">
        <div className="auth-brand">
          <img src="/softball-worn.svg" alt="" width={132} height={132} className="auth-ball" />
          <h1>Slow-Pitch</h1>
          <p>Lineups, availability and stats for your rec team.</p>
        </div>

        <div className="segmented" role="tablist" aria-label="Account">
          <button type="button" role="tab" aria-selected={mode === "signin"} onClick={() => setMode("signin")}>
            Sign in
          </button>
          <button type="button" role="tab" aria-selected={mode === "register"} onClick={() => setMode("register")}>
            Create account
          </button>
        </div>

        <form className="form" onSubmit={handleSubmit}>
          {mode === "register" && (
            <div className="form-row">
              <label className="field">
                <span>First name</span>
                <input value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
              </label>
              <label className="field">
                <span>Last name</span>
                <input value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
              </label>
            </div>
          )}
          <label className="field">
            <span>Username</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              required
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
            />
            {mode === "register" && <small>At least 8 characters, not all numbers.</small>}
          </label>
          <ErrorMessage error={error} />
          <button type="submit" className="button button-primary button-block" disabled={pending}>
            {mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}
