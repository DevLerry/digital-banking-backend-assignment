import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Spinner } from './ui';

/**
 * Keeps signed-out visitors away from the banking screens.
 *
 * IMPORTANT: this is a CONVENIENCE, not a security control. Anyone can edit
 * JavaScript in their browser and render whatever they like. The real defence
 * is that every screen's DATA comes from the API, and the API checks the JWT on
 * every request. A bypassed frontend guard shows an empty dashboard, not
 * someone else's money.
 *
 * Rule of thumb: frontend guards improve UX; backend guards provide security.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { customer, initialising } = useAuth();
  const location = useLocation();

  // Without this check we would bounce the user to /login on every refresh,
  // during the split second before /api/auth/me answers.
  if (initialising) return <Spinner label="Checking your session" />;

  if (!customer) {
    // `state` remembers where they were headed, so login can send them back.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
