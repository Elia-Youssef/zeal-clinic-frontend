import { create } from "zustand";
import { api, type Paginated } from "@/lib/api";
import type { Room } from "@/lib/types";

type RoomsState = {
  rooms: Room[];
  loading: boolean;
  fetch: () => Promise<void>;
};

export const useRoomsStore = create<RoomsState>((set) => ({
  rooms: [],
  loading: true,

  fetch: async () => {
    set({ loading: true });
    try {
      const res = await api.get<Paginated<Room>>("/rooms");
      set({ rooms: res.items });
    } finally {
      set({ loading: false });
    }
  },
}));
