
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { HeaderSearch } from "@/components/layout/header-search";
import { HeaderQuickActions } from "@/components/layout/header-quick-actions";
import { HeaderNotifications } from "@/components/layout/header-notifications";
import { HeaderUserAvatar } from "@/components/layout/header-user-avatar";

export function AppHeader({ title }: { title: string }) {
  return (
    <header className="grid h-14 shrink-0 grid-cols-3 items-center gap-2 border-b px-4 sticky top-0 bg-background z-20">
      <div className="flex min-w-0 items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2" />
        <h1 className="truncate text-sm font-semibold">{title}</h1>
      </div>

      <div className="flex justify-center">
        <HeaderSearch />
      </div>

      <div className="flex items-center justify-end gap-2">
        <HeaderQuickActions />
        <HeaderNotifications />
        <HeaderUserAvatar />
      </div>
    </header>
  );
}
