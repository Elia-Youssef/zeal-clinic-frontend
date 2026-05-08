
import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * DateInput displays dd / mm / yyyy and stores YYYY-MM-DD internally.
 * For datetime mode, displays dd / mm / yyyy  HH:mm and stores YYYY-MM-DDTHH:mm.
 */
export function DateInput({
  value,
  onChange,
  mode = "date",
  required,
  className,
}: {
  value: string;
  onChange: (iso: string) => void;
  mode?: "date" | "datetime";
  required?: boolean;
  className?: string;
}) {
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");

  const monthRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);
  const hoursRef = useRef<HTMLInputElement>(null);
  const minutesRef = useRef<HTMLInputElement>(null);

  /* Sync from external value (YYYY-MM-DD or YYYY-MM-DDTHH:mm) */
  useEffect(() => {
    if (!value) {
      setDay("");
      setMonth("");
      setYear("");
      setHours("");
      setMinutes("");
      return;
    }
    const datePart = value.split("T")[0];
    const timePart = value.split("T")[1] ?? "";
    const [y, m, d] = datePart.split("-");
    setDay(d ?? "");
    setMonth(m ?? "");
    setYear(y ?? "");
    if (mode === "datetime" && timePart) {
      const [h, min] = timePart.replace("Z", "").split(":");
      setHours(h ?? "");
      setMinutes(min ?? "");
    }
  }, [value, mode]);

  /* Emit ISO string when all parts are filled */
  const emit = (d: string, m: string, y: string, h?: string, min?: string) => {
    if (d && m && y && y.length === 4) {
      const iso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
      if (mode === "datetime") {
        if (h && min) {
          onChange(`${iso}T${h.padStart(2, "0")}:${min.padStart(2, "0")}`);
        }
      } else {
        onChange(iso);
      }
    } else if (!d && !m && !y) {
      onChange("");
    }
  };

  const inputBase =
    "bg-transparent text-center outline-none placeholder:text-muted-foreground tabular-nums";

  const handleDayChange = (v: string) => {
    const clean = v.replace(/\D/g, "").slice(0, 2);
    setDay(clean);
    if (clean.length === 2) monthRef.current?.focus();
    emit(clean, month, year, hours, minutes);
  };

  const handleMonthChange = (v: string) => {
    const clean = v.replace(/\D/g, "").slice(0, 2);
    setMonth(clean);
    if (clean.length === 2) yearRef.current?.focus();
    emit(day, clean, year, hours, minutes);
  };

  const handleYearChange = (v: string) => {
    const clean = v.replace(/\D/g, "").slice(0, 4);
    setYear(clean);
    if (clean.length === 4 && mode === "datetime") hoursRef.current?.focus();
    emit(day, month, clean, hours, minutes);
  };

  const handleHoursChange = (v: string) => {
    const clean = v.replace(/\D/g, "").slice(0, 2);
    setHours(clean);
    if (clean.length === 2) minutesRef.current?.focus();
    emit(day, month, year, clean, minutes);
  };

  const handleMinutesChange = (v: string) => {
    const clean = v.replace(/\D/g, "").slice(0, 2);
    setMinutes(clean);
    emit(day, month, year, hours, clean);
  };

  const hasValue = !!(day || month || year || hours || minutes);
  const showClear = !required && hasValue;

  const clear = () => {
    setDay("");
    setMonth("");
    setYear("");
    setHours("");
    setMinutes("");
    onChange("");
  };

  return (
    <div
      className={cn(
        "flex h-8 items-center gap-0.5 rounded-lg border border-input bg-transparent px-2.5 text-base transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 md:text-sm dark:bg-input/30",
        className,
      )}
    >
      <input
        className={cn(inputBase, "w-6")}
        placeholder="DD"
        value={day}
        onChange={(e) => handleDayChange(e.target.value)}
        required={required}
        inputMode="numeric"
      />
      <span className="text-muted-foreground">/</span>
      <input
        ref={monthRef}
        className={cn(inputBase, "w-7")}
        placeholder="MM"
        value={month}
        onChange={(e) => handleMonthChange(e.target.value)}
        required={required}
        inputMode="numeric"
      />
      <span className="text-muted-foreground">/</span>
      <input
        ref={yearRef}
        className={cn(inputBase, "w-10")}
        placeholder="YYYY"
        value={year}
        onChange={(e) => handleYearChange(e.target.value)}
        required={required}
        inputMode="numeric"
      />
      {mode === "datetime" && (
        <>
          <span className="ml-1.5 text-muted-foreground">|</span>
          <input
            ref={hoursRef}
            className={cn(inputBase, "ml-1.5 w-6")}
            placeholder="HH"
            value={hours}
            onChange={(e) => handleHoursChange(e.target.value)}
            required={required}
            inputMode="numeric"
          />
          <span className="text-muted-foreground">:</span>
          <input
            ref={minutesRef}
            className={cn(inputBase, "w-6")}
            placeholder="mm"
            value={minutes}
            onChange={(e) => handleMinutesChange(e.target.value)}
            required={required}
            inputMode="numeric"
          />
        </>
      )}
      {showClear && (
        <button
          type="button"
          aria-label="Clear date"
          onClick={clear}
          className="ml-auto inline-flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground opacity-60 transition-opacity hover:opacity-100"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
