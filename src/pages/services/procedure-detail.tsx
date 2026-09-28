import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loading } from "@/components/shared/loading";
import { PageHeader } from "@/components/shared/page-header";
import { DetailField } from "@/components/shared/detail-field";
import { DataList } from "@/components/data/data-list";
import { api } from "@/lib/api";
import { formatTimeRange, getErrorMessage, formatMoney } from "@/lib/utils";
import { beirutDayKey } from "@/lib/tz";
import { useAlertStore } from "@/lib/stores/alert-store";
import type {
  Procedure,
  ProcedureAllergyConflict,
  ProcedurePrice,
  Appointment,
} from "@/lib/types";
import { ProcedureForm } from "@/components/forms/procedure-form";
import { ProcedureAllergyConflictForm } from "@/components/forms/procedure-allergy-conflict-form";
import { AppointmentForm } from "@/components/forms/appointment-form";
import { usePermissions } from "@/hooks/use-permissions";
import { usePageTitle } from "@/hooks/use-page-title";
import { useConfirm } from "@/hooks/use-confirm";
import { useApiQuery } from "@/hooks/use-api-query";
import { appointmentStatusTint } from "@/lib/constants";

function ProcedureDetailContent() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const addAlert = useAlertStore((s) => s.addAlert);
  const { can } = usePermissions();
  const confirm = useConfirm();

  const {
    data: procedure,
    loading,
    reload,
  } = useApiQuery(
    () => api.get<Procedure>(`/procedures/${id}`),
    [id],
    () => addAlert("error", "Failed to load procedure."),
  );
  const [pricingKey, setPricingKey] = useState(0);
  const [conflictsKey, setConflictsKey] = useState(0);

  const [editOpen, setEditOpen] = useState(false);
  const [conflictFormOpen, setConflictFormOpen] = useState(false);
  const [editingConflict, setEditingConflict] =
    useState<ProcedureAllergyConflict | null>(null);
  const [viewAppointment, setViewAppointment] = useState<Appointment | null>(
    null,
  );

  const bumpPricing = () => setPricingKey((k) => k + 1);
  const bumpConflicts = () => setConflictsKey((k) => k + 1);

  const handleDelete = async () => {
    if (!procedure) return;
    if (
      !(await confirm({
        title: "Delete procedure?",
        description: `Delete procedure "${procedure.name}"?`,
        confirmText: "Delete",
      }))
    ) {
      return;
    }
    try {
      await api.del(`/procedures/${id}`);
      addAlert("success", "Procedure deleted.");
      navigate("/services/procedures");
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    }
  };

  const handleRemoveConflict = async (conflictId: string) => {
    if (
      !(await confirm({
        title: "Remove conflict?",
        description: "Remove this allergy conflict?",
        confirmText: "Remove",
      }))
    ) {
      return;
    }
    try {
      await api.del(`/procedure-allergy-conflicts/${conflictId}`);
      addAlert("success", "Conflict removed.");
      bumpConflicts();
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    }
  };

  if (loading) return <Loading />;
  if (!procedure)
    return (
      <p className="py-12 text-center text-muted-foreground">
        Procedure not found.
      </p>
    );

  return (
    <div className="space-y-4">
      <PageHeader
        backHref="/services/procedures"
        title={procedure.name}
        onEdit={can("procedures:write") ? () => setEditOpen(true) : undefined}
        onDelete={can("procedures:delete") ? handleDelete : undefined}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 sm:gap-x-8 gap-y-3 text-sm">
          <DetailField label="Price" className="sm:col-span-2">
            <div>
              {procedure.price ? (
                <span className="font-semibold">{formatMoney(procedure.price)}</span>
              ) : null}
              {procedure.priceNote && procedure.price ? (
                <span className="text-muted-foreground">{" - "}</span>
              ) : null}
              {procedure.priceNote && (
                <span className="text-muted-foreground">
                  {procedure.priceNote}
                </span>
              )}
              {!procedure.priceNote && !procedure.price ? (
                <span className="text-muted-foreground">---</span>
              ) : null}
            </div>
          </DetailField>
          <DetailField label="Type">
            {procedure.type?.name || "---"}
          </DetailField>
          <DetailField label="Category">
            {(() => {
              const cats = [
                procedure.category?.parent?.name || "",
                procedure.category?.name || "",
              ].filter((c) => c);
              if (!cats.length) return "---";
              return (
                <div className="flex flex-row gap-1">
                  {cats.map((cat, i) => (
                    <Badge variant="outline" key={i}>
                      {cat}
                    </Badge>
                  ))}
                </div>
              );
            })()}
          </DetailField>
          <DetailField label="Remarks">
            {procedure.remarks || "---"}
          </DetailField>
          <DetailField label="Includes">
            {procedure.includes || "---"}
          </DetailField>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DataList<ProcedureAllergyConflict>
          className="flex-1"
          title="Allergy Conflicts"
          columns={[
            {
              header: "Allergy",
              key: "allergy",
              className: "w-70",
              render: (i) => i.allergyName ?? i.allergyId,
            },
            {
              header: "Notes",
              key: "notes",
              className: "truncate",
              render: (i) => i.notes ?? "---",
            },
          ]}
          actions={
            can("procedure-allergy-conflicts:write")
              ? [
                  {
                    label: "Edit",
                    icon: <Pencil className="size-3.5" />,
                    onClick: (i) => {
                      setEditingConflict(i);
                      setConflictFormOpen(true);
                    },
                  },
                  {
                    label: "Delete",
                    icon: <Trash2 className="size-3.5" />,
                    destructive: true,
                    onClick: (i) => handleRemoveConflict(i.id),
                  },
                ]
              : []
          }
          endpoint={`/procedures/${id}/allergy-conflicts`}
          rowKey={(i) => i.id}
          limit={5}
          hideSearch
          refreshKey={conflictsKey}
          emptyMessage="No allergy conflicts."
          headerActions={
            can("procedure-allergy-conflicts:write") && (
              <Button
                size="sm"
                className="gap-1"
                aria-label="Add allergy conflict"
                onClick={() => setConflictFormOpen(true)}
              >
                <Plus className="size-3.5" />
              </Button>
            )
          }
        />

        <DataList<Appointment>
          title="Appointments"
          className="flex-1"
          columns={[
            {
              header: "Patient",
              key: "patient",
              className: "truncate",
              render: (i) => i.patientName ?? "---",
            },
            {
              header: "Date",
              key: "date",
              className: "w-32",
              render: (i) => beirutDayKey(i.startTime) || "---",
            },
            {
              header: "Time",
              key: "time",
              className: "w-40",
              render: (i) =>
                i.startTime && i.endTime
                  ? formatTimeRange(i.startTime, i.endTime)
                  : "---",
            },
            {
              header: "Status",
              key: "status",
              className: "w-32",
              render: (i) => (
                <Badge
                  variant="outline"
                  className={appointmentStatusTint(i.status)}
                >
                  {i.status}
                </Badge>
              ),
            },
          ]}
          endpoint={`/procedures/${id}/appointments`}
          rowKey={(i) => i.id}
          limit={5}
          hideSearch
          emptyMessage="No appointments."
          onRowClick={
            can("appointments:read") ? (i) => setViewAppointment(i) : undefined
          }
        />

        <DataList<ProcedurePrice>
          title="Pricing History"
          columns={[
            {
              header: "",
              key: "status",
              className: "w-26",
              render: (i) => (i.isActive ? <Badge>Current</Badge> : null),
            },
            {
              header: "Price",
              key: "price",
              className: "truncate",
              render: (i) => (
                <span className="font-medium">${i.price.toFixed(2)}</span>
              ),
            },
            {
              header: "Date",
              key: "createdAt",
              className: "w-40",
              render: (i) => beirutDayKey(i.createdAt) || "---",
            },
          ]}
          endpoint={`/procedures/${id}/prices`}
          rowKey={(i) => i.id}
          limit={5}
          hideSearch
          emptyMessage="No price history."
          refreshKey={pricingKey}
        />
      </div>

      <ProcedureForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          bumpPricing();
          reload({ quiet: true });
        }}
        initial={procedure}
      />

      <ProcedureAllergyConflictForm
        open={conflictFormOpen}
        onClose={() => {
          setConflictFormOpen(false);
          setEditingConflict(null);
        }}
        onSaved={bumpConflicts}
        procedureId={id}
        initial={editingConflict}
      />

      <AppointmentForm
        key={viewAppointment?.id ?? "no-appt"}
        open={!!viewAppointment}
        onClose={() => setViewAppointment(null)}
        onSaved={() => {}}
        readOnly
        initialData={
          viewAppointment
            ? {
                id: viewAppointment.id,
                patientId: viewAppointment.patientId,
                patientLabel: viewAppointment.patientName,
                roomId: viewAppointment.roomId,
                procedures:
                  viewAppointment.appointmentProcedures?.map((ap) => ({
                    id: ap.procedureId,
                    label: ap.procedureName ?? "",
                    assignedToId: ap.assignedToId || undefined,
                    assignedToLabel: ap.assignedToName || undefined,
                  })) ?? [],
                startTime: viewAppointment.startTime,
                endTime: viewAppointment.endTime,
                status: viewAppointment.status,
                notes: viewAppointment.notes,
                cancelNotes: viewAppointment.cancelNotes,
                completionNotes: viewAppointment.completionNotes,
              }
            : undefined
        }
        onOpenInSchedule={
          viewAppointment
            ? () =>
                navigate(
                  `/schedule/calendar?date=${beirutDayKey(viewAppointment.startTime)}`,
                )
            : undefined
        }
      />
    </div>
  );
}

export default function ProcedureDetailPage() {
  usePageTitle("Procedure");
  return <ProcedureDetailContent />;
}
