import { CheckCircle2, CircleX, Loader2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useRealtimeStore } from "@/lib/stores/realtime-store";

export function CloudRestoreProgress() {
  const progress = useRealtimeStore((s) => s.cloudRestoreProgress);
  const setProgress = useRealtimeStore((s) => s.setCloudRestoreProgress);

  if (!progress) return null;

  const isSuccess = progress.status === "success";
  const isFailed = progress.status === "failed";
  const percent = Math.min(
    100,
    Math.max(0, Math.round((progress.step / progress.maxSteps) * 100)),
  );
  const isRunning = progress.status === "running";

  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open && !isRunning) setProgress(null);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader className="place-items-start text-left">
          <div className="flex items-center gap-2">
            {isSuccess ? (
              <CheckCircle2 className="size-5 shrink-0 text-positive" />
            ) : isFailed ? (
              <CircleX className="size-5 shrink-0 text-destructive" />
            ) : (
              <Loader2 className="size-5 shrink-0 animate-spin text-status-progress" />
            )}
            <AlertDialogTitle>
              {isSuccess
                ? "Cloud restore completed"
                : isFailed
                  ? "Cloud restore failed"
                  : "Cloud restore in progress"}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription>
            {isSuccess
              ? "The cloud data was synchronized with the local instance."
              : isFailed
                ? "The cloud restore stopped before it could finish."
                : "The cloud data is being synchronized with the local instance."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3" role="status" aria-live="polite">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">{progress.message}</p>
            {!isSuccess && (
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {progress.step}/{progress.maxSteps}
              </span>
            )}
          </div>

          <div
            className="h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Cloud restore progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-500",
                isFailed
                  ? "bg-destructive"
                  : isSuccess
                    ? "bg-positive"
                    : "bg-status-progress",
              )}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        {isRunning ? (
          <p className="text-center text-xs text-muted-foreground">
            This dialog cannot be dismissed until the restore finishes.
          </p>
        ) : (
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setProgress(null)}>
              Dismiss
            </AlertDialogAction>
          </AlertDialogFooter>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
