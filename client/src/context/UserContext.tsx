import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { api, setCurrentEmail, ApiError } from '../api';

export type Role = 'admin' | 'pro' | 'guest';

export interface AppUser {
  email: string;
  name: string;
  picture: string;
  role: Role;
  approved: boolean;
  createdAt: string;
  lastLoginAt: string;
}

interface UserCtx {
  user: AppUser | null;
  isLoading: boolean;
  isAdmin: boolean;
  // `denied` is true only when the SERVER actually said 403 (email not
  // allowed). Transient failures (502/5xx/network) leave it false so the UI
  // can show "backend unreachable, retrying…" instead of slandering the user
  // as unauthorised — and so a blip never permanently demotes them.
  denied: boolean;
  transientError: boolean;
  refresh: () => Promise<void>;
}

const Ctx = createContext<UserCtx | undefined>(undefined);

// How long to wait before auto-retrying a transient login failure.
const RETRY_BASE_MS = 2000;
const RETRY_MAX_MS = 15000;

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { firebaseUser, isAuthenticated } = useAuth();
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [denied, setDenied] = useState(false);
  const [transientError, setTransientError] = useState(false);
  const [retryAt, setRetryAt] = useState(0);

  const refresh = useCallback(async () => {
    if (!firebaseUser?.email) {
      setUser(null); setCurrentEmail(null); setDenied(false); setTransientError(false);
      return;
    }
    setCurrentEmail(firebaseUser.email);
    setIsLoading(true);
    try {
      const u = await api.post<AppUser>('/api/auth/login', {
        email:   firebaseUser.email,
        name:    firebaseUser.displayName || '',
        picture: firebaseUser.photoURL    || '',
      });
      setUser(u);
      setDenied(false);
      setTransientError(false);
    } catch (e) {
      const status = e instanceof ApiError ? e.status : -1;
      console.error('[UserContext] /api/auth/login failed', status, e);
      setUser(null);
      if (status === 403) {
        setDenied(true);
        setTransientError(false);
      } else {
        setDenied(false);
        setTransientError(true);
        setRetryAt(Date.now()); // triggers retry useEffect
      }
    } finally {
      setIsLoading(false);
    }
  }, [firebaseUser?.email, firebaseUser?.displayName, firebaseUser?.photoURL]);

  useEffect(() => {
    if (isAuthenticated) refresh();
    else { setUser(null); setCurrentEmail(null); setDenied(false); setTransientError(false); }
  }, [isAuthenticated, refresh]);

  // Auto-retry on transient failure with exponential backoff (capped).
  useEffect(() => {
    if (!transientError || !isAuthenticated) return;
    let attempt = 0;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const delay = Math.min(RETRY_BASE_MS * Math.pow(2, attempt), RETRY_MAX_MS);
      attempt++;
      setTimeout(() => { if (!cancelled) refresh(); }, delay);
    };
    tick();
    return () => { cancelled = true; };
  }, [transientError, retryAt, isAuthenticated, refresh]);

  return (
    <Ctx.Provider value={{
      user,
      isLoading,
      isAdmin: user?.role === 'admin',
      denied,
      transientError,
      refresh,
    }}>
      {children}
    </Ctx.Provider>
  );
};

export function useAppUser(): UserCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAppUser must be inside <UserProvider>');
  return v;
}
