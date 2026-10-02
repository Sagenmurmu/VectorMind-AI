"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { api, getAuthToken, setAuthToken, UserProfile } from "../api/client";

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    const currentToken = getAuthToken();
    if (!currentToken) {
      setUser(null);
      setTokenState(null);
      setIsLoading(false);
      return;
    }

    try {
      const response = await api.auth.me();
      if (response.success && response.data?.user) {
        setUser(response.data.user);
        setTokenState(currentToken);
      } else {
        setAuthToken(null);
        setUser(null);
        setTokenState(null);
      }
    } catch {
      setAuthToken(null);
      setUser(null);
      setTokenState(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.auth.login({ email, password });
    if (res.success && res.data) {
      setAuthToken(res.data.token);
      setTokenState(res.data.token);
      setUser(res.data.user);
    }
  };

  const register = async (email: string, password: string, name?: string) => {
    const res = await api.auth.register({ email, password, name });
    if (res.success && res.data) {
      setAuthToken(res.data.token);
      setTokenState(res.data.token);
      setUser(res.data.user);
    }
  };

  const logout = () => {
    setAuthToken(null);
    setTokenState(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
