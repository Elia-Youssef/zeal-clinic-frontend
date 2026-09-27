import { useEffect, useMemo, useRef, useState } from "react";
import type { Appointment, Room } from "@/lib/types";
import type { AppointmentDragMode } from "@/components/shared/appointment-card";
import {
  GRID_LEAD_REM,
  GRID_TOTAL_MINUTES,
  HOUR_HEIGHT,
  isoToDate,
  isoToGridMinutes,
} from "./sched-utils";

const SNAP = 15;
const MIN_DURATION = 15;
const LONG_PRESS_MS = 350;
const MOUSE_THRESHOLD = 4;
const TOUCH_SLOP = 10;
const EDGE_ZONE = 48;
const MAX_SCROLL_STEP = 14;

export type DragCandidate = {
  roomId: string;
  roomIndex: number;
  startMin: number;
  endMin: number;
  valid: boolean;
};

export type ActiveDrag = {
  appt: Appointment;
  mode: AppointmentDragMode;
  candidate: DragCandidate;
};

type Session = {
  appt: Appointment;
  mode: AppointmentDragMode;
  pointerId: number;
  remPx: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  origRoomIndex: number;
  origStartMin: number;
  origEndMin: number;
  grabOffsetMin: number;
  activated: boolean;
  candidate: DragCandidate | null;
  longPressTimer: number | null;
  raf: number | null;
};

const snap = (min: number) => Math.round(min / SNAP) * SNAP;
const clamp = (v: number, lo: number, hi: number) =>
  Math.min(Math.max(v, lo), hi);

function suppressNextClick() {
  const swallow = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    cleanup();
  };
  const cleanup = () => {
    window.removeEventListener("click", swallow, true);
    clearTimeout(timer);
  };
  window.addEventListener("click", swallow, true);
  const timer = setTimeout(cleanup, 300);
}

export function useAppointmentDrag({
  enabled,
  rooms,
  appointmentsByRoom,
  gridRef,
  scrollRef,
  scheduleOffsetRem,
  onDrop,
}: {
  enabled: boolean;
  rooms: Room[];
  appointmentsByRoom: Record<string, Appointment[]>;
  gridRef: React.RefObject<HTMLDivElement | null>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  scheduleOffsetRem: number;
  onDrop: (appt: Appointment, candidate: DragCandidate) => void;
}) {
  const [drag, setDrag] = useState<ActiveDrag | null>(null);
  const session = useRef<Session | null>(null);

  const inputs = useRef({
    enabled,
    rooms,
    appointmentsByRoom,
    scheduleOffsetRem,
    onDrop,
  });
  useEffect(() => {
    inputs.current = {
      enabled,
      rooms,
      appointmentsByRoom,
      scheduleOffsetRem,
      onDrop,
    };
  });

  const ctrl = useMemo(() => {
    const preventTouchScroll = (e: TouchEvent) => e.preventDefault();

    const updateCandidate = (s: Session) => {
      const grid = gridRef.current;
      if (!grid) return;
      const { rooms, appointmentsByRoom } = inputs.current;
      const rect = grid.getBoundingClientRect();
      const hourPx = HOUR_HEIGHT * s.remPx;

      let roomIndex = s.origRoomIndex;
      if (s.mode === "move") {
        const leadPx = GRID_LEAD_REM * s.remPx;
        const roomW = (rect.width - leadPx) / rooms.length;
        if (roomW > 0) {
          roomIndex = clamp(
            Math.floor((s.lastX - rect.left - leadPx) / roomW),
            0,
            rooms.length - 1,
          );
        }
      }

      const scheduleTop = rect.top + inputs.current.scheduleOffsetRem * s.remPx;
      const pointerMin = ((s.lastY - scheduleTop) / hourPx) * 60;
      let startMin = s.origStartMin;
      let endMin = s.origEndMin;
      if (s.mode === "move") {
        const duration = s.origEndMin - s.origStartMin;
        startMin = clamp(
          snap(pointerMin - s.grabOffsetMin),
          0,
          Math.max(0, GRID_TOTAL_MINUTES - duration),
        );
        endMin = Math.min(startMin + duration, GRID_TOTAL_MINUTES);
      } else if (s.mode === "resize-start") {
        startMin = clamp(snap(pointerMin), 0, s.origEndMin - MIN_DURATION);
      } else {
        endMin = clamp(
          snap(pointerMin),
          s.origStartMin + MIN_DURATION,
          GRID_TOTAL_MINUTES,
        );
      }

      const roomId = rooms[roomIndex].id;
      const valid = !(appointmentsByRoom[roomId] ?? []).some(
        (other) => {
          if (
            other.id === s.appt.id ||
            other.status === "Cancelled" ||
            other.status === "Rescheduled"
          ) {
            return false;
          }
          const otherStart = isoToGridMinutes(other.startTime);
          let otherEnd = isoToGridMinutes(other.endTime);
          if (isoToDate(other.endTime) > isoToDate(other.startTime)) {
            otherEnd += 24 * 60;
          }
          return startMin < otherEnd && endMin > otherStart;
        },
      );

      const prev = s.candidate;
      if (
        prev &&
        prev.roomIndex === roomIndex &&
        prev.startMin === startMin &&
        prev.endMin === endMin &&
        prev.valid === valid
      ) {
        return;
      }
      s.candidate = { roomId, roomIndex, startMin, endMin, valid };
      setDrag({ appt: s.appt, mode: s.mode, candidate: s.candidate });
    };

    const tick = () => {
      const s = session.current;
      if (!s?.activated) return;
      const scroller = scrollRef.current;
      if (scroller) {
        const r = scroller.getBoundingClientRect();
        let dy = 0;
        if (s.lastY < r.top + EDGE_ZONE) {
          dy = -stepFor(r.top + EDGE_ZONE - s.lastY);
        } else if (s.lastY > r.bottom - EDGE_ZONE) {
          dy = stepFor(s.lastY - (r.bottom - EDGE_ZONE));
        }
        if (dy) {
          const before = scroller.scrollTop;
          scroller.scrollTop = before + dy;
          if (scroller.scrollTop !== before) updateCandidate(s);
        }
      }
      s.raf = requestAnimationFrame(tick);
    };
    const stepFor = (depth: number) =>
      Math.ceil(clamp(depth / EDGE_ZONE, 0, 1) * MAX_SCROLL_STEP);

    const activate = () => {
      const s = session.current;
      if (!s || s.activated) return;
      if (s.longPressTimer != null) {
        clearTimeout(s.longPressTimer);
        s.longPressTimer = null;
      }
      s.activated = true;
      document.body.classList.add("select-none");
      window.addEventListener("touchmove", preventTouchScroll, {
        passive: false,
      });
      window.addEventListener("keydown", onKeyDown);
      s.raf = requestAnimationFrame(tick);
      updateCandidate(s);
    };

    const onPointerMove = (e: PointerEvent) => {
      const s = session.current;
      if (!s || e.pointerId !== s.pointerId) return;
      s.lastX = e.clientX;
      s.lastY = e.clientY;
      if (!s.activated) {
        const dist = Math.hypot(e.clientX - s.startX, e.clientY - s.startY);
        if (s.longPressTimer != null) {
          if (dist > TOUCH_SLOP) endSession();
        } else if (dist > MOUSE_THRESHOLD) {
          activate();
        }
        return;
      }
      updateCandidate(s);
    };

    const onPointerUp = (e: PointerEvent) => {
      const s = session.current;
      if (!s || e.pointerId !== s.pointerId) return;
      if (s.activated) {
        suppressNextClick();
        const c = s.candidate;
        const changed =
          c &&
          (c.roomIndex !== s.origRoomIndex ||
            c.startMin !== s.origStartMin ||
            c.endMin !== s.origEndMin);
        if (c?.valid && changed) inputs.current.onDrop(s.appt, c);
      }
      endSession();
    };

    const onPointerCancel = (e: PointerEvent) => {
      const s = session.current;
      if (!s || e.pointerId !== s.pointerId) return;
      endSession();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") endSession();
    };

    const endSession = () => {
      const s = session.current;
      if (!s) return;
      if (s.longPressTimer != null) clearTimeout(s.longPressTimer);
      if (s.raf != null) cancelAnimationFrame(s.raf);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("touchmove", preventTouchScroll);
      window.removeEventListener("keydown", onKeyDown);
      document.body.classList.remove("select-none");
      session.current = null;
      setDrag(null);
    };

    const startDrag = (
      e: React.PointerEvent,
      appt: Appointment,
      mode: AppointmentDragMode,
    ) => {
      if (!inputs.current.enabled || session.current) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const grid = gridRef.current;
      if (!grid) return;
      const roomIndex = inputs.current.rooms.findIndex(
        (r) => r.id === appt.roomId,
      );
      if (roomIndex < 0) return;

      const remPx =
        parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const origStartMin = isoToGridMinutes(appt.startTime);
      const gridTop =
        grid.getBoundingClientRect().top +
        inputs.current.scheduleOffsetRem * remPx;
      const pointerMin = ((e.clientY - gridTop) / (HOUR_HEIGHT * remPx)) * 60;

      const s: Session = {
        appt,
        mode,
        pointerId: e.pointerId,
        remPx,
        startX: e.clientX,
        startY: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        origRoomIndex: roomIndex,
        origStartMin,
        origEndMin: isoToGridMinutes(appt.endTime),
        grabOffsetMin: pointerMin - origStartMin,
        activated: false,
        candidate: null,
        longPressTimer: null,
        raf: null,
      };
      session.current = s;
      if (e.pointerType !== "mouse") {
        s.longPressTimer = window.setTimeout(activate, LONG_PRESS_MS);
      }
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerCancel);
    };

    return { startDrag, endSession };
  }, [gridRef, scrollRef]);

  useEffect(() => () => ctrl.endSession(), [ctrl]);

  return { drag, startDrag: ctrl.startDrag };
}
