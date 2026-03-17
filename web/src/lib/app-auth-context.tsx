"use client";

import { createContext, useContext, type ReactNode } from "react";

export type AppAuthUser = {
  id: string;
  email?: { address: string };
};

export type AppAuthContextValue = {
  authenticated: boolean;
  ready: boolean;
  user: AppAuthUser | null;
  login: () => void | Promise<void>;
  logout: () => void | Promise<void>;
  getAccessToken: () => Promise<string | null>;
  isDevBypass: boolean;
};

const noop = () => {};

export const defaultAuthValue: AppAuthContextValue = {
  authenticated: false,
  ready: true,
  user: null,
  login: noop,
  logout: noop,
  getAccessToken: async () => null,
  isDevBypass: false,
};

const AppAuthContext = createContext<AppAuthContextValue>(defaultAuthValue);

export function AppAuthProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: AppAuthContextValue;
}) {
  return (
    <AppAuthContext.Provider value={value}>{children}</AppAuthContext.Provider>
  );
}

export function useAppAuth() {
  return useContext(AppAuthContext);
}
