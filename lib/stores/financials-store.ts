import { create } from "zustand";
import { api, type Paginated } from "@/lib/api";
import type { Currency } from "@/lib/types";

type FinancialsState = {
  currencies: Currency[];
  loading: boolean;
  fetch: () => Promise<void>;
};

export const useFinancialsStore = create<FinancialsState>((set) => ({
  currencies: [],
  loading: true,

  fetch: async () => {
    set({ loading: true });
    try {
      const res = await api.get<Paginated<Currency>>("/currencies");
      set({ currencies: res.items });
    } finally {
      set({ loading: false });
    }
  },
}));
