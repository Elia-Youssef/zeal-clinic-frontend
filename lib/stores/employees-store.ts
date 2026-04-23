import { create } from "zustand";
import { api, type Paginated } from "@/lib/api";
import type { Employee, ScheduleAvailability, Transaction } from "@/lib/types";

type EmployeesState = {
  employees: Employee[];
  loading: boolean;
  fetch: () => Promise<void>;

  /* Detail state */
  current: Employee | null;
  slots: ScheduleAvailability[];
  payments: Transaction[];
  detailLoading: boolean;
  fetchDetail: (id: string) => Promise<void>;
  setCurrent: (employee: Employee | null) => void;
  setSlots: (slots: ScheduleAvailability[]) => void;
  setPayments: (payments: Transaction[]) => void;
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
  slots: [],
  payments: [],
  detailLoading: true,

  fetchDetail: async (id) => {
    set({ detailLoading: true });
    try {
      const [emp, avail, payments] = await Promise.all([
        api.get<Employee>(`/employees/${id}`),
        api.get<Paginated<ScheduleAvailability>>(
          `/schedule-availability?employeeId=${id}`,
        ),
        api.get<Transaction[]>(`/employees/${id}/payments`),
      ]);
      set({ current: emp, slots: avail.items, payments });
    } finally {
      set({ detailLoading: false });
    }
  },

  setCurrent: (employee) => set({ current: employee }),
  setSlots: (slots) => set({ slots }),
  setPayments: (payments) => set({ payments }),
}));
