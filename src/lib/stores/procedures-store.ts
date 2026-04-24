import { create } from "zustand";
import { api, type Paginated } from "@/lib/api";
import type { Procedure } from "@/lib/types";

type ProceduresState = {
  procedures: Procedure[];
  loading: boolean;
  fetch: () => Promise<void>;
};

export const useProceduresStore = create<ProceduresState>((set) => ({
  procedures: [],
  loading: true,

  fetch: async () => {
    set({ loading: true });
    try {
      const res = await api.get<Paginated<Procedure>>("/procedures");
      set({ procedures: res.items });
    } finally {
      set({ loading: false });
    }
  },
}));
