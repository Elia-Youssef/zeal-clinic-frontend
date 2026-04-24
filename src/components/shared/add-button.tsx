import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AddButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <Button size="sm" className="gap-1" onClick={onClick}>
      <Plus className="size-4" /> {label}
    </Button>
  );
}
