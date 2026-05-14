import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loading } from "@/components/shared/loading";
import { PageHeader } from "@/components/shared/page-header";
import { DetailField } from "@/components/shared/detail-field";
import { api } from "@/lib/api";
import { formatTimeRange, getErrorMessage } from "@/lib/utils";
import { usePatientsStore } from "@/lib/stores/patients-store";
import { useAlertStore } from "@/lib/stores/alert-store";
import { appointmentStatusTint, transactionColors } from "@/lib/constants";
import { PatientForm } from "@/components/forms/patient-form";
import { ClientInvoiceForm } from "@/components/forms/client-invoice-form";
import { ClientPaymentForm } from "@/components/forms/client-payment-form";
import { ClientRefundForm } from "@/components/forms/client-refund-form";
import { BalanceAdjustmentForm } from "@/components/forms/balance-adjustment-form";
import { AppointmentForm } from "@/components/forms/appointment-form";
import { PatientAllergyForm } from "@/components/forms/patient-allergy-form";
import { PatientMedicineForm } from "@/components/forms/patient-medicine-form";
import { PrescriptionForm } from "@/components/forms/prescription-form";
import { usePermissions } from "@/hooks/use-permissions";
import { usePageTitle } from "@/hooks/use-page-title";
import { useConfirm } from "@/hooks/use-confirm";
import { DataList } from "@/components/data/data-list";
import { PaymentActionsMenu } from "@/components/shared/payment-actions-menu";
import {
  Appointment,
  BalanceTransaction,
  Invoice,
  PatientAllergy,
  PatientMedicine,
  Prescription,
} from "@/lib/types";

function PatientDetailContent() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const addAlert = useAlertStore((s) => s.addAlert);
  const { can } = usePermissions();
  const confirm = useConfirm();

  const patient = usePatientsStore((s) => s.current);
  const balance = usePatientsStore((s) => s.currentBalance);
  const [editingPrescription, setEditingPrescription] =
    useState<Prescription | null>(null);
  const loading = usePatientsStore((s) => s.detailLoading);
  const fetchDetail = usePatientsStore((s) => s.fetchDetail);
  const fetchBalance = usePatientsStore((s) => s.fetchBalance);
  const setCurrent = usePatientsStore((s) => s.setCurrent);

  const [editOpen, setEditOpen] = useState(false);
  const [invoiceFormOpen, setInvoiceFormOpen] = useState(false);
  const [paymentFormOpen, setPaymentFormOpen] = useState(false);
  const [refundFormOpen, setRefundFormOpen] = useState(false);
  const [adjustmentFormOpen, setAdjustmentFormOpen] = useState(false);
  const [writeOffFormOpen, setWriteOffFormOpen] = useState(false);
  const [allergyFormOpen, setAllergyFormOpen] = useState(false);
  const [medicineFormOpen, setMedicineFormOpen] = useState(false);
  const [appointmentFormOpen, setAppointmentFormOpen] = useState(false);
  const [viewAppointment, setViewAppointment] = useState<Appointment | null>(
    null,
  );
  const [prescriptionFormOpen, setPrescriptionFormOpen] = useState(false);

  // Related lists reload independently after saves.
  const [allergiesKey, setAllergiesKey] = useState(0);
  const [medicinesKey, setMedicinesKey] = useState(0);
  const [appointmentsKey, setAppointmentsKey] = useState(0);
  const [prescriptionsKey, setPrescriptionsKey] = useState(0);
  const [invoicesKey, setInvoicesKey] = useState(0);
  const [paymentsKey, setPaymentsKey] = useState(0);

  const bumpAllergies = () => setAllergiesKey((k) => k + 1);
  const bumpMedicines = () => setMedicinesKey((k) => k + 1);
  const bumpAppointments = () => setAppointmentsKey((k) => k + 1);
  const bumpPrescriptions = () => setPrescriptionsKey((k) => k + 1);
  const bumpInvoices = () => {
    setInvoicesKey((k) => k + 1);
    fetchBalance(id);
  };
  const bumpPayments = () => {
    setPaymentsKey((k) => k + 1);
    fetchBalance(id);
  };
  const reloadDetails = () => fetchDetail(id);

  useEffect(() => {
    fetchDetail(id);
    return () => {
      setCurrent(null);
    };
  }, [id]);

  if (loading) return <Loading />;
  if (!patient)
    return (
      <p className="py-12 text-center text-muted-foreground">
        Patient not found.
      </p>
    );

  const patientName = `${patient.firstName} ${patient.middleName ? patient.middleName + " " : ""}${patient.lastName}`;

  return (
    <div className="space-y-4">
      <PageHeader
        backHref="/patients/list"
        title={patientName}
        onEdit={can("patients:write") ? () => setEditOpen(true) : undefined}
        onDelete={can("patients:delete") ? handleDelete : undefined}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Details</CardTitle>
        </CardHeader>

        <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 sm:gap-x-8 gap-y-3 text-sm">
          <DetailField label="Email">{patient.email || "---"}</DetailField>
          <DetailField label="Contact">{patient.contact}</DetailField>
          <DetailField label="Emergency Contact">
            <div>
              {patient.emergencyContactName || "---"}
              {patient.emergencyContactPhone
                ? ` (${patient.emergencyContactPhone})`
                : ""}
            </div>
          </DetailField>
          <DetailField label="Date of Birth">
            {patient.dateOfBirth?.slice(0, 10) ?? "---"}
          </DetailField>
          <DetailField className="sm:col-span-2" label="Address">
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
            {patient.weight != null ? `${patient.weight} kg` : "---"}
          </DetailField>
          <DetailField label="Height">
            {patient.height != null ? `${patient.height} cm` : "---"}
          </DetailField>
          <DetailField label="Blood Type">
            {patient.bloodType || "—--"}
          </DetailField>
          <DetailField className="sm:col-span-2 md:col-span-3" label="Notes">
            {patient.notes || "---"}
          </DetailField>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4 lg:flex-row">
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
            can("patient-allergies:write")
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
          refreshKey={allergiesKey}
          hideSearch
          headerActions={
            can("patient-allergies:write") && (
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
            can("patient-medicines:write")
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
          refreshKey={medicinesKey}
          hideSearch
          headerActions={
            can("patient-medicines:write") && (
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

      <div className="flex flex-col gap-4 lg:flex-row">
        {can("appointments:read") && (
          <DataList
            className="flex-1"
            title="Appointments"
            columns={[
              {
                header: "Procedures",
                key: "procedures",
                render: (i) => (
                  <div className="flex flex-row gap-1">
                    {i.appointmentProcedures?.map((p) =>
                      p.procedureName ? (
                        <Badge
                          variant="secondary"
                          className="text-xs"
                          key={p.id}
                        >
                          {p.procedureName}
                        </Badge>
                      ) : null,
                    )}
                  </div>
                ),
              },
              {
                header: "Date",
                key: "date",
                render: (i) => i.startTime?.slice(0, 10) ?? "---",
              },
              {
                header: "Time",
                key: "time",
                render: (i) =>
                  i.startTime && i.endTime
                    ? formatTimeRange(i.startTime, i.endTime)
                    : "---",
              },
              {
                header: "Status",
                key: "status",
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
            endpoint={`/patients/${id}/appointments`}
            rowKey={(i: Appointment) => i.id}
            limit={5}
            refreshKey={appointmentsKey}
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
        )}

        <DataList<Prescription>
          className={can("appointments:read") ? "flex-1" : ""}
          title="Prescriptions"
          columns={[
            {
              header: "Prescribed By",
              key: "prescribedById",
              render: (i) => i.prescribedByName ?? "---",
            },
            {
              header: "Start Date",
              key: "startDate",
              render: (i) => i.startDate ?? "---",
            },
            {
              header: "End Date",
              key: "endDate",
              render: (i) => i.endDate ?? "---",
            },
            {
              header: "Medicines",
              key: "medicines",
              render: (i) =>
                i.medicines?.map((i) => i.medicineName).join(", ") ?? "---",
            },
          ]}
          actions={[
            ...(can("prescriptions:write")
              ? [
                  {
                    label: "Edit",
                    icon: <Pencil className="size-3.5" />,
                    onClick: (i: Prescription) => {
                      setEditingPrescription(i);
                      setPrescriptionFormOpen(true);
                    },
                  },
                ]
              : []),
            ...(can("prescriptions:delete")
              ? [
                  {
                    label: "Delete",
                    icon: <Trash2 className="size-3.5" />,
                    destructive: true,
                    onClick: (i: Prescription) =>
                      handleDeletePrescription(i.id),
                  },
                ]
              : []),
          ]}
          endpoint={`/patients/${id}/prescriptions`}
          rowKey={(i: Prescription) => i.id}
          limit={5}
          refreshKey={prescriptionsKey}
          hideSearch
          headerActions={
            can("prescriptions:write") && (
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

      {(can("invoices:read") || can("payments:read")) && (
        <div className="flex flex-col gap-4 lg:flex-row">
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
            refreshKey={invoicesKey}
            hideSearch
            onRowClick={(i) => navigate(`/financials/invoices/${i.id}`)}
            headerActions={
              can("invoices:write") && (
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

          <Card className="flex-1 gap-0">
            {balance && (
              <CardHeader className="pb-4 border-b">
                <CardTitle>
                  <div className="flex items-center justify-between gap-4 font-semibold">
                    <p>
                      Balance:{" "}
                      <span
                        className={
                          (balance.amount ?? 0) == 0
                            ? transactionColors.neutral
                            : (balance.amount ?? 0) > 0
                              ? transactionColors.outflow
                              : transactionColors.inflow
                        }
                      >
                        {(balance.amount ?? 0) < 0 ? "-" : ""}$
                        {Math.abs(balance.amount ?? 0).toFixed(2)}
                      </span>
                    </p>
                    <p className="text-sm font-normal text-muted-foreground">
                      In:{" "}
                      <span className={transactionColors.inflow}>
                        ${(balance.totalOut ?? 0).toFixed(2)}
                      </span>
                      {"  "}· Out:{" "}
                      <span className={transactionColors.outflow}>
                        ${(balance.totalIn ?? 0).toFixed(2)}
                      </span>
                    </p>
                  </div>
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
                  render: (i) => {
                    const isAdj =
                      i.transactionType === "adjustment" ||
                      i.transactionType === "write-off";
                    return (
                      <Badge variant="secondary" className="capitalize">
                        {isAdj
                          ? i.transactionType
                          : i.transactionMethod || "---"}
                      </Badge>
                    );
                  },
                },
                {
                  header: "Description",
                  key: "description",
                  render: (i) => (
                    <span className="text-muted-foreground truncate">
                      {i.description || "---"}
                    </span>
                  ),
                },
                {
                  header: "Amount",
                  key: "amount",
                  render: (i) => {
                    const isInflow = i.fromBalanceId === balance?.id;
                    return (
                      <span
                        className={`text-right font-medium ${isInflow ? transactionColors.inflow : transactionColors.outflow}`}
                      >
                        {isInflow ? "+" : "-"}${i.amount.toFixed(2)}
                      </span>
                    );
                  },
                },
              ]}
              rowClassName={(i: BalanceTransaction) =>
                i.transactionType === "adjustment" ||
                i.transactionType === "write-off"
                  ? "bg-muted/40"
                  : undefined
              }
              endpoint={`/patients/${id}/payments`}
              rowKey={(i: BalanceTransaction) => i.id}
              refreshKey={paymentsKey}
              actions={
                can("payments:delete")
                  ? [
                      {
                        label: "Delete",
                        icon: <Trash2 className="size-3.5" />,
                        destructive: true,
                        onClick: (i) => handleDeletePayment(i.id),
                      },
                    ]
                  : []
              }
              limit={5}
              hideSearch
              headerActions={
                can("payments:write") && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      className="gap-1"
                      onClick={() => setPaymentFormOpen(true)}
                    >
                      <Plus className="size-3.5" />
                    </Button>
                    <PaymentActionsMenu
                      actions={[
                        {
                          label: "Adjustment",
                          onClick: () => setAdjustmentFormOpen(true),
                        },
                        {
                          label: "Write-Off",
                          onClick: () => setWriteOffFormOpen(true),
                        },
                        {
                          label: "Refund",
                          onClick: () => setRefundFormOpen(true),
                        },
                      ]}
                    />
                  </div>
                )
              }
            />
          </Card>
        </div>
      )}

      <PatientForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={reloadDetails}
        initial={patient}
      />
      <ClientInvoiceForm
        open={invoiceFormOpen}
        onClose={() => setInvoiceFormOpen(false)}
        onSaved={bumpInvoices}
        defaultPatientId={id}
        defaultPatientLabel={patientName}
      />
      <ClientPaymentForm
        open={paymentFormOpen}
        onClose={() => setPaymentFormOpen(false)}
        onSaved={bumpPayments}
        defaultPatientId={id}
        defaultPatientLabel={patientName}
      />
      <ClientRefundForm
        open={refundFormOpen}
        onClose={() => setRefundFormOpen(false)}
        onSaved={bumpPayments}
        defaultPatientId={id}
        defaultPatientLabel={patientName}
        defaultCurrencyId={balance?.currencyId}
      />
      <BalanceAdjustmentForm
        open={adjustmentFormOpen}
        onClose={() => setAdjustmentFormOpen(false)}
        onSaved={bumpPayments}
        entityType="patient"
        entityId={id}
        mode="adjustment"
        defaultDirection="incoming"
      />
      <BalanceAdjustmentForm
        open={writeOffFormOpen}
        onClose={() => setWriteOffFormOpen(false)}
        onSaved={bumpPayments}
        entityType="patient"
        entityId={id}
        mode="write-off"
        defaultDirection="incoming"
      />
      <PatientAllergyForm
        open={allergyFormOpen}
        onClose={() => setAllergyFormOpen(false)}
        onSaved={bumpAllergies}
        patientId={id}
      />
      <PatientMedicineForm
        open={medicineFormOpen}
        onClose={() => setMedicineFormOpen(false)}
        onSaved={bumpMedicines}
        patientId={id}
      />
      <AppointmentForm
        open={appointmentFormOpen}
        onClose={() => setAppointmentFormOpen(false)}
        onSaved={bumpAppointments}
        initialData={{ patientId: id, patientLabel: patientName }}
      />
      <AppointmentForm
        key={viewAppointment?.id ?? "no-appt"}
        open={!!viewAppointment}
        onClose={() => setViewAppointment(null)}
        onSaved={bumpAppointments}
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
                  })) ?? [],
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
        onSaved={bumpPrescriptions}
        patientId={id}
        initial={editingPrescription}
      />
    </div>
  );

  async function handleDelete() {
    if (!patient) return;
    if (
      !(await confirm({
        title: "Delete patient?",
        description: `Delete patient ${patient.firstName} ${patient.lastName}?`,
        confirmText: "Delete",
      }))
    ) {
      return;
    }
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
      bumpAllergies();
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    }
  }

  async function handleRemoveMedicine(pmId: string) {
    try {
      await api.del(`/patient-medicines/${pmId}`);
      addAlert("success", "Medicine removed.");
      bumpMedicines();
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    }
  }

  async function handleDeletePayment(paymentId: string) {
    if (
      !(await confirm({
        title: "Delete payment?",
        description: "Delete this payment?",
        confirmText: "Delete",
      }))
    ) {
      return;
    }
    try {
      await api.del(`/client-payments/${paymentId}`);
      addAlert("success", "Payment deleted.");
      bumpPayments();
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    }
  }

  async function handleDeletePrescription(rxId: string) {
    if (
      !(await confirm({
        title: "Delete prescription?",
        description: "Delete this prescription?",
        confirmText: "Delete",
      }))
    ) {
      return;
    }
    try {
      await api.del(`/prescriptions/${rxId}`);
      addAlert("success", "Prescription deleted.");
      bumpPrescriptions();
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    }
  }
}

export default function PatientDetailPage() {
  usePageTitle("Patient");
  return <PatientDetailContent />;
}
