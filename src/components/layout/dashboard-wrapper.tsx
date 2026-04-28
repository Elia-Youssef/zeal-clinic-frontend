
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { RealtimeSubscriber } from "@/components/layout/realtime-subscriber";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useTitleStore } from "@/lib/stores/title-store";
import { useLoadingStore } from "@/lib/stores/loading-store";
import { useUIStore } from "@/lib/stores/ui-store";

function AuthGate({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const hydrate = useAuthStore((s) => s.hydrate);
  const hideLoading = useLoadingStore((s) => s.hide);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const hasToken = hydrate();
    if (!hasToken) {
      navigate("/", { replace: true });
    } else {
      setChecked(true);
      hideLoading();
    }
  }, [navigate, hydrate, hideLoading]);

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
        <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <AppSidebar />
          <SidebarInset>
            <AppHeader title={title} />
            <div className="flex flex-col items-center w-full">
              <div className="flex-1 overflow-auto p-6 min-w-150 w-[90%]">
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
