"use client";

import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, FileText, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loading } from "@/components/shared/loading";
import { PageHeader } from "@/components/shared/page-header";
import { DetailField } from "@/components/shared/detail-field";
import { ListItem } from "@/components/shared/list-item";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import { usePatientsStore } from "@/lib/stores/patients-store";
import { useAlertStore } from "@/lib/stores/alert-store";
import { PatientForm } from "@/components/forms/patient-form";
import { ClientInvoiceForm } from "@/components/forms/client-invoice-form";
import { ClientPaymentForm } from "@/components/forms/client-payment-form";
import { AppointmentForm } from "@/components/forms/appointment-form";
import { PatientAllergyForm } from "@/components/forms/patient-allergy-form";
import { PatientMedicineForm } from "@/components/forms/patient-medicine-form";
import { PrescriptionForm } from "@/components/forms/prescription-form";
import { usePermissions } from "@/hooks/use-permissions";
import { usePageTitle } from "@/hooks/use-page-title";
import { DataList } from "@/components/data/data-list";
import {
  Appointment,
  BalanceTransaction,
  Invoice,
  PatientAllergy,
  PatientMedicine,
  Prescription,
} from "@/lib/types";

/* ------------------------------------------------------------------ */
/*  Page content                                                       */
/* ------------------------------------------------------------------ */

function PatientDetailContent() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const addAlert = useAlertStore((s) => s.addAlert);
  const { can } = usePermissions();

  /* Store state */
  const patient = usePatientsStore((s) => s.current);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [prescriptionsLoading, setPrescriptionsLoading] = useState(true);
  const [editingPrescription, setEditingPrescription] =
    useState<Prescription | null>(null);
  const loading = usePatientsStore((s) => s.detailLoading);
  const fetchDetail = usePatientsStore((s) => s.fetchDetail);
  const setCurrent = usePatientsStore((s) => s.setCurrent);

  /* Modals */
  const [editOpen, setEditOpen] = useState(false);
  const [invoiceFormOpen, setInvoiceFormOpen] = useState(false);
  const [paymentFormOpen, setPaymentFormOpen] = useState(false);
  const [allergyFormOpen, setAllergyFormOpen] = useState(false);
  const [medicineFormOpen, setMedicineFormOpen] = useState(false);
  const [appointmentFormOpen, setAppointmentFormOpen] = useState(false);
  const [viewAppointment, setViewAppointment] = useState<Appointment | null>(
    null,
  );
  const [prescriptionFormOpen, setPrescriptionFormOpen] = useState(false);

  const fetchPrescriptions = async () => {
    setPrescriptionsLoading(true);
    try {
      const res = await api.get<Prescription[]>(
        `/patients/${id}/prescriptions`,
      );
      setPrescriptions(res);
    } catch {
      setPrescriptions([]);
    } finally {
      setPrescriptionsLoading(false);
    }
  };

  const reload = () => {
    fetchDetail(id);
    fetchPrescriptions();
  };

  useEffect(() => {
    reload();
    return () => {
      setCurrent(null);
    };
  }, [id]);

  /* Render */

  if (loading) return <Loading />;
  if (!patient)
    return (
      <p className="py-12 text-center text-muted-foreground">
        Patient not found.
      </p>
    );

  return (
    <div className="space-y-4">
      {/* Header */}
      <PageHeader
        backHref="/patients/list"
        title={`${patient.firstName} ${patient.middleName ? patient.middleName + " " : ""}${patient.lastName}`}
        badges={<Badge variant="outline">{patient.gender}</Badge>}
        onEdit={can("patients:write") ? () => setEditOpen(true) : undefined}
        onDelete={can("patients:delete") ? handleDelete : undefined}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>

        <CardContent className="grid grid-cols-3 gap-x-8 gap-y-2 text-sm">
          <DetailField label="Email">{patient.email || "—"}</DetailField>
          <DetailField label="Contact">{patient.contact}</DetailField>
          <DetailField label="Emergency Contact">
            <div>
              {patient.emergencyContactName || "—"}
              {patient.emergencyContactPhone
                ? ` (${patient.emergencyContactPhone})`
                : ""}
            </div>
          </DetailField>
          <DetailField label="Date of Birth">
            {patient.dateOfBirth?.slice(0, 10) ?? "—"}
          </DetailField>
          <DetailField className="col-span-2" label="Address">
            <div>
              {[
                patient.country?.name,
                patient.city?.governorate,
                patient.city?.district,
                patient.city?.name,
                patient.address,
              ]
                .filter((i) => i && i.trim() !== "")
                .join(", ") || "---"}
            </div>
          </DetailField>
          <DetailField label="Weight">
            {patient.weight != null ? `${patient.weight} kg` : "—"}
          </DetailField>
          <DetailField label="Height">
            {patient.height != null ? `${patient.height} cm` : "—"}
          </DetailField>
          <DetailField label="Blood Type">
            {patient.bloodType || "—--"}
          </DetailField>
          <DetailField className="col-span-3" label="Notes">
            {patient.notes || "---"}
          </DetailField>
        </CardContent>
      </Card>

      {/* Allergies & Medicines */}
      <div className="flex flex-row gap-4">
        <DataList<PatientAllergy>
          className="flex-1"
          title="Allergies"
          columns={[
            {
              header: "Name",
              key: "name",
              render: (i) => i.allergyName ?? "---",
            },
            { header: "Notes", key: "notes", render: (i) => i.notes ?? "---" },
          ]}
          actions={
            can("patients:delete")
              ? [
                  {
                    label: "Delete",
                    icon: <Trash2 className="size-3.5" />,
                    destructive: true,
                    onClick: (i) => handleRemoveAllergy(i.id),
                  },
                ]
              : []
          }
          endpoint={`/patients/${id}/allergies`}
          rowKey={(i: PatientAllergy) => i.id}
          limit={5}
          hideSearch
          headerActions={
            can("patients:write") && (
              <Button
                size="sm"
                className="gap-1"
                onClick={() => setAllergyFormOpen(true)}
              >
                <Plus className="size-3.5" />
              </Button>
            )
          }
        />

        <DataList<PatientMedicine>
          className="flex-1"
          title="Medicines"
          columns={[
            {
              header: "Name",
              key: "name",
              render: (i) => i.medicineName ?? "---",
            },
            { header: "Notes", key: "notes", render: (i) => i.notes ?? "---" },
          ]}
          actions={
            can("patients:delete")
              ? [
                  {
                    label: "Delete",
                    icon: <Trash2 className="size-3.5" />,
                    destructive: true,
                    onClick: (i) => handleRemoveMedicine(i.id),
                  },
                ]
              : []
          }
          endpoint={`/patients/${id}/medicines`}
          rowKey={(i: PatientMedicine) => i.id}
          limit={5}
          hideSearch
          headerActions={
            can("patients:write") && (
              <Button
                size="sm"
                className="gap-1"
                onClick={() => setMedicineFormOpen(true)}
              >
                <Plus className="size-3.5" />
              </Button>
            )
          }
        />
      </div>

      <div className="flex flex-row gap-4">
        <DataList
          className="flex-1"
          title="Appointments"
          columns={[
            {
              header: "Procedure",
              key: "procedure",
              render: (i) => i.patientProcedure?.procedureName ?? "Other",
            },
            {
              header: "Date",
              key: "date",
              render: (i) => i.startTime?.slice(0, 10) ?? "—",
            },
            {
              header: "Time",
              key: "time",
              render: (i) =>
                i.startTime && i.endTime
                  ? `${i.startTime.slice(11, 16)} - ${i.endTime.slice(11, 16)}`
                  : "—",
            },
            {
              header: "Status",
              key: "status",
              render: (i) => (
                <Badge
                  variant="outline"
                  className={
                    i.status === "Completed"
                      ? "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400"
                      : i.status === "Cancelled"
                        ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400"
                        : i.status === "In-Progress"
                          ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-400"
                          : ""
                  }
                >
                  {i.status}
                </Badge>
              ),
            },
          ]}
          endpoint={`/patients/${id}/appointments`}
          rowKey={(i: Appointment) => i.id}
          limit={5}
          hideSearch
          onRowClick={(i) => setViewAppointment(i)}
          headerActions={
            can("appointments:write") && (
              <Button
                size="sm"
                className="gap-1"
                onClick={() => setAppointmentFormOpen(true)}
              >
                <Plus className="size-3.5" />
              </Button>
            )
          }
        />

        <DataList<Prescription>
          className="flex-1"
          title="Prescriptions"
          columns={[
            {
              header: "Prescribed By",
              key: "prescribedById",
              render: (i) => i.prescribedByName ?? "—",
            },
            {
              header: "Start Date",
              key: "startDate",
              render: (i) => i.startDate ?? "—",
            },
            {
              header: "End Date",
              key: "endDate",
              render: (i) => i.endDate ?? "—",
            },
            {
              header: "Medicines",
              key: "medicines",
              render: (i) =>
                i.medicines?.map((i) => i.medicineName).join(", ") ?? "---",
            },
          ]}
          actions={
            can("patients:delete")
              ? [
                  {
                    label: "Delete",
                    icon: <Trash2 className="size-3.5" />,
                    destructive: true,
                    onClick: (i) => handleDeletePrescription(i.id),
                  },
                ]
              : []
          }
          endpoint={`/patients/${id}/prescriptions`}
          rowKey={(i: Prescription) => i.id}
          limit={5}
          hideSearch
          headerActions={
            can("patients:write") && (
              <Button
                size="sm"
                className="gap-1"
                onClick={() => setPrescriptionFormOpen(true)}
              >
                <Plus className="size-3.5" />
              </Button>
            )
          }
        />
      </div>

      <div className="flex flex-row gap-4">
        <DataList
          className="flex-1"
          title="Invoices"
          columns={[
            {
              header: "#",
              key: "#",
              render: (i) => `#${i.invoiceNumber}`,
            },
            {
              header: "Date",
              key: "date",
              render: (i) => i.createdAt.slice(0, 10),
            },
            {
              header: "Amount",
              key: "amount",
              render: (i) => `$${i.finalAmount.toFixed(2)}`,
            },
          ]}
          endpoint={`/patients/${id}/invoices`}
          rowKey={(i: Invoice) => i.id}
          limit={5}
          hideSearch
          onRowClick={(i) => navigate(`/financials/invoices/${i.id}`)}
          headerActions={
            can("appointments:write") && (
              <Button
                size="sm"
                className="gap-1"
                onClick={() => setInvoiceFormOpen(true)}
              >
                <Plus className="size-3.5" />
              </Button>
            )
          }
        />

        {/* Payments */}
        <Card className="flex-1 gap-0">
          {patient.balance && (
            <CardHeader className="pb-4 border-b">
              <CardTitle>
                <p className="font-semibold">
                  Balance:{" "}
                  <span
                    className={
                      (patient.balance.amount ?? 0) == 0
                        ? "text-gray-600 dark:text-gray-400"
                        : (patient.balance.amount ?? 0) > 0
                          ? "text-red-600 dark:text-red-400"
                          : "text-green-600 dark:text-green-400"
                    }
                  >
                    {(patient.balance.amount ?? 0) < 0 ? "-" : ""}$
                    {Math.abs(patient.balance.amount ?? 0).toFixed(2)}
                  </span>
                </p>
              </CardTitle>
            </CardHeader>
          )}
          <DataList
            className="ring-0"
            title="Payments"
            columns={[
              {
                header: "Date",
                key: "date",
                render: (i) => i.createdAt.slice(0, 10),
              },
              {
                header: "Method",
                key: "method",
                render: (i) => (
                  <Badge variant="secondary" className="capitalize">
                    {i.transactionMethod}
                  </Badge>
                ),
              },
              {
                header: "Description",
                key: "description",
                render: (i) => (
                  <span className="text-muted-foreground truncate">
                    {i.description || "—"}
                  </span>
                ),
              },
              {
                header: "Amount",
                key: "amount",
                render: (i) => (
                  <span className={`text-right font-medium text-green-600`}>
                    ${i.amount.toFixed(2)}
                  </span>
                ),
              },
            ]}
            endpoint={`/patients/${id}/payments`}
            rowKey={(i: BalanceTransaction) => i.id}
            limit={5}
            hideSearch
            headerActions={
              can("appointments:write") && (
                <Button
                  size="sm"
                  className="gap-1"
                  onClick={() => setPaymentFormOpen(true)}
                >
                  <Plus className="size-3.5" />
                </Button>
              )
            }
          />
        </Card>
      </div>

      <PatientForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={reload}
        initial={patient}
      />
      <ClientInvoiceForm
        open={invoiceFormOpen}
        onClose={() => setInvoiceFormOpen(false)}
        onSaved={reload}
        defaultPatientId={id}
      />
      <ClientPaymentForm
        open={paymentFormOpen}
        onClose={() => setPaymentFormOpen(false)}
        onSaved={reload}
        defaultPatientId={id}
      />
      <PatientAllergyForm
        open={allergyFormOpen}
        onClose={() => setAllergyFormOpen(false)}
        onSaved={reload}
        patientId={id}
      />
      <PatientMedicineForm
        open={medicineFormOpen}
        onClose={() => setMedicineFormOpen(false)}
        onSaved={reload}
        patientId={id}
      />
      <AppointmentForm
        open={appointmentFormOpen}
        onClose={() => setAppointmentFormOpen(false)}
        onSaved={reload}
        initialData={{ patientId: id }}
      />
      <AppointmentForm
        key={viewAppointment?.id ?? "no-appt"}
        open={!!viewAppointment}
        onClose={() => setViewAppointment(null)}
        onSaved={reload}
        readOnly
        initialData={
          viewAppointment
            ? {
                id: viewAppointment.id,
                patientId: viewAppointment.patientId,
                patientLabel: viewAppointment.patientName,
                roomId: viewAppointment.roomId,
                procedureId: viewAppointment.patientProcedure?.id ?? "",
                procedureLabel:
                  viewAppointment.patientProcedure?.procedureName ?? "",
                procedureSessionId:
                  viewAppointment.patientProcedureSession?.id ?? "",
                startTime: viewAppointment.startTime.slice(0, 16),
                endTime: viewAppointment.endTime.slice(0, 16),
                status: viewAppointment.status,
                notes: viewAppointment.notes,
              }
            : undefined
        }
        onOpenInSchedule={
          viewAppointment
            ? () =>
                navigate(
                  `/schedule/calendar?date=${viewAppointment.startTime.slice(0, 10)}`,
                )
            : undefined
        }
      />
      <PrescriptionForm
        open={prescriptionFormOpen}
        onClose={() => {
          setPrescriptionFormOpen(false);
          setEditingPrescription(null);
        }}
        onSaved={reload}
        patientId={id}
        initial={editingPrescription}
      />
    </div>
  );

  async function handleDelete() {
    if (
      !patient ||
      !confirm(`Delete patient ${patient.firstName} ${patient.lastName}?`)
    )
      return;
    try {
      await api.del(`/patients/${id}`);
      addAlert("success", "Patient deleted.");
      navigate("/patients/list");
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    }
  }

  async function handleRemoveAllergy(allergyId: string) {
    try {
      await api.del(`/patient-allergies/${allergyId}`);
      addAlert("success", "Allergy removed.");
      reload();
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    }
  }

  async function handleRemoveMedicine(pmId: string) {
    try {
      await api.del(`/patient-medicines/${pmId}`);
      addAlert("success", "Medicine removed.");
      reload();
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    }
  }

  async function handleDeletePrescription(rxId: string) {
    if (!confirm("Delete this prescription?")) return;
    try {
      await api.del(`/prescriptions/${rxId}`);
      addAlert("success", "Prescription deleted.");
      reload();
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Page export                                                        */
/* ------------------------------------------------------------------ */

export default function PatientDetailPage() {
  usePageTitle("Patient");
  return <PatientDetailContent />;
}
