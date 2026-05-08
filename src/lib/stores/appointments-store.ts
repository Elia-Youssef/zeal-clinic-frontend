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
    // The API contract requires a specific date query, so the schedule layer
    // asks for the exact day(s) it needs and this store normalizes the result
    // into one ordered list for the Day view.
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
      // Keep the merged list stable so the calendar rendering stays predictable
      // regardless of the order the API requests resolve.
      const appointments = responses
        .flatMap((res) => res.items)
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
      // Each response carries holidays for its specific date; merge across
      // dates and dedupe by id so a multi-day holiday isn't duplicated.
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
    // Week view needs per-room/per-day counts plus any holidays intersecting
    // the Mon–Sun window containing `date`. Server returns both in one call.
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
