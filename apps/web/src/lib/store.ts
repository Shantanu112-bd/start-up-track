import { create } from "zustand";

const DEMO_MODE = typeof window !== "undefined"
  ? process.env.NEXT_PUBLIC_DEMO_MODE === "true"
  : false;

const TOUR_STORAGE_KEY = "cryptopay_tour_complete";

interface AppState {
  currentUserId: string | null;
  setCurrentUserId: (id: string | null) => void;
  // Demo mode
  isDemoMode: boolean;
  // Tour state
  tourStep: number;
  isTourComplete: boolean;
  startTour: () => void;
  nextTourStep: () => void;
  skipTour: () => void;
  // UI state
  sidebarOpen: boolean;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Hardcoded demo user for MVP — matches seeded DB user
  currentUserId: "00000000-0000-0000-0000-000000000001",
  setCurrentUserId: (id) => set({ currentUserId: id }),

  accessToken: typeof window !== "undefined" ? localStorage.getItem("accessToken") : null,
  refreshToken: typeof window !== "undefined" ? localStorage.getItem("refreshToken") : null,

  setTokens: (access, refresh) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("accessToken", access);
      localStorage.setItem("refreshToken", refresh);
    }
    set({ accessToken: access, refreshToken: refresh });
  },

  clearTokens: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
    }
    set({ accessToken: null, refreshToken: null, currentUserId: null });
  },

  isDemoMode: DEMO_MODE,

  tourStep: 0,
  isTourComplete: typeof window !== "undefined"
    ? localStorage.getItem(TOUR_STORAGE_KEY) === "true"
    : false,

  startTour: () => set({ tourStep: 1, isTourComplete: false }),

  nextTourStep: () =>
    set((state) => {
      const next = state.tourStep + 1;
      if (next > 5) {
        if (typeof window !== "undefined") {
          localStorage.setItem(TOUR_STORAGE_KEY, "true");
        }
        return { tourStep: 0, isTourComplete: true };
      }
      return { tourStep: next };
    }),

  skipTour: () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(TOUR_STORAGE_KEY, "true");
    }
    return set({ tourStep: 0, isTourComplete: true });
  },

  sidebarOpen: false,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}));
