import { create } from "zustand";
import type { CloudRestoreProgressEvent } from "@/lib/types";

type RealtimeState = {
  isConnected: boolean;
  cloudConnected: boolean | null;
  cloudRestoreProgress: CloudRestoreProgressEvent | null;
  setConnected: (connected: boolean) => void;
  setCloudConnected: (connected: boolean | null) => void;
  setCloudRestoreProgress: (
    progress: CloudRestoreProgressEvent | null,
  ) => void;
};

export const useRealtimeStore = create<RealtimeState>((set) => ({
  isConnected: false,
  cloudConnected: null,
  cloudRestoreProgress: null,
  setConnected: (connected) => set({ isConnected: connected }),
  setCloudConnected: (connected) => set({ cloudConnected: connected }),
  setCloudRestoreProgress: (progress) =>
    set({ cloudRestoreProgress: progress }),
}));
