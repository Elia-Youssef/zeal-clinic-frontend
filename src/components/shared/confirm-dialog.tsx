
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useConfirmStore } from "@/lib/stores/confirm-store";

export function ConfirmDialog() {
  const open = useConfirmStore((s) => s.open);
  const options = useConfirmStore((s) => s.options);
  const resolveWith = useConfirmStore((s) => s.resolveWith);

  const {
    title = "Are you sure?",
    description,
    confirmText = "Confirm",
    cancelText = "Cancel",
    variant = "destructive",
  } = options;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(value) => {
        if (!value) resolveWith(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => resolveWith(false)}>
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            variant={variant}
            onClick={() => resolveWith(true)}
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
