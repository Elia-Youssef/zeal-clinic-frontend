import { useEffect, useRef, useState } from "react";
import { ArrowUpCircle, CheckCircle2, Download, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/shared/loading";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import { useAlertStore } from "@/lib/stores/alert-store";
import { usePermissions } from "@/hooks/use-permissions";
import { usePageTitle } from "@/hooks/use-page-title";
import { useConfirm } from "@/hooks/use-confirm";
import type { StartUpdateResult, UpdateStatus } from "@/lib/types";
import { beirutDayKey } from "@/lib/tz";

const POLL_INTERVAL = 3000;

export default function AboutPage() {
  usePageTitle("About");
  const addAlert = useAlertStore((s) => s.addAlert);
  const confirm = useConfirm();
  const { can } = usePermissions();
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [installing, setInstalling] = useState(false);
  const activeRef = useRef(true);

  useEffect(() => {
    activeRef.current = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get<UpdateStatus>("/update/status");
        if (!activeRef.current) return;
        setStatus(res);
        if (res.installing) setInstalling(true);
      } catch (err) {
        addAlert("error", getErrorMessage(err));
        if (activeRef.current) setStatus(null);
      } finally {
        if (activeRef.current) setLoading(false);
      }
    };
    load();
    return () => {
      activeRef.current = false;
    };
  }, [addAlert]);

  useEffect(() => {
    if (!installing) return;
    let timer: ReturnType<typeof setTimeout>;
    let active = true;

    const poll = async () => {
      if (!active) return;
      try {
        const res = await api.get<UpdateStatus>("/update/status");
        if (!active) return;
        setStatus(res);
        if (!res.installing) {
          setInstalling(false);
          if (!res.available) {
            addAlert("success", `Updated to version ${res.current}.`);
          }
          return;
        }
      } catch {
        // Server is likely restarting; swallow and keep polling.
      }
      if (active) timer = setTimeout(poll, POLL_INTERVAL);
    };

    timer = setTimeout(poll, POLL_INTERVAL);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [installing, addAlert]);

  const handleStart = async () => {
    const ok = await confirm({
      title: "Install update?",
      description:
        "The app will restart to install the update and will be unavailable for a couple of minutes. Make sure no one is in the middle of a task before continuing.",
      confirmText: "Update now",
    });
    if (!ok) return;

    setStarting(true);
    try {
      const res = await api.post<StartUpdateResult>("/update/start");
      setInstalling(true);
      if (res.warning) addAlert("warning", res.warning);
    } catch (err) {
      // 409 (no update / already installing), 502 (sync failed), 503 (gate).
      addAlert("error", getErrorMessage(err));
      // Refresh so the button reflects reality (e.g. another node updated).
      try {
        const res = await api.get<UpdateStatus>("/update/status");
        if (activeRef.current) {
          setStatus(res);
          setInstalling(res.installing);
        }
      } catch {
        // ignore: the original error was already surfaced.
      }
    } finally {
      setStarting(false);
    }
  };

  if (loading) return <Loading />;
  if (!status) {
    return (
      <p className="py-12 text-center text-muted-foreground">
        Update status is unavailable.
      </p>
    );
  }

  return (
    <div className="flex items-center justify-around">
      <Card className="w-full max-w-100">
        <CardHeader className="flex flex-col items-center text-center">
          <div className="aspect-square size-14 rounded-xl overflow-hidden mb-2">
            <div
              className="size-full bg-cover bg-center bg-no-repeat"
              style={{ backgroundImage: `url(/zeal.png)` }}
            />
          </div>
          <CardTitle className="text-xl">Zeal Clinic</CardTitle>
          <CardDescription>About this software</CardDescription>
        </CardHeader>

        <CardContent>
          <div className="flex flex-col gap-6 mt-2">
            <div>
              <div className="flex items-center justify-center gap-2">
                <span className="text-sm text-muted-foreground">Version:</span>
                <span className="text-sm font-mono">{status.current}</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                Installed On: {beirutDayKey(status.releasedAt)}
              </div>
            </div>

            {installing ? (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                <span>Updating… this may take a couple of minutes</span>
              </div>
            ) : status.available ? (
              <div className="space-y-3">
                {can("update:write") ? (
                  <Button
                    className="w-full"
                    onClick={handleStart}
                    disabled={starting}
                  >
                    {starting ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Download />
                    )}
                    Update
                  </Button>
                ) : (
                  <p className="text-center text-xs text-muted-foreground">
                    An update is available. Ask an administrator to install it.
                  </p>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center text-sm text-muted-foreground">
                No new updates
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
