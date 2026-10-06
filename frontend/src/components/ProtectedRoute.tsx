import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export interface RedirectState {
  from?: string;
}

/** Solo renderiza su contenido con sesión activa; si no, redirige al login. */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    const state: RedirectState = { from: location.pathname };
    return <Navigate to="/login" replace state={state} />;
  }
  return <>{children}</>;
}

/** Login y registro no tienen sentido con sesión activa: redirige al dashboard. */
export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default ProtectedRoute;
