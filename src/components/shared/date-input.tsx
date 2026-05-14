import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

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

  const isValidDateParts = (d: string, m: string, y: string) => {
    if (d.length === 0 || m.length === 0 || y.length !== 4) return false;
    const dayNum = Number(d);
    const monthNum = Number(m);
    const yearNum = Number(y);
    if (
      !Number.isInteger(dayNum) ||
      !Number.isInteger(monthNum) ||
      !Number.isInteger(yearNum) ||
      dayNum < 1 ||
      monthNum < 1 ||
      monthNum > 12
    ) {
      return false;
    }
    const parsed = new Date(yearNum, monthNum - 1, dayNum);
    return (
      parsed.getFullYear() === yearNum &&
      parsed.getMonth() === monthNum - 1 &&
      parsed.getDate() === dayNum
    );
  };

  const isValidTimeParts = (h: string, min: string) => {
    if (h.length === 0 || min.length === 0) return false;
    const hourNum = Number(h);
    const minuteNum = Number(min);
    return (
      Number.isInteger(hourNum) &&
      Number.isInteger(minuteNum) &&
      hourNum >= 0 &&
      hourNum <= 23 &&
      minuteNum >= 0 &&
      minuteNum <= 59
    );
  };

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

  const emit = (d: string, m: string, y: string, h?: string, min?: string) => {
    if (d && m && y && y.length === 4) {
      if (!isValidDateParts(d, m, y)) {
        onChange("");
        return;
      }
      const iso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
      if (mode === "datetime") {
        if (h && min) {
          if (!isValidTimeParts(h, min)) {
            onChange("");
            return;
          }
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
    if (clean.length === 2) {
      const n = Number(clean);
      if (n < 1 || n > 31) return;
    }
    setDay(clean);
    if (clean.length === 2) monthRef.current?.focus();
    emit(clean, month, year, hours, minutes);
  };

  const handleMonthChange = (v: string) => {
    const clean = v.replace(/\D/g, "").slice(0, 2);
    if (clean.length === 2) {
      const n = Number(clean);
      if (n < 1 || n > 12) return;
    }
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
    if (clean.length === 2) {
      const n = Number(clean);
      if (n < 0 || n > 23) return;
    }
    setHours(clean);
    if (clean.length === 2) minutesRef.current?.focus();
    emit(day, month, year, clean, minutes);
  };

  const handleMinutesChange = (v: string) => {
    const clean = v.replace(/\D/g, "").slice(0, 2);
    if (clean.length === 2) {
      const n = Number(clean);
      if (n < 0 || n > 59) return;
    }
    setMinutes(clean);
    emit(day, month, year, hours, clean);
  };

  const hasValue = !!(day || month || year || hours || minutes);
  const showClear = !required && hasValue;
  const fullDateInvalid =
    !!day && !!month && year.length === 4 && !isValidDateParts(day, month, year);
  const fullTimeInvalid =
    mode === "datetime" &&
    !!hours &&
    !!minutes &&
    !isValidTimeParts(hours, minutes);
  const invalid = fullDateInvalid || fullTimeInvalid;

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
        invalid && "border-destructive focus-within:border-destructive focus-within:ring-destructive/20",
        className,
      )}
      aria-invalid={invalid}
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
