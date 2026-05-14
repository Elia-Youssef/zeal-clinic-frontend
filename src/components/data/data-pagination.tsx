import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export function DataPagination({
  offset,
  limit,
  total,
  onOffsetChange,
}: {
  offset: number;
  limit: number;
  total: number;
  onOffsetChange: (next: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.floor(offset / limit) + 1;
  const isFirst = offset === 0;
  const isLast = offset + limit >= total;
  const rangeStart = total === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + limit, total);

  const goTo = (page: number) => {
    const clamped = Math.max(1, Math.min(totalPages, page));
    onOffsetChange((clamped - 1) * limit);
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm">
      <span className="text-muted-foreground tabular-nums">
        {rangeStart}–{rangeEnd}{" "}
        <span className="text-muted-foreground/70">of</span> {total}
      </span>
      <div className="flex items-center gap-3">
        <span className="hidden text-muted-foreground tabular-nums sm:inline">
          Page <span className="text-foreground">{currentPage}</span>{" "}
          <span className="text-muted-foreground/70">of</span> {totalPages}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="First page"
            disabled={isFirst}
            onClick={() => goTo(1)}
          >
            <ChevronsLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Previous page"
            disabled={isFirst}
            onClick={() => goTo(currentPage - 1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Next page"
            disabled={isLast}
            onClick={() => goTo(currentPage + 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Last page"
            disabled={isLast}
            onClick={() => goTo(totalPages)}
          >
            <ChevronsRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
