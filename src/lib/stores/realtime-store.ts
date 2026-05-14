import { create } from "zustand";

type RealtimeState = {
  isConnected: boolean;
  cloudConnected: boolean | null;
  setConnected: (connected: boolean) => void;
  setCloudConnected: (connected: boolean | null) => void;
};

export const useRealtimeStore = create<RealtimeState>((set) => ({
  isConnected: false,
  cloudConnected: null,
  setConnected: (connected) => set({ isConnected: connected }),
  setCloudConnected: (connected) => set({ cloudConnected: connected }),
}));
