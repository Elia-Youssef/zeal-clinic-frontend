import { useLoadingStore } from "@/lib/stores/loading-store";

export function LoadingOverlay() {
  const visible = useLoadingStore((s) => s.blocking || s.count > 0);
  const message = useLoadingStore((s) => s.message);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-200 flex items-center justify-center overflow-hidden bg-background"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -left-40 size-112 rounded-full bg-[oklch(0.78_0.08_45/0.18)] blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -right-40 size-112 rounded-full bg-[oklch(0.65_0.05_220/0.15)] blur-3xl"
      />

      <div className="relative flex flex-col items-center gap-6">
        <div className="relative grid place-items-center">
          <svg
            className="absolute inset-0 size-32 -rotate-90 animate-spin animation-duration-[1.6s]"
            viewBox="0 0 100 100"
            fill="none"
            aria-hidden
          >
            <circle
              cx="50"
              cy="50"
              r="46"
              stroke="currentColor"
              strokeOpacity="0.08"
              strokeWidth="2"
              className="text-foreground"
            />
            <circle
              cx="50"
              cy="50"
              r="46"
              stroke="oklch(0.72 0.13 45)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray="72 220"
            />
          </svg>

          <div className="relative size-32 grid place-items-center">
            <div
              aria-hidden
              className="absolute size-24 rounded-full bg-[oklch(0.72_0.13_45/0.25)] blur-2xl animate-pulse"
            />
            <div className="relative size-15 overflow-hidden rounded-xl ring-1 ring-border/60 shadow-lg shadow-[oklch(0.72_0.13_45/0.25)]">
              {/* Decorative: the status message below is what gets announced. */}
              <div
                aria-hidden
                className="size-full bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: "url(/zeal.png)" }}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-1.5">
          {/* <span className="font-heading text-lg font-semibold tracking-tight text-foreground">
            Zeal
          </span> */}
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>{message || "Loading"}</span>
            <span className="inline-flex gap-0.5">
              <span className="size-1 rounded-full bg-muted-foreground/70 animate-bounce [animation-delay:-0.3s]" />
              <span className="size-1 rounded-full bg-muted-foreground/70 animate-bounce [animation-delay:-0.15s]" />
              <span className="size-1 rounded-full bg-muted-foreground/70 animate-bounce" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
