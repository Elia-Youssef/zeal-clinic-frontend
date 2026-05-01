
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PageHeader({
  backHref,
  title,
  onEdit,
  onDelete,
}: {
  backHref?: string;
  title: string;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
    } else if (backHref) {
      navigate(backHref);
    }
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={handleBack}>
          <ArrowLeft className="size-4 mr-1" />
        </Button>
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
      {(onEdit || onDelete) && (
        <div className="flex gap-2">
          {onEdit && (
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil className="size-4 mr-1" /> Edit
            </Button>
          )}
          {onDelete && (
            <Button variant="destructive" size="sm" onClick={onDelete}>
              <Trash2 className="size-4 mr-1" /> Delete
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
