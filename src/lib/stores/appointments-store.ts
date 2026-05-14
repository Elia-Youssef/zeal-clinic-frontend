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

export const useAppointmentsStore = create<AppointmentsState>((set) => ({
  appointments: [],
  dayHolidays: [],
  weekCounts: [],
  weekHolidays: [],
  loading: true,

  fetchForDates: async (dates) => {
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
      // Keep ordering stable across parallel responses.
      const appointments = responses
        .flatMap((res) => res.items)
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
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
      set({ loading: false });
    }
  },

  fetchWeekCounts: async (date) => {
    // Server returns room counts and holidays for this week.
    set({ loading: true });
    try {
      const { rooms, holidays } = await api.get<WeekCountsResponse>(
        `/appointments/count-per-room?date=${date}`,
      );
      set({ weekCounts: rooms, weekHolidays: holidays });
    } finally {
      set({ loading: false });
    }
  },
}));
