import { create } from "zustand";

type RealtimeState = {
  isConnected: boolean;
  setConnected: (connected: boolean) => void;
};

export const useRealtimeStore = create<RealtimeState>((set) => ({
  isConnected: false,
  setConnected: (connected) => set({ isConnected: connected }),
}));
