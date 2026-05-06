import { create } from "zustand";
import { api, type Paginated } from "@/lib/api";
import type {
  Balance,
  Employee,
  EmployeeScheduleDay,
  EmployeeVacation,
  Holiday,
  ScheduleAvailability,
} from "@/lib/types";

/** Shape returned by GET /api/employees/:id/schedule?date=YYYY-MM-DD:
 * a single bundle of everything the schedule grid needs for the visible
 * week. The backend derives the Sun–Sat window (and the calendar month
 * for `monthHours`) from the supplied date. */
type EmployeeScheduleResponse = {
  weekStart: string;
  weekEnd: string;
  monthStart: string;
  monthEnd: string;
  days: EmployeeScheduleDay[];
  templates: ScheduleAvailability[];
  vacations: EmployeeVacation[];
  holidays: Holiday[];
  monthHours: { employeeId: string; employeeName?: string; hours: number }[];
};

type EmployeesState = {
  employees: Employee[];
  loading: boolean;
  fetch: () => Promise<void>;

  /* Detail state */
  current: Employee | null;
  currentBalance: Balance | null;
  /* Weekly schedule data, all sourced from the combined
   * /employees/:id/schedule endpoint:
   *  - slots: active template rows for the visible week
   *  - scheduleDays: read-only projection (template minus holidays/vacations)
   *  - vacations: overlapping vacations across all statuses, clickable to
   *    edit/delete from the grid. */
  slots: ScheduleAvailability[];
  scheduleDays: EmployeeScheduleDay[];
  vacations: EmployeeVacation[];
  detailLoading: boolean;
  fetchDetail: (id: string) => Promise<void>;
  fetchBalance: (id: string) => Promise<void>;
  /** Fetches the full week bundle (templates + projection + vacations)
   *  for the Sun–Sat window containing `date` (YYYY-MM-DD). */
  fetchScheduleForWeek: (id: string, date: string) => Promise<void>;
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
  scheduleDays: [],
  vacations: [],
  detailLoading: true,

  fetchDetail: async (id) => {
    set({ detailLoading: true });
    try {
      const [emp, balance] = await Promise.all([
        api.get<Employee>(`/employees/${id}`),
        api.get<Balance>(`/balances/employee/${id}`).catch(() => null),
      ]);
      set({ current: emp, currentBalance: balance });
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

  fetchScheduleForWeek: async (id, date) => {
    try {
      const res = await api.get<EmployeeScheduleResponse>(
        `/employees/${id}/schedule?date=${date}`,
      );
      set({
        slots: res.templates ?? [],
        scheduleDays: res.days ?? [],
        vacations: res.vacations ?? [],
      });
    } catch {
      set({ slots: [], scheduleDays: [], vacations: [] });
    }
  },

  setCurrent: (employee) => set({ current: employee }),
  setSlots: (slots) => set({ slots }),
}));
