import { useEffect, useState } from "react";
import { Modal } from "@/components/shared/modal";
import { usePermissions } from "@/hooks/use-permissions";
import type { Invoice } from "@/lib/types";
import { CompletionWizard } from "./completion-wizard";
import { MainPage } from "./main-page";
import { StatusPicker } from "./status-picker";
import {
  CancelPage,
  InProgressPage,
  ReinstatePage,
} from "./transition-pages";
import {
  type AppointmentFormData,
  type Page,
  type TransitionStatus,
  type WizardStage,
} from "./types";
import { ViewPage } from "./view-page";

export type {
  AppointmentFormData,
  AppointmentProcedureSelection,
} from "./types";

const WIZARD_PAGES: Page[] = ["complete", "invoice", "payment"];
const isWizardPage = (page: Page): page is WizardStage =>
  (WIZARD_PAGES as Page[]).includes(page);

function titleFor(page: Page, isEdit: boolean): string {
  if (page === "cancel") return "Cancel Appointment";
  if (isWizardPage(page)) return "Complete Appointment";
  if (page === "in-progress") return "Mark In-Progress";
  if (page === "reinstate") return "Return to Scheduled";
  if (page === "view") return "View Appointment";
  return isEdit ? "Edit Appointment" : "New Appointment";
}

export function AppointmentForm({
  open,
  onClose,
  initialData,
  onSaved,
  readOnly = false,
  onOpenInSchedule,
}: {
  open: boolean;
  onClose: () => void;
  initialData?: Partial<AppointmentFormData>;
  onSaved?: () => void;
  /** Read-only mode for existing appointments. */
  readOnly?: boolean;
  /** Shows "Open in Schedule" in read-only mode. */
  onOpenInSchedule?: () => void;
}) {
  const { can } = usePermissions();
  const canWriteAppointments = can("appointments:write");
  const canDeleteAppointments = can("appointments:delete");
  const canWritePatients = can("patients:write");
  const canWriteRooms = can("rooms:write");
  const canWriteProcedures = can("procedures:write");
  const canWriteTransactions = can("invoices:write");

  const isEdit = !!initialData?.id;
  const currentStatus = initialData?.status ?? "Scheduled";
  const initialPage: Page = readOnly && isEdit ? "view" : "main";

  const [page, setPage] = useState<Page>(initialPage);
  const [completionNotes, setCompletionNotes] = useState<string | null>(null);
  const [createdInvoice, setCreatedInvoice] = useState<Invoice | null>(null);
  const [viewingStage, setViewingStage] = useState<WizardStage | null>(null);

  useEffect(() => {
    if (!open) return;
    setPage(initialPage);
    setCompletionNotes(null);
    setCreatedInvoice(null);
    setViewingStage(null);
  }, [open, initialPage]);

  const handleSaved = () => {
    onSaved?.();
    onClose();
  };

  const handleCompleted = (notes: string, advance: boolean) => {
    setCompletionNotes(notes);
    onSaved?.();
    if (advance) {
      setViewingStage(null);
      setPage("invoice");
    } else {
      onClose();
    }
  };

  const handleInvoiceCreated = (invoice: Invoice) => {
    setCreatedInvoice(invoice);
    setViewingStage(null);
    setPage("payment");
  };

  const handleStatusChange = (next: TransitionStatus) => {
    if (next === "Cancelled") setPage("cancel");
    else if (next === "Completed") setPage("complete");
    else if (next === "In-Progress") setPage("in-progress");
    else if (next === "Scheduled") setPage("reinstate");
  };

  const showStatusPicker =
    (page === "main" || page === "view") && isEdit && canWriteAppointments;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={titleFor(page, isEdit)}
      headerAction={
        showStatusPicker ? (
          <StatusPicker status={currentStatus} onChange={handleStatusChange} />
        ) : undefined
      }
    >
      {page === "view" && isEdit && (
        <ViewPage
          initialData={initialData!}
          onEdit={canWriteAppointments ? () => setPage("main") : undefined}
          onClose={onClose}
          onOpenInSchedule={onOpenInSchedule}
        />
      )}
      {page === "main" && (
        <MainPage
          isEdit={isEdit}
          initialData={initialData}
          onCancelEdit={onClose}
          onSaved={handleSaved}
          canDelete={canDeleteAppointments}
          canCreatePatient={canWritePatients}
          canCreateRoom={canWriteRooms}
          canCreateProcedure={canWriteProcedures}
        />
      )}
      {page === "cancel" && isEdit && (
        <CancelPage
          appointmentId={initialData!.id!}
          onBack={() => setPage("main")}
          onSaved={handleSaved}
        />
      )}
      {page === "reinstate" && isEdit && (
        <ReinstatePage
          appointmentId={initialData!.id!}
          status={currentStatus}
          // A completed appointment opens read-only, so returning here must
          // not drop the user into the edit form it deliberately skipped.
          onBack={() => setPage(initialPage)}
          onSaved={handleSaved}
        />
      )}
      {page === "in-progress" && isEdit && (
        <InProgressPage
          appointmentId={initialData!.id!}
          procedures={initialData!.procedures ?? []}
          onBack={() => setPage("main")}
          onSaved={handleSaved}
        />
      )}
      {isWizardPage(page) && isEdit && (
        <CompletionWizard
          open={open}
          page={page}
          initialData={initialData ?? {}}
          completionNotes={completionNotes}
          createdInvoice={createdInvoice}
          viewingStage={viewingStage}
          setViewingStage={setViewingStage}
          canContinue={canWriteTransactions}
          onBackToMain={() => setPage("main")}
          onCompleted={handleCompleted}
          onInvoiceCreated={handleInvoiceCreated}
          onClose={onClose}
        />
      )}
    </Modal>
  );
}
