import { create } from "zustand";
import { api } from "@/lib/api";
import type { Supplier } from "@/lib/types";

type SuppliersState = {
  current: Supplier | null;
  detailLoading: boolean;
  fetchDetail: (id: string) => Promise<void>;
  setCurrent: (supplier: Supplier | null) => void;
};

export const useSuppliersStore = create<SuppliersState>((set) => ({
  current: null,
  detailLoading: true,

  fetchDetail: async (id) => {
    set({ detailLoading: true });
    try {
      const supplier = await api.get<Supplier>(`/suppliers/${id}`);
      set({ current: supplier });
    } finally {
      set({ detailLoading: false });
    }
  },

  setCurrent: (supplier) => set({ current: supplier }),
}));
