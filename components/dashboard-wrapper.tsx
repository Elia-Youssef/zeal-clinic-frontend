"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { RealtimeSubscriber } from "@/components/realtime-subscriber";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useTitleStore } from "@/lib/stores/title-store";
import { useLoadingStore } from "@/lib/stores/loading-store";

function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const hydrate = useAuthStore((s) => s.hydrate);
  const hideLoading = useLoadingStore((s) => s.hide);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const hasToken = hydrate();
    if (!hasToken) {
      router.replace("/");
    } else {
      setChecked(true);
      hideLoading();
    }
  }, [router, hydrate, hideLoading]);

  if (!checked) return null;

  return <>{children}</>;
}

export function DashboardWrapper({ children }: { children: React.ReactNode }) {
  const title = useTitleStore((s) => s.title);

  return (
    <TooltipProvider>
      <AuthGate>
        <RealtimeSubscriber />
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <AppHeader title={title} />
            <div className="flex flex-col items-center w-full">
              <div className="flex-1 overflow-auto p-6 min-w-[600px] w-[80%]">
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
