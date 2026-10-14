import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as authApi from "../api/auth";
import { getToken, setToken, setUnauthorizedHandler } from "../api/client";
import type { User } from "../types";

interface AuthValue {
  token: string | null;
  user: User | null;
  signIn: (username: string, password: string) => Promise<void>;
  register: (input: authApi.RegisterInput) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(getToken);
  const [user, setUser] = useState<User | null>(null);

  const clear = useCallback(() => {
    setToken(null);
    setTokenState(null);
    setUser(null);
  }, []);

  // A 401 anywhere means the token is no longer valid: drop it so
  // RequireAuth sends the user back to the sign-in screen.
  useEffect(() => {
    setUnauthorizedHandler(clear);
    return () => setUnauthorizedHandler(null);
  }, [clear]);

  useEffect(() => {
    if (!token || user) return;
    authApi.getMe().then(setUser, () => undefined);
  }, [token, user]);

  const accept = useCallback((response: { token: string; user: User }) => {
    setToken(response.token);
    setTokenState(response.token);
    setUser(response.user);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      token,
      user,
      signIn: async (username, password) => accept(await authApi.login(username, password)),
      register: async (input) => accept(await authApi.register(input)),
      signOut: async () => {
        try {
          await authApi.logout();
        } catch {
          // Signing out locally is what matters; ignore network errors.
        }
        clear();
      },
    }),
    [token, user, accept, clear],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
