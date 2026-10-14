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

  const signingIn = mode === "signin";

  return (
    <div className="auth">
      <ThemeToggle className="auth-theme" />
      {pending && <LoadingOverlay label={signingIn ? "Signing in…" : "Creating your account…"} />}

      {/* The field: a chalk foul line with the team ball resting on it. */}
      <div className="auth-field" aria-hidden="true">
        <span className="auth-foul-line" />
        <img src="/softball-worn.svg" alt="" className="auth-ball" />
      </div>

      <main className="auth-main">
        {/* The team's script logo, traced from their artwork and tinted by the theme. */}
        <h1 className="auth-wordmark">
          <span className="visually-hidden">Local Boys</span>
        </h1>
        <p className="auth-kicker">Slow-Pitch Organizer</p>
        {!signingIn && <p className="auth-lede">Join your team.</p>}

        <form className="auth-form" onSubmit={handleSubmit}>
          {!signingIn && (
            <div className="auth-row">
              <label className="line-field">
                <span>First name</span>
                <input value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
              </label>
              <label className="line-field">
                <span>Last name</span>
                <input value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
              </label>
            </div>
          )}
          <label className="line-field">
            <span>Username</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              required
            />
          </label>
          <label className="line-field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={signingIn ? "current-password" : "new-password"}
              required
            />
            {!signingIn && <small>At least 8 characters, not all numbers.</small>}
          </label>
          <ErrorMessage error={error} />
          <button type="submit" className="auth-submit" disabled={pending}>
            {signingIn ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="auth-switch">
          {signingIn ? "New here? " : "Already have an account? "}
          <button
            type="button"
            className="link-button"
            onClick={() => {
              setMode(signingIn ? "register" : "signin");
              setError(null);
            }}
          >
            {signingIn ? "Create an account" : "Sign in"}
          </button>
        </p>
        {!signingIn && <p className="auth-note">Once you're signed up, your manager adds you to the roster.</p>}
      </main>
    </div>
  );
}
