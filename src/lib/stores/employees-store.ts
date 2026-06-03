import { create } from "zustand";
import { api, type Paginated } from "@/lib/api";
import type { Balance, Employee } from "@/lib/types";

type EmployeesState = {
  employees: Employee[];
  loading: boolean;
  fetch: () => Promise<void>;

  current: Employee | null;
  currentBalance: Balance | null;
  detailLoading: boolean;
  fetchDetail: (id: string) => Promise<void>;
  fetchBalance: (id: string) => Promise<void>;
  setCurrent: (employee: Employee | null) => void;
};

export const useEmployeesStore = create<EmployeesState>((set) => ({
  employees: [],
  loading: true,

  fetch: async () => {
    set({ loading: true });
    try {
      const res = await api.get<Paginated<Employee>>("/employees");
      set({ employees: res.items });
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
      const [emp, balance] = await Promise.all([
        api.get<Employee>(`/employees/${id}`),
        // Balance needs balances:read; fail quietly so the page still renders.
        api.get<Balance>(`/balances/employee/${id}`, { silent: true }).catch(
          () => null,
        ),
      ]);
      set({ current: emp, currentBalance: balance });
    } finally {
      set({ detailLoading: false });
    }
  },

  fetchBalance: async (id) => {
    const balance = await api
      .get<Balance>(`/balances/employee/${id}`, { silent: true })
      .catch(() => null);
    set({ currentBalance: balance });
  },

  setCurrent: (employee) => set({ current: employee }),
}));
