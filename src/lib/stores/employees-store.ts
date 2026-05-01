import { create } from "zustand";
import { api, type Paginated } from "@/lib/api";
import type { Balance, Employee, ScheduleAvailability } from "@/lib/types";

type EmployeesState = {
  employees: Employee[];
  loading: boolean;
  fetch: () => Promise<void>;

  /* Detail state */
  current: Employee | null;
  currentBalance: Balance | null;
  slots: ScheduleAvailability[];
  detailLoading: boolean;
  fetchDetail: (id: string) => Promise<void>;
  fetchBalance: (id: string) => Promise<void>;
  setCurrent: (employee: Employee | null) => void;
  setSlots: (slots: ScheduleAvailability[]) => void;
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
  slots: [],
  detailLoading: true,

  fetchDetail: async (id) => {
    set({ detailLoading: true });
    try {
      const [emp, avail, balance] = await Promise.all([
        api.get<Employee>(`/employees/${id}`),
        api.get<Paginated<ScheduleAvailability>>(
          `/schedule-availability?employeeId=${id}`,
        ),
        api.get<Balance>(`/balances/employee/${id}`).catch(() => null),
      ]);
      set({ current: emp, slots: avail.items, currentBalance: balance });
    } finally {
      set({ detailLoading: false });
    }
  },

  fetchBalance: async (id) => {
    const balance = await api
      .get<Balance>(`/balances/employee/${id}`)
      .catch(() => null);
    set({ currentBalance: balance });
  },

  setCurrent: (employee) => set({ current: employee }),
  setSlots: (slots) => set({ slots }),
}));
