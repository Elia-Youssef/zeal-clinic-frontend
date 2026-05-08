import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ChevronDown,
  CalendarClock,
  PlayCircle,
  CheckCircle2,
  XCircle,
  Check,
  ExternalLink,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/shared/modal";
import { DatePicker } from "@/components/ui/date-picker";
import { SearchableDropdown } from "@/components/shared/searchable-dropdown";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api, toISODateTime } from "@/lib/api";
import { textareaClass } from "@/lib/form-styles";
import { useAlertStore } from "@/lib/stores/alert-store";
import { useRoomsStore } from "@/lib/stores/rooms-store";
import { cn, formatTimeRange, getErrorMessage } from "@/lib/utils";
import {
  appointmentStatusStyles,
  defaultAppointmentStatusStyle,
} from "@/lib/constants";
import { DetailField } from "@/components/shared/detail-field";
import { PatientForm } from "./patient-form";
import { ClientInvoiceFormBody } from "./client-invoice-form";
import { ClientPaymentFormBody } from "./client-payment-form";
import type { Appointment, Invoice } from "@/lib/types";
import { usePermissions } from "@/hooks/use-permissions";
import { useConfirm } from "@/hooks/use-confirm";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";

export type AppointmentProcedureSelection = {
  id: string;
  label: string;
};

export type AppointmentFormData = {
  id?: string;
  patientId: string;
  patientLabel?: string;
  roomId: string;
  procedures: AppointmentProcedureSelection[];
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  notes: string;
};

type Page =
  | "view"
  | "main"
  | "cancel"
  | "complete"
  | "in-progress"
  | "invoice"
  | "payment";

type WizardStage = "complete" | "invoice" | "payment";

const STATUS_ICONS: Record<string, LucideIcon> = {
  Scheduled: CalendarClock,
  "In-Progress": PlayCircle,
  Completed: CheckCircle2,
  Cancelled: XCircle,
};

const TRANSITION_STATUSES = ["In-Progress", "Completed", "Cancelled"] as const;

function StatusPicker({
  status,
  onChange,
}: {
  status: string;
  onChange: (next: (typeof TRANSITION_STATUSES)[number]) => void;
}) {
  const others = TRANSITION_STATUSES.filter((s) => s !== status);
  const CurrentIcon = STATUS_ICONS[status];
  const badgeClass = (
    appointmentStatusStyles[status] ?? defaultAppointmentStatusStyle
  ).badge;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
              badgeClass,
            )}
          >
            {CurrentIcon && <CurrentIcon className="size-3.5" />}
            {status}
            <ChevronDown className="size-3" />
          </button>
        }
      />
      <DropdownMenuContent align="end">
        {others.map((s) => {
          const Icon = STATUS_ICONS[s];
          return (
            <DropdownMenuItem key={s} onClick={() => onChange(s)}>
              {Icon && <Icon className="size-4" />}
              {s}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const emptyForm: AppointmentFormData = {
  patientId: "",
  roomId: "",
  procedures: [],
  date: "",
  startTime: "",
  endTime: "",
  status: "Scheduled",
  notes: "",
};

const mergeInitial = (
  initial?: Partial<AppointmentFormData>,
): AppointmentFormData => {
  if (!initial) return emptyForm;
  return {
    ...emptyForm,
    ...initial,
    procedures: initial.procedures ?? [],
    date: initial.date ?? initial.startTime?.slice(0, 10) ?? "",
    startTime: initial.startTime?.slice(11, 16) ?? "",
    endTime: initial.endTime?.slice(11, 16) ?? "",
  };
};

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
  appointmentData?: Appointment;
  initialData?: Partial<AppointmentFormData>;
  onSaved?: () => void;
  /** Open in read-only view mode (only meaningful when editing an existing appointment). */
  readOnly?: boolean;
  /** When provided, the view mode shows an "Open in Schedule" button. */
  onOpenInSchedule?: () => void;
}) {
  const { can } = usePermissions();
  const canWriteAppointments = can("appointments:write");
  const canDeleteAppointments = can("appointments:delete");
  const canWritePatients = can("patients:write");
  const canWriteTransactions = can("invoices:write");
  const isEdit = !!initialData?.id;
  const currentStatus = initialData?.status ?? "Scheduled";
  const initialPage: Page = readOnly && isEdit ? "view" : "main";

  const [page, setPage] = useState<Page>(initialPage);
  const [completionNotes, setCompletionNotes] = useState<string | null>(null);
  const [createdInvoice, setCreatedInvoice] = useState<Invoice | null>(null);
  const [viewingStage, setViewingStage] = useState<WizardStage | null>(null);

  useEffect(() => {
    if (open) {
      setPage(initialPage);
      setCompletionNotes(null);
      setCreatedInvoice(null);
      setViewingStage(null);
    }
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

  const handleStatusChange = (next: (typeof TRANSITION_STATUSES)[number]) => {
    if (next === "Cancelled") setPage("cancel");
    else if (next === "Completed") setPage("complete");
    else if (next === "In-Progress") setPage("in-progress");
  };

  const inWizard =
    page === "complete" || page === "invoice" || page === "payment";
  const wizardStage: WizardStage | null =
    page === "complete"
      ? "complete"
      : page === "invoice"
        ? "invoice"
        : page === "payment"
          ? "payment"
          : null;
  const shownStage: WizardStage | null = viewingStage ?? wizardStage;

  const title =
    page === "cancel"
      ? "Cancel Appointment"
      : inWizard
        ? "Complete Appointment"
        : page === "in-progress"
          ? "Mark In-Progress"
          : page === "view"
            ? "View Appointment"
            : isEdit
              ? "Edit Appointment"
              : "New Appointment";

  const headerAction =
    (page === "main" || page === "view") && isEdit && canWriteAppointments ? (
      <StatusPicker status={currentStatus} onChange={handleStatusChange} />
    ) : undefined;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      headerAction={headerAction}
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
        />
      )}
      {page === "cancel" && isEdit && (
        <CancelPage
          appointmentId={initialData!.id!}
          onBack={() => setPage("main")}
          onSaved={handleSaved}
        />
      )}
      {page === "in-progress" && isEdit && (
        <InProgressPage
          appointmentId={initialData!.id!}
          onBack={() => setPage("main")}
          onSaved={handleSaved}
        />
      )}
      {inWizard && isEdit && wizardStage && (
        <div className="space-y-4">
          <StageIndicator
            current={wizardStage}
            viewing={shownStage!}
            completedDone={completionNotes !== null}
            invoiceDone={createdInvoice !== null}
            onSelect={(s) => setViewingStage(s === wizardStage ? null : s)}
          />

          {/* Summaries of already-submitted stages (read-only reference) */}
          {shownStage === "complete" && wizardStage !== "complete" && (
            <CompleteSummary
              initialData={initialData ?? {}}
              notes={completionNotes ?? ""}
              onContinue={() => setViewingStage(null)}
            />
          )}
          {shownStage === "invoice" && wizardStage === "payment" && (
            <InvoiceSummary
              invoice={createdInvoice}
              onContinue={() => setViewingStage(null)}
            />
          )}

          {/* Current-stage forms, kept mounted so in-progress state
              isn't lost when navigating back to view prior summaries. */}
          {wizardStage === "complete" && (
            <div className={cn(shownStage !== "complete" && "hidden")}>
              <CompletePage
                appointmentId={initialData!.id!}
                patientId={initialData?.patientId ?? ""}
                onBack={() => setPage("main")}
                onCompleted={handleCompleted}
                canContinue={canWriteTransactions}
              />
            </div>
          )}
          {wizardStage === "invoice" && (
            <div className={cn(shownStage !== "invoice" && "hidden")}>
              <ClientInvoiceFormBody
                open={open && page === "invoice"}
                defaultPatientId={initialData?.patientId}
                defaultPatientLabel={initialData?.patientLabel}
                submitLabel="Create Invoice & Continue"
                cancelLabel="Close"
                onSubmitted={handleInvoiceCreated}
                onCancel={onClose}
              />
            </div>
          )}
          {wizardStage === "payment" && (
            <div className={cn(shownStage !== "payment" && "hidden")}>
              <ClientPaymentFormBody
                open={open && page === "payment"}
                defaultPatientId={initialData?.patientId}
                defaultPatientLabel={initialData?.patientLabel}
                defaultAmount={createdInvoice?.finalAmount}
                submitLabel="Record Payment"
                cancelLabel="Finish"
                onSubmitted={onClose}
                onCancel={onClose}
              />
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

/* Wizard indicator */

function StageIndicator({
  current,
  viewing,
  completedDone,
  invoiceDone,
  onSelect,
}: {
  current: WizardStage;
  viewing: WizardStage;
  completedDone: boolean;
  invoiceDone: boolean;
  onSelect: (stage: WizardStage) => void;
}) {
  const stages: { id: WizardStage; label: string; done: boolean }[] = [
    { id: "complete", label: "Complete", done: completedDone },
    { id: "invoice", label: "Invoice", done: invoiceDone },
    { id: "payment", label: "Payment", done: false },
  ];
  const currentIdx = stages.findIndex((s) => s.id === current);

  return (
    <div className="flex items-center gap-2 border-b border-border pb-3">
      {stages.map((s, i) => {
        const isViewing = viewing === s.id;
        const clickable = s.done || s.id === current;
        return (
          <div key={s.id} className="flex items-center gap-2 flex-1">
            <button
              type="button"
              onClick={() => clickable && onSelect(s.id)}
              disabled={!clickable}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors",
                isViewing && "text-foreground",
                !isViewing &&
                  clickable &&
                  "text-muted-foreground hover:bg-muted",
                !clickable && "text-muted-foreground/60 cursor-not-allowed",
              )}
            >
              <span
                className={cn(
                  "inline-flex size-5 items-center justify-center rounded-full text-xs font-medium",
                  isViewing && "bg-primary text-primary-foreground",
                  !isViewing && s.done && "bg-muted text-foreground",
                  !isViewing && !s.done && "bg-muted text-muted-foreground/60",
                )}
              >
                {s.done ? <Check className="size-3" /> : i + 1}
              </span>
              <span className="font-medium">{s.label}</span>
            </button>
            {i < stages.length - 1 && (
              <div
                className={cn(
                  "h-px flex-1",
                  i < currentIdx ? "bg-foreground/40" : "bg-border",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* Wizard summaries (read-only reference views) */

function CompleteSummary({
  initialData,
  notes,
  onContinue,
}: {
  initialData: Partial<AppointmentFormData>;
  notes: string;
  onContinue: () => void;
}) {
  const rooms = useRoomsStore((s) => s.rooms);
  const fetchRooms = useRoomsStore((s) => s.fetch);

  useEffect(() => {
    if (rooms.length === 0) fetchRooms();
  }, [rooms.length, fetchRooms]);

  const roomLabel =
    rooms.find((r) => r.id === initialData.roomId)?.name ?? "---";
  const date = initialData.date ?? initialData.startTime?.slice(0, 10) ?? "---";
  const timeRange = formatTimeRange(initialData.startTime, initialData.endTime);

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border bg-muted/30 p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <CheckCircle2 className="size-4 text-status-completed" />
          Appointment completed
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <DetailField label="Patient">
            {initialData.patientLabel || "---"}
          </DetailField>
          <DetailField label="Room">{roomLabel}</DetailField>

          <DetailField className="sm:col-span-2" label="Procedures">
            {initialData.procedures?.map((p) =>
              p.label ? (
                <Badge variant="secondary" className="text-xs">
                  {p.label}
                </Badge>
              ) : null,
            )}
          </DetailField>
          <DetailField label="Date">{date}</DetailField>
          <DetailField label="Time">{timeRange}</DetailField>
          <DetailField className="sm:col-span-2" label="Completion Notes">
            <p className="whitespace-pre-wrap">{notes || "---"}</p>
          </DetailField>
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="button" onClick={onContinue}>
          Continue
        </Button>
      </div>
    </div>
  );
}

function InvoiceSummary({
  invoice,
  onContinue,
}: {
  invoice: Invoice | null;
  onContinue: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border bg-muted/30 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CheckCircle2 className="size-4 text-status-completed" />
            Invoice created
          </div>
          {invoice && (
            <Link
              to={`/financials/invoices/${invoice.id}`}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Open invoice <ExternalLink className="size-3" />
            </Link>
          )}
        </div>
        {invoice && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <DetailField label="Invoice #">{invoice.invoiceNumber}</DetailField>
            <DetailField label="Total">
              ${invoice.finalAmount.toFixed(2)}
            </DetailField>
            <DetailField label="Patient">{invoice.toEntityName}</DetailField>
            <DetailField label="Items">{invoice.items.length}</DetailField>
          </div>
        )}
      </div>
      <div className="flex justify-end">
        <Button type="button" onClick={onContinue}>
          Continue
        </Button>
      </div>
    </div>
  );
}

/* View: read-only */

function ViewPage({
  initialData,
  onEdit,
  onClose,
  onOpenInSchedule,
}: {
  initialData: Partial<AppointmentFormData>;
  onEdit?: () => void;
  onClose: () => void;
  onOpenInSchedule?: () => void;
}) {
  const rooms = useRoomsStore((s) => s.rooms);
  const fetchRooms = useRoomsStore((s) => s.fetch);

  useEffect(() => {
    if (rooms.length === 0) fetchRooms();
  }, [rooms.length, fetchRooms]);

  const roomLabel =
    rooms.find((r) => r.id === initialData.roomId)?.name ?? "---";
  const date = initialData.date ?? initialData.startTime?.slice(0, 10) ?? "---";
  const timeRange = formatTimeRange(initialData.startTime, initialData.endTime);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
        <DetailField label="Patient">
          {initialData.patientLabel || "---"}
        </DetailField>
        <DetailField label="Room">{roomLabel}</DetailField>
        <DetailField className="sm:col-span-2" label="Procedures">
          {initialData.procedures?.map((p) =>
            p.label ? (
              <Badge variant="secondary" className="text-xs">
                {p.label}
              </Badge>
            ) : null,
          )}
        </DetailField>
        <DetailField label="Date">{date}</DetailField>
        <DetailField label="Time">{timeRange}</DetailField>
        <DetailField className="sm:col-span-2" label="Notes">
          <p className="whitespace-pre-wrap">{initialData.notes || "---"}</p>
        </DetailField>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {onOpenInSchedule && (
          <Button
            type="button"
            variant="outline"
            className="mr-auto"
            onClick={onOpenInSchedule}
          >
            Open in Schedule
          </Button>
        )}
        <Button type="button" variant="outline" onClick={onClose}>
          Close
        </Button>
        {onEdit && (
          <Button type="button" onClick={onEdit}>
            Edit
          </Button>
        )}
      </div>
    </div>
  );
}

/* Main: create / edit */

function MainPage({
  isEdit,
  initialData,
  onCancelEdit,
  onSaved,
  canDelete,
  canCreatePatient,
}: {
  isEdit: boolean;
  initialData?: Partial<AppointmentFormData>;
  onCancelEdit: () => void;
  onSaved: () => void;
  canDelete: boolean;
  canCreatePatient: boolean;
}) {
  const addAlert = useAlertStore((s) => s.addAlert);
  const confirm = useConfirm();
  const [form, setForm] = useState<AppointmentFormData>(() =>
    mergeInitial(initialData),
  );
  const [submitting, setSubmitting] = useState(false);

  const update = <K extends keyof AppointmentFormData>(
    field: K,
    value: AppointmentFormData[K],
  ) => setForm((prev) => ({ ...prev, [field]: value }));

  const addProcedure = (option: AppointmentProcedureSelection) =>
    setForm((prev) =>
      prev.procedures.some((p) => p.id === option.id)
        ? prev
        : { ...prev, procedures: [...prev.procedures, option] },
    );

  const removeProcedure = (id: string) =>
    setForm((prev) => ({
      ...prev,
      procedures: prev.procedures.filter((p) => p.id !== id),
    }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (form.procedures.length === 0) {
      addAlert("error", "At least one procedure is required.");
      return;
    }

    setSubmitting(true);

    const payload = {
      patientId: form.patientId,
      roomId: form.roomId,
      procedureIds: form.procedures.map((p) => p.id),
      startTime: toISODateTime(`${form.date}T${form.startTime}`),
      endTime: toISODateTime(`${form.date}T${form.endTime}`),
      notes: form.notes || undefined,
    };

    try {
      if (isEdit) {
        await api.put(`/appointments/${initialData!.id}`, payload);
        addAlert("success", "Appointment updated.");
      } else {
        await api.post("/appointments", { ...payload, status: "Scheduled" });
        addAlert("success", "Appointment created.");
      }
      onSaved();
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (
      !(await confirm({
        title: "Delete appointment?",
        description: "Delete this appointment?",
        confirmText: "Delete",
      }))
    ) {
      return;
    }
    setSubmitting(true);
    try {
      await api.del(`/appointments/${initialData!.id}`);
      addAlert("success", "Appointment deleted.");
      onSaved();
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Patient</label>
        <SearchableDropdown
          value={form.patientId}
          onChange={(value) => update("patientId", value)}
          defaultApiOption={
            form.patientLabel
              ? { value: form.patientId, label: form.patientLabel }
              : undefined
          }
          apiEndpoint="/patients/dropdown"
          mapItem={(p: { id: string; name: string }) => ({
            value: p.id,
            label: p.name,
          })}
          placeholder="Select patient..."
          required
          renderAddForm={
            canCreatePatient
              ? ({ open: addOpen, onClose: closeAdd, onCreated }) => (
                  <PatientForm
                    open={addOpen}
                    onClose={closeAdd}
                    onSaved={(created) => {
                      if (created) {
                        onCreated(
                          String(created.id),
                          `${created.firstName} ${created.lastName}`,
                        );
                      }
                    }}
                  />
                )
              : undefined
          }
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Room</label>
        <SearchableDropdown
          value={form.roomId}
          onChange={(value) => update("roomId", value)}
          apiEndpoint="/rooms/dropdown"
          mapItem={(r: { id: string; name: string }) => ({
            value: r.id,
            label: r.name,
          })}
          placeholder="Select room..."
          apiOptionsLimit={10}
          required
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Procedures *</label>
        {form.procedures.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {form.procedures.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center gap-1 rounded-md border border-input bg-muted/50 px-2 py-0.5 text-xs"
              >
                {p.label}
                <button
                  type="button"
                  aria-label={`Remove ${p.label}`}
                  onClick={() => removeProcedure(p.id)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <SearchableDropdown
          value=""
          onChange={() => {}}
          onSelectItem={(opt) =>
            addProcedure({ id: opt.value, label: opt.label })
          }
          apiEndpoint="/procedures/dropdown"
          mapItem={(p: { id: string; name: string }) => ({
            value: p.id,
            label: p.name,
          })}
          placeholder="Add a procedure..."
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Date *</label>
          <DatePicker
            value={form.date}
            onChange={(value) => update("date", value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Start Time *</label>
          <Input
            type="time"
            value={form.startTime}
            onChange={(v) => update("startTime", v.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">End Time *</label>
          <Input
            type="time"
            value={form.endTime}
            onChange={(v) => update("endTime", v.target.value)}
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Notes</label>
        <textarea
          className={textareaClass}
          rows={3}
          value={form.notes}
          onChange={(e) => update("notes", e.target.value)}
          placeholder="Optional notes..."
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {isEdit && canDelete && (
          <Button
            type="button"
            variant="destructive"
            className="mr-auto"
            disabled={submitting}
            onClick={handleDelete}
          >
            Delete
          </Button>
        )}
        <Button type="button" variant="outline" onClick={onCancelEdit}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : isEdit ? "Update" : "Create"}
        </Button>
      </div>
    </form>
  );
}

/* Cancel: confirm + reason */

function CancelPage({
  appointmentId,
  onBack,
  onSaved,
}: {
  appointmentId: string;
  onBack: () => void;
  onSaved: () => void;
}) {
  const addAlert = useAlertStore((s) => s.addAlert);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleCancel = async () => {
    setSubmitting(true);
    try {
      await api.put(`/appointments/${appointmentId}`, {
        status: "Cancelled",
        cancelNotes: reason || undefined,
      });
      addAlert("success", "Appointment cancelled.");
      onSaved();
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Are you sure you want to cancel this appointment?
      </p>
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Cancellation Reason</label>
        <textarea
          className={textareaClass}
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for cancellation..."
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button
          variant="destructive"
          disabled={submitting}
          onClick={handleCancel}
        >
          {submitting ? "Cancelling..." : "Confirm Cancellation"}
        </Button>
      </div>
    </div>
  );
}

/* Complete: notes + optional invoice handoff */

function CompletePage({
  appointmentId,
  patientId,
  onBack,
  onCompleted,
  canContinue,
}: {
  appointmentId: string;
  patientId: string;
  onBack: () => void;
  onCompleted: (notes: string, advance: boolean) => void;
  canContinue: boolean;
}) {
  const addAlert = useAlertStore((s) => s.addAlert);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleComplete = async (advance: boolean) => {
    setSubmitting(true);
    try {
      await api.put(`/appointments/${appointmentId}`, {
        status: "Completed",
        completionNotes: notes || undefined,
      });
      addAlert("success", "Appointment completed.");
      onCompleted(notes, advance);
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Completion Notes</label>
        <textarea
          className={textareaClass}
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes about the appointment..."
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={submitting}
          onClick={() => handleComplete(false)}
        >
          {submitting ? "Completing..." : "Complete"}
        </Button>
        {canContinue && (
          <Button
            type="button"
            disabled={submitting || !patientId}
            onClick={() => handleComplete(true)}
          >
            Complete & Continue
          </Button>
        )}
      </div>
    </div>
  );
}

/* In-Progress: confirm + optional notes */

function InProgressPage({
  appointmentId,
  onBack,
  onSaved,
}: {
  appointmentId: string;
  onBack: () => void;
  onSaved: () => void;
}) {
  const addAlert = useAlertStore((s) => s.addAlert);
  const [submitting, setSubmitting] = useState(false);

  const handleStart = async () => {
    setSubmitting(true);
    try {
      await api.put(`/appointments/${appointmentId}`, {
        status: "In-Progress",
      });
      addAlert("success", "Appointment marked in-progress.");
      onSaved();
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Mark this appointment as in-progress?
      </p>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button disabled={submitting} onClick={handleStart}>
          {submitting ? "Starting..." : "Confirm"}
        </Button>
      </div>
    </div>
  );
}
