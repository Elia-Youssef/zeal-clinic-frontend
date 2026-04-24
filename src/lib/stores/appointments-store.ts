import { create } from "zustand";
import { api, type Paginated } from "@/lib/api";
import type { Appointment, RoomDayCount } from "@/lib/types";

type AppointmentsState = {
  appointments: Appointment[];
  weekCounts: RoomDayCount[];
  loading: boolean;
  fetchForDates: (dates: string[]) => Promise<void>;
  fetchWeekCounts: (date: string) => Promise<void>;
};

export const useAppointmentsStore = create<AppointmentsState>((set) => ({
  appointments: [],
  weekCounts: [],
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
          api.get<Paginated<Appointment>>(`/appointments?date=${date}`),
        ),
      );
      // Keep the merged list stable so the calendar rendering stays predictable
      // regardless of the order the API requests resolve.
      const appointments = responses
        .flatMap((res) => res.items)
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
      set({ appointments });
    } finally {
      set({ loading: false });
    }
  },

  fetchWeekCounts: async (date) => {
    // Week view only needs per-room/per-day counts. The server resolves the
    // Mon–Sun window containing `date` and returns sparse day maps.
    set({ loading: true });
    try {
      const weekCounts = await api.get<RoomDayCount[]>(
        `/appointments/count-per-room?date=${date}`,
      );
      set({ weekCounts });
    } finally {
      set({ loading: false });
    }
  },
}));
