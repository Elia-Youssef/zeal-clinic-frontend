import { Loader2 } from "lucide-react"

export function Loading({ message = "Loading…" }: { message?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
      <Loader2 className="size-5 animate-spin" />
      <span>{message}</span>
    </div>
  )
}
