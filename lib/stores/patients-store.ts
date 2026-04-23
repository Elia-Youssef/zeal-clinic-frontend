import { create } from "zustand";
import { api, type Paginated } from "@/lib/api";
import type { Patient } from "@/lib/types";

type PatientsState = {
  patients: Patient[];
  loading: boolean;
  fetch: () => Promise<void>;

  /* Detail state for the patient detail page */
  current: Patient | null;
  detailLoading: boolean;
  fetchDetail: (id: string) => Promise<void>;
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
  detailLoading: true,

  fetchDetail: async (id) => {
    set({ detailLoading: true });
    try {
      // Patient detail is the hub for clinical and financial history, so load
      // everything in parallel and let the page render from one synchronized
      // store snapshot instead of scattering ad-hoc requests in the component.
      const [patient] = await Promise.all([
        api.get<Patient>(`/patients/${id}`),
      ]);
      set({
        current: patient,
      });
    } finally {
      set({ detailLoading: false });
    }
  },

  setCurrent: (patient) => set({ current: patient }),
}));
