import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { RealtimeSubscriber } from "@/components/layout/realtime-subscriber";
import { CloudRestoreProgress } from "@/components/settings/cloud-restore-progress";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useTitleStore } from "@/lib/stores/title-store";
import { useLoadingStore } from "@/lib/stores/loading-store";
import { useUIStore } from "@/lib/stores/ui-store";
import { storeAuthRedirect } from "@/lib/auth-redirect";

function AuthGate({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const hydrate = useAuthStore((s) => s.hydrate);
  const unblock = useLoadingStore((s) => s.unblock);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const hasToken = hydrate();
    if (!hasToken) {
      storeAuthRedirect(
        `${location.pathname}${location.search}${location.hash}`,
      );
      navigate("/", { replace: true });
    } else {
      setChecked(true);
      unblock();
    }
  }, [navigate, hydrate, unblock, location]);

  if (!checked) return null;

  return <>{children}</>;
}

export function DashboardWrapper({ children }: { children: React.ReactNode }) {
  const title = useTitleStore((s) => s.title);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);

  return (
    <TooltipProvider>
      <AuthGate>
        <RealtimeSubscriber />
        <CloudRestoreProgress />
        <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <AppSidebar />
          <SidebarInset className="min-w-0">
            <AppHeader title={title} />
            <div className="flex flex-col items-center w-full min-w-0">
              <div className="flex-1 w-full px-4 py-4 min-w-0 max-w-full sm:w-[90%] sm:p-6">
                {children}
              </div>
            </div>
          </SidebarInset>
        </SidebarProvider>
        <Toaster />
      </AuthGate>
    </TooltipProvider>
  );
}
