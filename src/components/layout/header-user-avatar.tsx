
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Sun, Moon, ZoomIn, User } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useLoadingStore } from "@/lib/stores/loading-store";
import { useRealtimeStore } from "@/lib/stores/realtime-store";
import { SCALE_BOUNDS, useUIStore } from "@/lib/stores/ui-store";

function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function HeaderUserAvatar() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const logout = useAuthStore((s) => s.logout);
  const isConnected = useRealtimeStore((s) => s.isConnected);
  const cloudConnected = useRealtimeStore((s) => s.cloudConnected);
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const scale = useUIStore((s) => s.scale);
  const setScale = useUIStore((s) => s.setScale);
  const [pendingScale, setPendingScale] = useState(scale);
  const connectionClass =
    !isConnected || cloudConnected === null
      ? "bg-muted-foreground/50"
      : cloudConnected
        ? "bg-positive"
        : "bg-warning";

  useEffect(() => {
    setPendingScale(scale);
  }, [scale]);

  const handleLogout = async () => {
    useLoadingStore.getState().block("Signing out");
    try {
      await api.post("/auth/logout");
    } catch {
      // Local logout still proceeds.
    }
    logout();
    navigate("/");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="relative inline-flex outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full"
            aria-label="Staff menu"
          >
            <Avatar size="sm">
              <AvatarFallback>{getInitials(user)}</AvatarFallback>
            </Avatar>
            <span
              className={cn(
                "absolute -right-0.5 -bottom-0.5 size-2 rounded-full ring-2 ring-background",
                connectionClass,
              )}
            />
          </button>
        }
      />
      <DropdownMenuContent align="end" className="w-64">
        <div
          className="px-2 py-2 flex flex-col gap-2"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <ZoomIn className="size-4" />
              Scale
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">
              {Math.round(pendingScale * 100)}%
            </span>
          </div>
          <Slider
            min={SCALE_BOUNDS.min}
            max={SCALE_BOUNDS.max}
            step={SCALE_BOUNDS.step}
            value={pendingScale}
            onValueChange={(v) =>
              setPendingScale(
                typeof v === "number" ? v : (v[0] ?? SCALE_BOUNDS.default),
              )
            }
            onValueCommitted={(v) =>
              setScale(
                typeof v === "number" ? v : (v[0] ?? SCALE_BOUNDS.default),
              )
            }
          />
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => navigate("/profile")}
          className="flex items-center gap-2"
        >
          <User className="size-4" />
          <span>My Profile</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          closeOnClick={false}
          onClick={toggleTheme}
          className="flex items-center gap-2"
        >
          {theme === "light" ? (
            <Moon className="size-4" />
          ) : (
            <Sun className="size-4" />
          )}
          <span>{theme === "light" ? "Dark mode" : "Light mode"}</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          variant="destructive"
          onClick={handleLogout}
          className="flex items-center gap-2"
        >
          <LogOut className="size-4" />
          <span>Logout</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
