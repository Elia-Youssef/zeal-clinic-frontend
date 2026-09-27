import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Pencil, Plus, Trash2, UserCog } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loading } from "@/components/shared/loading";
import { PageHeader } from "@/components/shared/page-header";
import { DetailField } from "@/components/shared/detail-field";
import { DataList } from "@/components/data/data-list";
import { PaymentActionsMenu } from "@/components/shared/payment-actions-menu";
import { type Column, type RowAction } from "@/components/data/data-table";
import { EmployeeWeekSchedule } from "@/components/shared/employee-week-schedule";
import { api } from "@/lib/api";
import { formatTimeRange, getErrorMessage } from "@/lib/utils";
import { beirutDayKey } from "@/lib/tz";
import { useEmployeesStore } from "@/lib/stores/employees-store";
import { useAlertStore } from "@/lib/stores/alert-store";
import {
  transactionColors,
  adjustmentRowTint,
  appointmentStatusTint,
} from "@/lib/constants";
import type {
  Appointment,
  Salary,
  SalaryPreparation,
  Transaction,
} from "@/lib/types";
import { EmployeeForm } from "@/components/forms/employee-form";
import { EmployeePaymentForm } from "@/components/forms/employee-payment-form";
import { SalaryForm } from "@/components/forms/salary-form";
import { SalaryAdjustmentForm } from "@/components/forms/salary-adjustment-form";
import { BalanceAdjustmentForm } from "@/components/forms/balance-adjustment-form";
import { AppointmentForm } from "@/components/forms/appointment-form";
import { usePermissions } from "@/hooks/use-permissions";
import { useConfirm } from "@/hooks/use-confirm";

// Shared employee detail layout. `readOnly` (self view from /profile) hides every
// management action and force-shows the financial/appointment sections that are
// otherwise gated behind management scopes, so an employee can always view their
// own salaries, payments and appointments. It also force-enables self time-off /
// overtime requests on the schedule (otherwise gated behind hr:write). Self-read
// of every endpoint below must return 200; a 403 hard-redirects to /dashboard.
export function EmployeeDetailView({
  employeeId,
  readOnly = false,
}: {
  employeeId: string;
  readOnly?: boolean;
}) {
  const id = employeeId;
  const navigate = useNavigate();
  const addAlert = useAlertStore((s) => s.addAlert);
  const { can } = usePermissions();
  const confirm = useConfirm();

  const employee = useEmployeesStore((s) => s.current);
  const balance = useEmployeesStore((s) => s.currentBalance);
  const loading = useEmployeesStore((s) => s.detailLoading);
  const fetchDetail = useEmployeesStore((s) => s.fetchDetail);
  const fetchBalance = useEmployeesStore((s) => s.fetchBalance);
  const setCurrent = useEmployeesStore((s) => s.setCurrent);

  const [editOpen, setEditOpen] = useState(false);
  const [salaryFormOpen, setSalaryFormOpen] = useState(false);
  const [paymentFormOpen, setPaymentFormOpen] = useState(false);
  const [adjustmentFormOpen, setAdjustmentFormOpen] = useState(false);
  const [writeOffFormOpen, setWriteOffFormOpen] = useState(false);
  const [paymentsKey, setPaymentsKey] = useState(0);
  const [preparedSalariesKey, setPreparedSalariesKey] = useState(0);
  const [salariesKey, setSalariesKey] = useState(0);
  const [editingAdjustment, setEditingAdjustment] =
    useState<SalaryPreparation | null>(null);
  const [viewAppointment, setViewAppointment] = useState<Appointment | null>(
    null,
  );

  useEffect(() => {
    fetchDetail(id);
    return () => setCurrent(null);
  }, [id, fetchDetail, setCurrent]);

  const reloadEmployee = () => fetchDetail(id);
  const bumpPayments = () => {
    setPaymentsKey((k) => k + 1);
    fetchBalance(id);
  };
  const bumpPreparedSalaries = () => {
    setPreparedSalariesKey((k) => k + 1);
    bumpPayments();
  };
  const bumpSalaries = () => setSalariesKey((k) => k + 1);

  const handleDelete = async () => {
    if (!employee) return;
    if (
      !(await confirm({
        title: "Delete employee?",
        description: `Delete employee ${employee.firstName} ${employee.lastName}?`,
        confirmText: "Delete",
      }))
    ) {
      return;
    }
    try {
      await api.del(`/employees/${id}`);
      addAlert("success", "Employee deleted.");
      navigate("/team");
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    }
  };

  const handleDeletePreparation = async (prep: SalaryPreparation) => {
    if (
      !(await confirm({
        title: "Delete preparation?",
        description: `Delete the prepared salary for ${prep.employeeName ?? "this employee"}? The linked transaction will be reversed.`,
        confirmText: "Delete",
      }))
    ) {
      return;
    }
    try {
      await api.del(`/employee-salary-preparations/${prep.id}`);
      addAlert("success", "Preparation deleted.");
      bumpPreparedSalaries();
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
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
      await api.del(`/employee-payments/${paymentId}`);
      addAlert("success", "Payment deleted.");
      bumpPayments();
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    }
  };

  const handleDeleteSalary = async (salaryId: string) => {
    if (
      !(await confirm({
        title: "Delete salary record?",
        description: "Delete this salary record?",
        confirmText: "Delete",
      }))
    ) {
      return;
    }
    try {
      await api.del(`/employee-salaries/${salaryId}`);
      addAlert("success", "Salary deleted.");
      bumpSalaries();
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    }
  };

  const handleToggleSalaryActive = async (
    salaryId: string,
    isActive: boolean,
  ) => {
    try {
      await api.put(`/employee-salaries/${salaryId}`, { isActive });
      bumpSalaries();
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    }
  };

  if (loading) return <Loading />;
  if (!employee) {
    return (
      <p className="py-12 text-center text-muted-foreground">
        Employee not found.
      </p>
    );
  }

  const showPayments = readOnly || can("employee-payments:read");
  const showAppointments = readOnly || can("appointments:read");

  const salaryColumns: Column<Salary>[] = [
    {
      key: "amount",
      header: "Amount",
      className: "w-34",
      render: (s) => (
        <span className="font-medium">${s.amount.toFixed(2)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      className: "w-30",
      render: (s) => (
        <Badge variant={s.isActive ? "default" : "outline"}>
          {s.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      key: "effectiveDate",
      header: "Effective",
      className: "w-40",
      render: (s) => beirutDayKey(s.effectiveDate) || "---",
    },
    {
      key: "notes",
      header: "Notes",
      className: "truncate",
      render: (s) => (
        <span className="text-muted-foreground">{s.notes || "---"}</span>
      ),
    },
  ];

  const salaryActions: RowAction<Salary>[] =
    !readOnly && can("employee-salaries:write")
      ? [
          {
            label: "Toggle Active",
            onClick: (s) => handleToggleSalaryActive(s.id, !s.isActive),
          },
          ...(can("employee-salaries:delete")
            ? [
                {
                  label: "Delete",
                  icon: <Trash2 className="size-3.5" />,
                  destructive: true,
                  onClick: (s: Salary) => handleDeleteSalary(s.id),
                },
              ]
            : []),
        ]
      : [];

  return (
    <div className="space-y-4">
      <PageHeader
        backHref={readOnly ? "/dashboard" : "/team"}
        title={`${employee.firstName} ${employee.lastName}`}
        extraActions={
          !readOnly && employee.userId && can("users:read") ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/settings/staff/${employee.userId}`)}
            >
              <UserCog className="size-4" /> User Account
            </Button>
          ) : undefined
        }
        onEdit={
          !readOnly && can("employees:write")
            ? () => setEditOpen(true)
            : undefined
        }
        onDelete={
          !readOnly && can("employees:delete") ? handleDelete : undefined
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 sm:gap-x-8 gap-y-3 text-sm">
          <DetailField label="Contact">{employee.contact}</DetailField>
          <DetailField label="Email">{employee.email || "---"}</DetailField>
          <DetailField label="Date of Birth">
            {beirutDayKey(employee.dateOfBirth) || "---"}
          </DetailField>
        </CardContent>
      </Card>

      <EmployeeWeekSchedule
        employeeId={id}
        canEditGeneral={!readOnly && can("employee-schedules:write")}
        canRequestChange={readOnly || can("hr:write")}
      />

      <div className="flex flex-col gap-4 lg:flex-row">
        <DataList<Salary>
          className={showPayments ? "flex-1" : ""}
          title="Salaries"
          endpoint={`/employees/${id}/salaries`}
          columns={salaryColumns}
          rowKey={(s) => s.id}
          actions={salaryActions}
          limit={5}
          hideSearch
          refreshKey={salariesKey}
          emptyMessage="No salary records."
          headerActions={
            !readOnly &&
            can("employee-salaries:write") && (
              <Button
                size="sm"
                className="gap-1"
                aria-label="Add salary"
                onClick={() => setSalaryFormOpen(true)}
              >
                <Plus className="size-3.5" />
              </Button>
            )
          }
        />

        {showPayments && (
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
            <DataList<Transaction>
              className="ring-0"
              title="Payments"
              endpoint={`/employees/${id}/payments`}
              columns={[
                {
                  header: "Date",
                  key: "date",
                  className: "w-36",
                  render: (p) => beirutDayKey(p.createdAt) || "---",
                },
                {
                  header: "Type",
                  key: "type",
                  className: "w-36",
                  render: (p) =>
                    p.transactionType ? (
                      <Badge variant="outline" className="capitalize">
                        {p.transactionType}
                      </Badge>
                    ) : (
                      "---"
                    ),
                },
                {
                  header: "Description",
                  key: "description",
                  className: "truncate",
                  render: (p) => (
                    <span className="truncate text-muted-foreground">
                      {p.description || "---"}
                    </span>
                  ),
                },
                {
                  header: "Amount",
                  key: "amount",
                  className: "w-32 text-right",
                  render: (p) => {
                    const isInflow = balance?.id === p.fromBalanceId;
                    return (
                      <span
                        className={`text-right font-medium ${isInflow ? transactionColors.inflow : transactionColors.outflow}`}
                      >
                        {isInflow ? "+" : "-"}${p.amount.toFixed(2)}
                      </span>
                    );
                  },
                },
              ]}
              rowClassName={(p) =>
                p.transactionType === "adjustment" ||
                p.transactionType === "write-off"
                  ? adjustmentRowTint
                  : undefined
              }
              rowKey={(p) => p.id}
              actions={
                !readOnly && can("employee-payments:delete")
                  ? [
                      {
                        label: "Delete",
                        icon: <Trash2 className="size-3.5" />,
                        destructive: true,
                        onClick: (p) => handleDeletePayment(p.id),
                      },
                    ]
                  : []
              }
              limit={5}
              hideSearch
              refreshKey={paymentsKey}
              headerActions={
                !readOnly &&
                can("employee-payments:write") && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      className="gap-1"
                      aria-label="Add payment"
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
                      ]}
                    />
                  </div>
                )
              }
            />
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DataList<SalaryPreparation>
          title="Prepared Salaries"
          endpoint={`/employees/${id}/prepared-salaries`}
          columns={[
            {
              header: "Period",
              key: "period",
              className: "truncate",
              render: (p) =>
                `${beirutDayKey(p.periodStart) || "---"} → ${beirutDayKey(p.periodEnd) || "---"}`,
            },
            {
              header: "Base",
              key: "base",
              className: "w-32",
              render: (p) => `$${p.baseSalary?.toFixed(2) ?? "0.00"}`,
            },
            {
              header: "Adjustment",
              key: "adjustment",
              className: "w-32",
              render: (p) =>
                p.adjustment != null && p.adjustment !== 0 ? (
                  <span
                    className={
                      p.adjustment > 0
                        ? transactionColors.inflow
                        : transactionColors.outflow
                    }
                  >
                    {p.adjustment > 0 ? "+" : "-"}$
                    {Math.abs(p.adjustment).toFixed(2)}
                  </span>
                ) : (
                  <span className="text-muted-foreground">---</span>
                ),
            },
            {
              header: "Prepared",
              key: "prepared",
              className: "w-32",
              render: (p) => (
                <span className="font-medium">
                  ${p.preparedAmount?.toFixed(2) ?? "0.00"}
                </span>
              ),
            },
            {
              header: "Date",
              key: "date",
              className: "w-32",
              render: (p) => beirutDayKey(p.createdAt) || "---",
            },
          ]}
          rowKey={(p) => p.id}
          actions={
            readOnly
              ? []
              : [
                  ...(can("employee-payments:write")
                    ? [
                        {
                          label: "Edit Adjustment",
                          icon: <Pencil className="size-3.5" />,
                          onClick: (p: SalaryPreparation) =>
                            setEditingAdjustment(p),
                        },
                      ]
                    : []),
                  ...(can("employee-payments:delete")
                    ? [
                        {
                          label: "Delete",
                          icon: <Trash2 className="size-3.5" />,
                          destructive: true,
                          onClick: (p: SalaryPreparation) =>
                            handleDeletePreparation(p),
                        },
                      ]
                    : []),
                ]
          }
          limit={5}
          hideSearch
          refreshKey={preparedSalariesKey}
          emptyMessage="No prepared salaries."
        />

        {showAppointments && (
          <DataList<Appointment>
            title="Appointments"
            endpoint={`/employees/${id}/appointments`}
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
            rowKey={(i) => i.id}
            limit={5}
            hideSearch
            emptyMessage="No appointments."
            onRowClick={(i) => setViewAppointment(i)}
          />
        )}
      </div>

      {!readOnly && (
        <>
          <EmployeeForm
            open={editOpen}
            onClose={() => setEditOpen(false)}
            onSaved={reloadEmployee}
            initial={employee}
          />
          <SalaryForm
            open={salaryFormOpen}
            onClose={() => setSalaryFormOpen(false)}
            onSaved={bumpSalaries}
            employeeId={id}
          />
          <EmployeePaymentForm
            open={paymentFormOpen}
            onClose={() => setPaymentFormOpen(false)}
            onSaved={bumpPayments}
            employeeId={id}
          />
          <BalanceAdjustmentForm
            open={adjustmentFormOpen}
            onClose={() => setAdjustmentFormOpen(false)}
            onSaved={bumpPayments}
            entityType="employee"
            entityId={id}
            mode="adjustment"
            defaultDirection="outgoing"
          />
          <BalanceAdjustmentForm
            open={writeOffFormOpen}
            onClose={() => setWriteOffFormOpen(false)}
            onSaved={bumpPayments}
            entityType="employee"
            entityId={id}
            mode="write-off"
            defaultDirection="outgoing"
          />
          <SalaryAdjustmentForm
            open={!!editingAdjustment}
            onClose={() => setEditingAdjustment(null)}
            onSaved={bumpPreparedSalaries}
            preparation={editingAdjustment}
          />
        </>
      )}

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
