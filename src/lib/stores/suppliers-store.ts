import { create } from "zustand";
import { api } from "@/lib/api";
import type { Balance, Supplier } from "@/lib/types";

type SuppliersState = {
  current: Supplier | null;
  currentBalance: Balance | null;
  detailLoading: boolean;
  fetchDetail: (id: string) => Promise<void>;
  fetchBalance: (id: string) => Promise<void>;
  setCurrent: (supplier: Supplier | null) => void;
};

export const useSuppliersStore = create<SuppliersState>((set) => ({
  current: null,
  currentBalance: null,
  detailLoading: true,

  fetchDetail: async (id) => {
    set({ detailLoading: true });
    try {
      const [supplier, balance] = await Promise.all([
        api.get<Supplier>(`/suppliers/${id}`),
        // Balance needs balances:read; fail quietly so the page still renders.
        api.get<Balance>(`/balances/supplier/${id}`, { silent: true }).catch(
          () => null,
        ),
      ]);
      set({ current: supplier, currentBalance: balance });
    } finally {
      set({ detailLoading: false });
    }
  },

  fetchBalance: async (id) => {
    const balance = await api
      .get<Balance>(`/balances/supplier/${id}`, { silent: true })
      .catch(() => null);
    set({ currentBalance: balance });
  },

  setCurrent: (supplier) => set({ current: supplier }),
}));
