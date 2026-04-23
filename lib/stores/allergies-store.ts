import { create } from "zustand";
import { api, type Paginated } from "@/lib/api";
import type { Allergy } from "@/lib/types";

type AllergiesState = {
  allergies: Allergy[];
  loading: boolean;
  fetch: () => Promise<void>;
};

export const useAllergiesStore = create<AllergiesState>((set) => ({
  allergies: [],
  loading: true,

  fetch: async () => {
    set({ loading: true });
    try {
      const res = await api.get<Paginated<Allergy>>("/allergies");
      set({ allergies: res.items });
    } finally {
      set({ loading: false });
    }
  },
}));
