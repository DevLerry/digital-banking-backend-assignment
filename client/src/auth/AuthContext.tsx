import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api, setUnauthorizedHandler } from '../api/client';
import { tokenStore } from '../api/tokenStore';
import type { Customer } from '../api/types';

/**
 * WHO IS LOGGED IN — held once, for the whole app.
 *
 * Without this, every screen that needs the customer's name would fetch it
 * again, and logging out would mean remembering to clear state in a dozen
 * places. React Context lets one value be read anywhere below the provider
 * without passing it down through every component in between ("prop drilling").
 */

interface AuthState {
  customer: Customer | null;
  /** True only while we are checking an existing token on first load. */
  initialising: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    email: string; password: string; firstName: string; lastName: string; phone: string;
  }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [initialising, setInitialising] = useState(true);

  const logout = useCallback(() => {
    tokenStore.clear();
    setCustomer(null);
  }, []);

  /**
   * Restore the session on page load.
   *
   * A token in localStorage is a CLAIM, not proof — it may be expired or
   * revoked. So we ask the server who it belongs to via /api/auth/me. If the
   * server disagrees, the client() helper clears it and we stay logged out.
   */
  useEffect(() => {
    setUnauthorizedHandler(logout);

    const token = tokenStore.get();
    if (!token) {
      setInitialising(false);
      return;
    }

    api
      .me()
      .then((res) => setCustomer(res.customer))
      .catch(() => tokenStore.clear())
      .finally(() => setInitialising(false));
  }, [logout]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login({ email, password });
    tokenStore.set(res.token);
    setCustomer(res.customer);
  }, []);

  const register = useCallback(
    async (input: {
      email: string; password: string; firstName: string; lastName: string; phone: string;
    }) => {
      const res = await api.register(input);
      tokenStore.set(res.token);
      setCustomer(res.customer);
    },
    [],
  );

  /**
   * useMemo keeps this object identity stable between renders. Without it a new
   * object is created every render, and every consumer re-renders needlessly.
   */
  const value = useMemo(
    () => ({ customer, initialising, login, register, logout }),
    [customer, initialising, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Read auth state anywhere: `const { customer, logout } = useAuth();` */
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  // This throw turns a confusing "cannot read property of null" deep inside a
  // component into a clear message naming the actual mistake.
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
