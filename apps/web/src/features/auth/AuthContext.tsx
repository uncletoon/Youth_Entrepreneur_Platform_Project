import type { AuthUser, LoginInput, RegisterInput } from '@yersps/contracts';
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from './auth-api';

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  initializing: boolean;
  register(input: RegisterInput): Promise<AuthUser>;
  login(input: LoginInput): Promise<AuthUser>;
  logout(): Promise<void>;
  refreshUser(): Promise<AuthUser | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let active = true;
    authApi
      .refresh()
      .then((payload) => {
        if (!active) return;
        setUser(payload.user);
        setAccessToken(payload.accessToken);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setInitializing(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      initializing,
      async register(input) {
        const payload = await authApi.register(input);
        setUser(payload.user);
        setAccessToken(payload.accessToken);
        return payload.user;
      },
      async login(input) {
        const payload = await authApi.login(input);
        setUser(payload.user);
        setAccessToken(payload.accessToken);
        return payload.user;
      },
      async logout() {
        try {
          await authApi.logout();
        } finally {
          setUser(null);
          setAccessToken(null);
        }
      },
      async refreshUser() {
        if (!accessToken) return null;
        const refreshed = await authApi.me(accessToken);
        setUser(refreshed);
        return refreshed;
      },
    }),
    [accessToken, initializing, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
};
