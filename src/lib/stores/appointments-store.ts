import { create } from "zustand";
import { api, type Paginated } from "@/lib/api";
import type { Appointment, Holiday, RoomDayCount } from "@/lib/types";

type DayAppointmentsResponse = Paginated<Appointment> & {
  holidays: Holiday[];
};

type WeekCountsResponse = {
  rooms: RoomDayCount[];
  holidays: Holiday[];
};

type AppointmentsState = {
  appointments: Appointment[];
  dayHolidays: Holiday[];
  weekCounts: RoomDayCount[];
  weekHolidays: Holiday[];
  loading: boolean;
  fetchForDates: (dates: string[]) => Promise<void>;
  fetchWeekCounts: (date: string) => Promise<void>;
};

export const useAppointmentsStore = create<AppointmentsState>((set) => {
  // Day and week requests share the same calendar surface. Only the newest
  // request may publish data or clear loading when the user switches quickly.
  let requestGeneration = 0;

  return {
    appointments: [],
    dayHolidays: [],
    weekCounts: [],
    weekHolidays: [],
    loading: true,

    fetchForDates: async (dates) => {
      const generation = ++requestGeneration;
      // Backend requires explicit dates; normalize them for Day view.
      const uniqueDates = [...new Set(dates.filter(Boolean))];
      if (uniqueDates.length === 0) {
        set({ appointments: [], loading: false });
        return;
      }

      set({ loading: true });
      try {
        const responses = await Promise.all(
          uniqueDates.map((date) =>
            api.get<DayAppointmentsResponse>(`/appointments?date=${date}`),
          ),
        );
        if (generation !== requestGeneration) return;
        // A day view also requests the previous date so appointments that
        // cross midnight can be included. Depending on backend filtering, the
        // same appointment may be returned twice, so merge by id.
        const appointmentsById = new Map<string, Appointment>();
        for (const res of responses) {
          for (const appointment of res.items) {
            appointmentsById.set(appointment.id, appointment);
          }
        }
        const appointments = [...appointmentsById.values()].sort(
          (a, b) => Date.parse(a.startTime) - Date.parse(b.startTime),
        );
        // Merge holidays across dates without duplicating multi-day entries.
        const seen = new Set<string>();
        const dayHolidays: Holiday[] = [];
        for (const res of responses) {
          for (const h of res.holidays) {
            if (seen.has(h.id)) continue;
            seen.add(h.id);
            dayHolidays.push(h);
          }
        }
        set({ appointments, dayHolidays });
      } finally {
        if (generation === requestGeneration) set({ loading: false });
      }
    },

    fetchWeekCounts: async (date) => {
      const generation = ++requestGeneration;
      // Server returns room counts and holidays for this week.
      set({ loading: true });
      try {
        const { rooms, holidays } = await api.get<WeekCountsResponse>(
          `/appointments/count-per-room?date=${date}`,
        );
        if (generation === requestGeneration) {
          set({ weekCounts: rooms, weekHolidays: holidays });
        }
      } finally {
        if (generation === requestGeneration) set({ loading: false });
      }
    },
  };
});
