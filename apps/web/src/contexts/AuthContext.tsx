import React, { createContext, useContext, useState, useCallback } from "react";
import api from "../lib/axios.js";

interface User {
  userId: string;
  role: string;
  specialPrivilege?: string;
  campusId: string;
  isTempPassword: boolean;
}

interface AuthContextValue {
  user: User | null;
  login: (employeeId: string, password: string) => Promise<{ isTempPassword: boolean }>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function parseJwt(token: string): User {
  const payload = JSON.parse(atob(token.split(".")[1]));
  return {
    userId: payload.userId,
    role: payload.role,
    specialPrivilege: payload.specialPrivilege,
    campusId: payload.campusId,
    isTempPassword: payload.isTempPassword,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) return null;
    try { return parseJwt(token); } catch { return null; }
  });

  const login = useCallback(async (employeeId: string, password: string) => {
    const { data } = await api.post<{ data: { accessToken: string; refreshToken: string; isTempPassword: boolean } }>("/auth/login", { employeeId, password });
    const { accessToken, refreshToken, isTempPassword } = data.data;
    localStorage.setItem("accessToken", accessToken);
    localStorage.setItem("refreshToken", refreshToken);
    setUser(parseJwt(accessToken));
    return { isTempPassword };
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem("refreshToken");
    try { await api.post("/auth/logout", { refreshToken }); } catch { /* ignore */ }
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    setUser(null);
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    await api.post("/auth/change-password", { currentPassword, newPassword });
    // Re-fetch updated token
    const token = localStorage.getItem("accessToken");
    if (token) setUser(parseJwt(token));
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
