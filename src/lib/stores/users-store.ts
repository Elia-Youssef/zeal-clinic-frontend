import { create } from "zustand";
import { api } from "@/lib/api";
import type { User } from "@/lib/types";

type UsersState = {
  current: User | null;
  detailLoading: boolean;
  fetchDetail: (id: string) => Promise<void>;
  setCurrent: (u: User | null) => void;
};

export const useUsersStore = create<UsersState>((set) => ({
  current: null,
  detailLoading: true,

  fetchDetail: async (id) => {
    set({ detailLoading: true });
    try {
      const user = await api.get<User>(`/users/${id}`);
      set({ current: user });
    } finally {
      set({ detailLoading: false });
    }
  },

  setCurrent: (u) => set({ current: u }),
}));
