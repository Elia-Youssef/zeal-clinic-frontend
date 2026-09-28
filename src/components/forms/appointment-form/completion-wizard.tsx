import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Check, CheckCircle2, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailField } from "@/components/shared/detail-field";
import { useRoomsStore } from "@/lib/stores/rooms-store";
import { cn, formatTimeRange } from "@/lib/utils";
import type { Invoice } from "@/lib/types";
import { ClientInvoiceFormBody } from "../client-invoice-form";
import { ClientPaymentFormBody } from "../client-payment-form";
import { CompletePage } from "./transition-pages";
import type { AppointmentFormData, WizardStage } from "./types";
import { mergeInitial } from "./utils";

export function CompletionWizard({
  open,
  page,
  initialData,
  completionNotes,
  createdInvoice,
  viewingStage,
  setViewingStage,
  canContinue,
  onBackToMain,
  onCompleted,
  onInvoiceCreated,
  onClose,
}: {
  open: boolean;
  page: WizardStage;
  initialData: Partial<AppointmentFormData>;
  completionNotes: string | null;
  createdInvoice: Invoice | null;
  viewingStage: WizardStage | null;
  setViewingStage: (stage: WizardStage | null) => void;
  canContinue: boolean;
  onBackToMain: () => void;
  onCompleted: (notes: string, advance: boolean) => void;
  onInvoiceCreated: (invoice: Invoice) => void;
  onClose: () => void;
}) {
  const shownStage: WizardStage = viewingStage ?? page;
  const appointmentId = initialData.id!;

  return (
    <div className="space-y-4">
      <StageIndicator
        current={page}
        viewing={shownStage}
        completedDone={completionNotes !== null}
        invoiceDone={createdInvoice !== null}
        onSelect={(s) => setViewingStage(s === page ? null : s)}
      />

      {/* Summaries when revisiting a finished stage. */}
      {shownStage === "complete" && page !== "complete" && (
        <CompleteSummary
          initialData={initialData}
          notes={completionNotes ?? ""}
          onContinue={() => setViewingStage(null)}
        />
      )}
      {shownStage === "invoice" && page === "payment" && (
        <InvoiceSummary
          invoice={createdInvoice}
          onContinue={() => setViewingStage(null)}
        />
      )}

      {/* Stage forms stay mounted so draft state survives navigation. */}
      {page === "complete" && (
        <div className={cn(shownStage !== "complete" && "hidden")}>
          <CompletePage
            appointmentId={appointmentId}
            patientId={initialData.patientId ?? ""}
            onBack={onBackToMain}
            onCompleted={onCompleted}
            canContinue={canContinue}
          />
        </div>
      )}
      {page === "invoice" && (
        <div className={cn(shownStage !== "invoice" && "hidden")}>
          <ClientInvoiceFormBody
            open={open}
            defaultPatientId={initialData.patientId}
            defaultPatientLabel={initialData.patientLabel}
            defaultProcedures={initialData.procedures}
            submitLabel="Create Invoice & Continue"
            cancelLabel="Close"
            onSubmitted={onInvoiceCreated}
            onCancel={onClose}
          />
        </div>
      )}
      {page === "payment" && (
        <div className={cn(shownStage !== "payment" && "hidden")}>
          <ClientPaymentFormBody
            defaultPatientId={initialData.patientId}
            defaultPatientLabel={initialData.patientLabel}
            defaultAmount={createdInvoice?.finalAmount}
            submitLabel="Record Payment"
            cancelLabel="Finish"
            onSubmitted={onClose}
            onCancel={onClose}
          />
        </div>
      )}
    </div>
  );
}

const WIZARD_LABELS: Record<WizardStage, string> = {
  complete: "Complete",
  invoice: "Invoice",
  payment: "Payment",
};

const WIZARD_ORDER: WizardStage[] = ["complete", "invoice", "payment"];

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
  const doneByStage: Record<WizardStage, boolean> = {
    complete: completedDone,
    invoice: invoiceDone,
    payment: false,
  };
  const currentIdx = WIZARD_ORDER.indexOf(current);

  return (
    <div className="flex items-center gap-2 border-b border-border pb-3">
      {WIZARD_ORDER.map((stage, i) => {
        const isViewing = viewing === stage;
        const done = doneByStage[stage];
        const clickable = done || stage === current;
        return (
          <div key={stage} className="flex items-center gap-2 flex-1">
            <button
              type="button"
              onClick={() => clickable && onSelect(stage)}
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
                  !isViewing && done && "bg-muted text-foreground",
                  !isViewing && !done && "bg-muted text-muted-foreground/60",
                )}
              >
                {done ? <Check className="size-3" /> : i + 1}
              </span>
              <span className="font-medium">{WIZARD_LABELS[stage]}</span>
            </button>
            {i < WIZARD_ORDER.length - 1 && (
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
  const editorData = mergeInitial(initialData);
  const date = editorData.date || "---";
  const spansMultipleDays =
    !!editorData.endDate && editorData.endDate !== editorData.date;
  const dateDisplay = spansMultipleDays
    ? `${date} - ${editorData.endDate}`
    : date;
  const timeRange = formatTimeRange(
    editorData.startTime,
    editorData.endTime,
  );

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
                <Badge key={p.id} variant="secondary" className="text-xs">
                  {p.label}
                </Badge>
              ) : null,
            )}
          </DetailField>
          <DetailField label={spansMultipleDays ? "Dates" : "Date"}>
            {dateDisplay}
          </DetailField>
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
