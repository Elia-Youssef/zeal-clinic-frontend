import { Toaster as Sonner, type ToasterProps } from "sonner";
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from "lucide-react";
import { useUIStore } from "@/lib/stores/ui-store";

// Toasts follow the app's own theme (the staff menu's light/dark switch).
const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useUIStore((s) => s.theme);

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      // Drop top-anchored toasts (the notification toast) below the sticky
      // h-14 header. Other sides keep Sonner's default spacing.
      offset={{ top: "3rem" }}
      mobileOffset={{ top: "3rem" }}
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      richColors
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
          "--success-bg": "var(--popover)",
          "--success-text": "var(--positive)",
          "--success-border":
            "color-mix(in oklab, var(--positive) 35%, var(--border))",
          "--error-bg": "var(--popover)",
          "--error-text": "var(--destructive)",
          "--error-border":
            "color-mix(in oklab, var(--destructive) 35%, var(--border))",
          "--warning-bg": "var(--popover)",
          "--warning-text": "var(--status-progress)",
          "--warning-border":
            "color-mix(in oklab, var(--status-progress) 35%, var(--border))",
          "--info-bg": "var(--popover)",
          "--info-text": "var(--foreground)",
          "--info-border": "var(--border)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
