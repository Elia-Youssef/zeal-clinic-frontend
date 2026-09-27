import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PageHeader({
  backHref,
  title,
  onEdit,
  onDelete,
  extraActions,
}: {
  backHref?: string;
  title: string;
  onEdit?: () => void;
  onDelete?: () => void;
  extraActions?: ReactNode;
}) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else if (backHref) {
      navigate(backHref);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Button variant="ghost" size="sm" onClick={handleBack} aria-label="Back">
          <ArrowLeft className="size-4" />
        </Button>
        <h2 className="min-w-0 truncate text-xl font-semibold">{title}</h2>
      </div>
      {(onEdit || onDelete || extraActions) && (
        <div className="ml-auto flex flex-wrap justify-end gap-2">
          {extraActions}
          {onEdit && (
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil className="size-4" /> Edit
            </Button>
          )}
          {onDelete && (
            <Button variant="destructive" size="sm" onClick={onDelete}>
              <Trash2 className="size-4" /> Delete
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
