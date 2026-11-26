import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import type { UserProfile } from '../types.ts';

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  token: string | null;
  apiFetch: <T = unknown>(url: string, options?: RequestInit) => Promise<T>;
  signInWithGoogle: () => Promise<void>;
  setSessionAuth: (token: string, user: UserProfile) => void;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  // Keep auth token strictly in memory (never localStorage/sessionStorage)
  const tokenRef = useRef<string | null>(null);
  const [tokenState, setTokenState] = useState<string | null>(null);

  const apiFetch = useCallback(async <T = unknown>(url: string, options: RequestInit = {}): Promise<T> => {
    const headers = new Headers(options.headers || {});
    if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    let currentToken = tokenRef.current;
    if (!currentToken && auth.currentUser) {
      currentToken = await auth.currentUser.getIdToken();
      tokenRef.current = currentToken;
      setTokenState(currentToken);
    }

    if (currentToken) {
      headers.set('Authorization', `Bearer ${currentToken}`);
    }

    const res = await fetch(url, { ...options, headers });
    const text = await res.text();
    let data: unknown = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { error: text };
    }

    if (!res.ok) {
      const errMsg = (data as { error?: string })?.error || `Request failed (${res.status})`;
      throw new Error(errMsg);
    }

    return data as T;
  }, []);

  const refreshUser = useCallback(async () => {
    if (!tokenRef.current && !auth.currentUser) {
      setUser(null);
      return;
    }
    try {
      const res = await apiFetch<{ user: UserProfile }>('/api/auth/me');
      setUser(res.user);
    } catch {
      setUser(null);
    }
  }, [apiFetch]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          const idToken = await fbUser.getIdToken();
          tokenRef.current = idToken;
          setTokenState(idToken);
          const res = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${idToken}` },
          });
          if (res.ok) {
            const data = (await res.json()) as { user: UserProfile };
            setUser(data.user);
          }
        } catch (err) {
          console.error('Firebase sync failed:', err);
        }
      } else if (!tokenRef.current?.startsWith('jk1.')) {
        tokenRef.current = null;
        setTokenState(null);
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const result = await signInWithPopup(auth, googleAuthProvider);
    const idToken = await result.user.getIdToken();
    tokenRef.current = idToken;
    setTokenState(idToken);
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (res.ok) {
      const data = (await res.json()) as { user: UserProfile };
      setUser(data.user);
    }
  }, []);

  const setSessionAuth = useCallback((newToken: string, newUser: UserProfile) => {
    tokenRef.current = newToken;
    setTokenState(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(async () => {
    tokenRef.current = null;
    setTokenState(null);
    setUser(null);
    if (auth.currentUser) {
      await signOut(auth);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        token: tokenState,
        apiFetch,
        signInWithGoogle,
        setSessionAuth,
        refreshUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
