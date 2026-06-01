import { useState, type ReactNode } from "react";
import { FileStack, Plus, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import type { FormDraftsApi } from "@/hooks/use-form-drafts";
import type { FormDraft } from "@/lib/stores/form-drafts-store";

// The drafts rail: "New" entry + one row per draft. Pass showHeader={false}
// inside the mobile Sheet, which has its own title.
export function FormDrafts<T>({
  list,
  activeId,
  isNew,
  onNew,
  onSelect,
  onDelete,
  newLabel = "New",
  showHeader = true,
  className,
}: {
  list: FormDraft<T>[];
  activeId: string | null;
  isNew: boolean;
  onNew: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  newLabel?: string;
  showHeader?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col", className)}>
      {showHeader && (
        <div className="flex items-center gap-2 px-1 pb-2.5">
          <FileStack className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Drafts</h3>
          {list.length > 0 && (
            <span className="ml-auto rounded-full bg-muted px-1.5 text-xs leading-5 text-muted-foreground">
              {list.length}
            </span>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={onNew}
        className={cn(
          "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-sm transition-colors",
          isNew
            ? "border-border bg-accent font-medium"
            : "border-dashed border-border text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <Plus className="size-4 shrink-0" />
        <span className="truncate">{newLabel}</span>
      </button>

      <Separator className="my-2.5" />

      <div className="flex flex-col gap-1">
        {list.length === 0 ? (
          <p className="px-1 text-xs text-muted-foreground">
            No saved drafts yet.
          </p>
        ) : (
          list.map((draft) => {
            const active = draft.id === activeId;
            return (
              <div
                key={draft.id}
                className={cn(
                  "group flex items-center gap-0.5 rounded-lg border pr-0.5 transition-colors",
                  active
                    ? "border-border bg-accent"
                    : "border-transparent hover:bg-muted",
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(draft.id)}
                  className="flex min-w-0 flex-1 flex-col items-start py-1.5 pl-2.5 text-left"
                >
                  <span
                    className={cn(
                      "w-full truncate text-sm",
                      active && "font-medium",
                    )}
                  >
                    {draft.label}
                  </span>
                  <span className="w-full truncate text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(draft.updatedAt), {
                      addSuffix: true,
                    })}
                  </span>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label="Delete draft"
                  onClick={() => onDelete(draft.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// Wraps a form with its drafts UI: disabled -> form as-is; desktop -> docked
// left rail (set the Modal to size="wide"); mobile -> a "Drafts" trigger + Sheet.
export function FormDraftsLayout<T>({
  drafts,
  children,
}: {
  drafts: FormDraftsApi<T>;
  children: ReactNode;
}) {
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);

  if (!drafts.enabled) return <>{children}</>;

  // closing the sheet on action is a no-op on desktop, so the same handlers serve both branches.
  const draftsList = (
    <FormDrafts
      list={drafts.list}
      activeId={drafts.activeId}
      isNew={drafts.isNew}
      showHeader={!isMobile}
      onNew={() => {
        drafts.selectNew();
        setSheetOpen(false);
      }}
      onSelect={(id) => {
        drafts.loadDraft(id);
        setSheetOpen(false);
      }}
      onDelete={drafts.deleteDraft}
    />
  );

  if (isMobile) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSheetOpen(true)}
          >
            <FileStack className="mr-1 size-3.5" /> Drafts ({drafts.list.length})
          </Button>
          {drafts.showSaveButton && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={drafts.saveNow}
              disabled={!drafts.dirty}
            >
              Save draft
            </Button>
          )}
        </div>
        {children}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="left" className="w-80">
            <SheetHeader>
              <SheetTitle>Drafts</SheetTitle>
            </SheetHeader>
            <div className="overflow-y-auto px-4 pb-4">{draftsList}</div>
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  return (
    <div className="flex gap-5">
      {/* aside stretches full height (divider runs the whole modal); inner div stays sticky */}
      <aside className="w-56 shrink-0 border-r border-border pr-5">
        <div className="sticky top-0 space-y-3">
          {draftsList}
          {drafts.showSaveButton && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={drafts.saveNow}
              disabled={!drafts.dirty}
            >
              Save draft
            </Button>
          )}
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
