import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as authService from '../services/authService';
import type { AuthResult, LoginInput, PublicUser, RegisterInput } from '../types';

export interface AuthContextValue {
  user: PublicUser | null;
  isAuthenticated: boolean;
  register: (input: RegisterInput) => Promise<AuthResult>;
  login: (input: LoginInput) => Promise<AuthResult>;
  logout: () => void;
  /** Suma saldo tras un cobro aprobado; persiste en localStorage y refresca la UI al instante. */
  creditBalance: (amount: number) => PublicUser | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Inicialización síncrona: la sesión persiste al recargar sin "parpadeo" del login.
  const [user, setUser] = useState<PublicUser | null>(() => authService.getSessionUser());

  // Sincroniza entre pestañas (logout o recarga de saldo en otra pestaña).
  useEffect(() => {
    const watchedKeys: readonly string[] = Object.values(authService.STORAGE_KEYS);
    const onStorage = (event: StorageEvent): void => {
      if (event.key === null || watchedKeys.includes(event.key)) {
        setUser(authService.getSessionUser());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const register = useCallback(async (input: RegisterInput): Promise<AuthResult> => {
    const result = await authService.registerUser(input);
    if (result.ok) setUser(result.user);
    return result;
  }, []);

  const login = useCallback(async (input: LoginInput): Promise<AuthResult> => {
    const result = await authService.loginUser(input);
    if (result.ok) setUser(result.user);
    return result;
  }, []);

  const logout = useCallback((): void => {
    authService.clearSession();
    setUser(null);
  }, []);

  const creditBalance = useCallback(
    (amount: number): PublicUser | null => {
      if (user === null) return null;
      const updated = authService.creditBalance(user.id, amount);
      if (updated !== null) setUser(updated);
      return updated;
    },
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ user, isAuthenticated: user !== null, register, login, logout, creditBalance }),
    [user, register, login, logout, creditBalance],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === null) throw new Error('useAuth debe usarse dentro de <AuthProvider>.');
  return context;
}
