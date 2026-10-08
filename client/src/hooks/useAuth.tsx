import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Business } from '../types';
import * as authApi from '../services/authApi';
import { setToken, ApiError } from '../lib/api';

interface AuthContextValue {
  user: User | null;
  business: Business | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshBusiness: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [user, setUser] = useState<User | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);

  const loadCurrentUser = useCallback(async () => {
    try {
      const { user: me } = await authApi.getMe();
      setUser(me);
      const { business: biz } = await authApi.getBusiness();
      setBusiness(biz);
    } catch (err) {
      // Only a genuine auth failure (invalid/expired token) should clear the
      // session. A transient network error or server hiccup (e.g. a backend
      // restart) must not silently log the user out of a still-valid session.
      const isAuthFailure = err instanceof ApiError && (err.status === 401 || err.status === 403);
      if (isAuthFailure) {
        setToken(null);
      }
      setUser(null);
      setBusiness(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('leadflow_token');
    if (token) {
      loadCurrentUser();
    } else {
      setLoading(false);
    }
  }, [loadCurrentUser]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login({ email, password });
    setToken(res.token);
    await loadCurrentUser();
  }, [loadCurrentUser]);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setBusiness(null);
  }, []);

  const refreshBusiness = useCallback(async () => {
    const { business: biz } = await authApi.getBusiness();
    setBusiness(biz);
  }, []);

  return (
    <AuthContext.Provider value={{ user, business, loading, login, logout, refreshBusiness }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
