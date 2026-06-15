/**
 * Zustand store for User Authentication.
 * Synchronizes login state and stores profile details.
 */
import { create } from "zustand";
import { api } from "@/lib/api";
import type { User, UserCreate } from "@/types";

interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (credentials: Record<string, string>) => Promise<User>;
  register: (data: UserCreate & { password?: string }) => Promise<User>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<User | null>;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  setUser: (user) => set({ user, isAuthenticated: !!user }),

  login: async (credentials) => {
    set({ isLoading: true });
    try {
      const response = await api.auth.login(credentials);
      const user = response.user;
      set({ user, isAuthenticated: true, isLoading: false });
      return user;
    } catch (error) {
      set({ user: null, isAuthenticated: false, isLoading: false });
      throw error;
    }
  },

  register: async (data) => {
    set({ isLoading: true });
    try {
      const user = await api.auth.register(data);
      set({ isLoading: false });
      return user;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await api.auth.logout();
    } catch (error) {
      console.error("Logout request failed:", error);
    } finally {
      set({ user: null, isAuthenticated: false, isLoading: false });
      // Clear cache / trigger redirect
      window.location.href = "/login";
    }
  },

  fetchMe: async () => {
    // If we already verified we are loading, we fetch.
    try {
      const response = await api.auth.me();
      const user = response.user;
      set({ user, isAuthenticated: true, isLoading: false });
      return user;
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
      return null;
    }
  },
}));
