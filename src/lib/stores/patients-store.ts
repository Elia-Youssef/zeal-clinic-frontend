import { create } from "zustand";
import { api, type Paginated } from "@/lib/api";
import type { Balance, Patient } from "@/lib/types";

type PatientsState = {
  patients: Patient[];
  loading: boolean;
  fetch: () => Promise<void>;

  current: Patient | null;
  currentBalance: Balance | null;
  detailLoading: boolean;
  fetchDetail: (id: string) => Promise<void>;
  fetchBalance: (id: string) => Promise<void>;
  setCurrent: (patient: Patient | null) => void;
};

export const usePatientsStore = create<PatientsState>((set) => ({
  patients: [],
  loading: true,

  fetch: async () => {
    set({ loading: true });
    try {
      const res = await api.get<Paginated<Patient>>("/patients");
      set({ patients: res.items });
    } finally {
      set({ loading: false });
    }
  },

  current: null,
  currentBalance: null,
  detailLoading: true,

  fetchDetail: async (id) => {
    set({ detailLoading: true });
    try {
      const [patient, balance] = await Promise.all([
        api.get<Patient>(`/patients/${id}`),
        api.get<Balance>(`/balances/patient/${id}`).catch(() => null),
      ]);
      set({ current: patient, currentBalance: balance });
    } finally {
      set({ detailLoading: false });
    }
  },

  fetchBalance: async (id) => {
    const balance = await api
      .get<Balance>(`/balances/patient/${id}`)
      .catch(() => null);
    set({ currentBalance: balance });
  },

  setCurrent: (patient) => set({ current: patient }),
}));
