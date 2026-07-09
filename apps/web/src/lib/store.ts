import { create } from "zustand";
import { persist } from "zustand/middleware";

const DEMO_MODE = typeof window !== "undefined"
  ? process.env.NEXT_PUBLIC_DEMO_MODE === "true"
  : false;

const TOUR_STORAGE_KEY = "cryptopay_tour_complete";

interface AppState {
  currentUserId: string | null;
  currentUserDisplayName: string | null;
  setCurrentUser: (id: string | null, displayName?: string | null) => void;
  merchantId: string | null;
  setMerchantId: (id: string | null) => void;
  // Authentication tokens
  accessToken: string | null;
  refreshToken: string | null;
  setTokens: (access: string, refresh: string) => void;
  clearTokens: () => void;
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
  // Auth Lock state
  isAppUnlocked: boolean;
  setAppUnlocked: (unlocked: boolean) => void;
  // KYC state
  kycStatus: string | null;
  setKycStatus: (status: string | null) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentUserId: null,
      currentUserDisplayName: null,
      setCurrentUser: (id, displayName) => set({ currentUserId: id, currentUserDisplayName: displayName || null }),
      merchantId: null,
      setMerchantId: (id) => set({ merchantId: id }),

      accessToken: null,
      refreshToken: null,

      setTokens: (access, refresh) => {
        set({ accessToken: access, refreshToken: refresh });
      },

      clearTokens: () => {
        set({ accessToken: null, refreshToken: null, currentUserId: null, currentUserDisplayName: null });
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

  isAppUnlocked: false,
  setAppUnlocked: (unlocked) => set({ isAppUnlocked: unlocked }),

  kycStatus: null,
  setKycStatus: (status) => set({ kycStatus: status }),
    }),
    {
      name: "payra-auth-storage",
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        currentUserId: state.currentUserId,
        currentUserDisplayName: state.currentUserDisplayName,
        kycStatus: state.kycStatus,
      }),
    }
  )
);
