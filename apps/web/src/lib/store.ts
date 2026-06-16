import { create } from "zustand";

interface AppState {
  currentUserId: string | null;
  setCurrentUserId: (id: string | null) => void;
  // UI state
  sidebarOpen: boolean;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Hardcoded generic user for the MVP demo to bypass real auth
  currentUserId: "00000000-0000-0000-0000-000000000001",
  setCurrentUserId: (id) => set({ currentUserId: id }),
  
  sidebarOpen: false,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}));
