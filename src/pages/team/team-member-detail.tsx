import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loading } from "@/components/shared/loading";
import { PageHeader } from "@/components/shared/page-header";
import { DetailField } from "@/components/shared/detail-field";
import { DataList } from "@/components/data/data-list";
import { PaymentActionsMenu } from "@/components/shared/payment-actions-menu";
import {
  DataTable,
  type Column,
  type RowAction,
} from "@/components/data/data-table";
import { EmployeeWeekSchedule } from "@/components/shared/employee-week-schedule";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import { useEmployeesStore } from "@/lib/stores/employees-store";
import { useAlertStore } from "@/lib/stores/alert-store";
import { transactionColors } from "@/lib/constants";
import type {
  AuditLogEntry,
  Salary,
  SalaryPreparation,
  Transaction,
} from "@/lib/types";
import { EmployeeForm } from "@/components/forms/employee-form";
import { EmployeePaymentForm } from "@/components/forms/employee-payment-form";
import { SalaryForm } from "@/components/forms/salary-form";
import { SalaryAdjustmentForm } from "@/components/forms/salary-adjustment-form";
import { BalanceAdjustmentForm } from "@/components/forms/balance-adjustment-form";
import { usePermissions } from "@/hooks/use-permissions";
import { usePageTitle } from "@/hooks/use-page-title";
import { useConfirm } from "@/hooks/use-confirm";

/* ------------------------------------------------------------------ */
/*  Page content                                                       */
/* ------------------------------------------------------------------ */

function EmployeeDetailContent() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const addAlert = useAlertStore((s) => s.addAlert);
  const { can } = usePermissions();
  const confirm = useConfirm();

  const employee = useEmployeesStore((s) => s.current);
  const balance = useEmployeesStore((s) => s.currentBalance);
  const slots = useEmployeesStore((s) => s.slots);
  const scheduleDays = useEmployeesStore((s) => s.scheduleDays);
  const vacations = useEmployeesStore((s) => s.vacations);
  const loading = useEmployeesStore((s) => s.detailLoading);
  const fetchDetail = useEmployeesStore((s) => s.fetchDetail);
  const fetchBalance = useEmployeesStore((s) => s.fetchBalance);
  const fetchScheduleForWeek = useEmployeesStore((s) => s.fetchScheduleForWeek);
  const setCurrent = useEmployeesStore((s) => s.setCurrent);
  console.log(balance)

  const [editOpen, setEditOpen] = useState(false);
  const [salaryFormOpen, setSalaryFormOpen] = useState(false);
  const [paymentFormOpen, setPaymentFormOpen] = useState(false);
  const [adjustmentFormOpen, setAdjustmentFormOpen] = useState(false);
  const [writeOffFormOpen, setWriteOffFormOpen] = useState(false);
  const [paymentsKey, setPaymentsKey] = useState(0);
  const [preparedSalariesKey, setPreparedSalariesKey] = useState(0);
  const [editingAdjustment, setEditingAdjustment] = useState<SalaryPreparation | null>(
    null,
  );
  /* Sunday-anchored week start used by the schedule grid. */
  const [weekStart, setWeekStart] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay());
    return d;
  });

  const reloadDetails = () => fetchDetail(id);
  const bumpPayments = () => {
    setPaymentsKey((k) => k + 1);
    fetchBalance(id);
  };
  const bumpPreparedSalaries = () => {
    setPreparedSalariesKey((k) => k + 1);
    setPaymentsKey((k) => k + 1);
    fetchBalance(id);
  };

  /* Any ISO date inside the visible Sun–Sat window. The backend derives
   * the week (and the calendar month for monthHours) from this single
   * date, so we don't need to compute the bounds here. */
  const weekDateIso = (() => {
    const y = weekStart.getFullYear();
    const m = String(weekStart.getMonth() + 1).padStart(2, "0");
    const day = String(weekStart.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  })();

  const reloadSchedule = () => {
    reloadDetails();
    fetchScheduleForWeek(id, weekDateIso);
  };

  useEffect(() => {
    fetchDetail(id);
    return () => {
      setCurrent(null);
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    fetchScheduleForWeek(id, weekDateIso);
  }, [id, weekDateIso]);

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
      reloadDetails();
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
      reloadDetails();
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

  const salaryColumns: Column<Salary>[] = [
    {
      key: "amount",
      header: "Amount",
      render: (s) => (
        <span className="font-medium">${s.amount.toFixed(2)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (s) => (
        <Badge variant={s.isActive ? "default" : "outline"}>
          {s.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      key: "effectiveDate",
      header: "Effective",
      render: (s) => s.effectiveDate?.slice(0, 10) ?? "---",
    },
    {
      key: "notes",
      header: "Notes",
      render: (s) => (
        <span className="text-muted-foreground">{s.notes || "---"}</span>
      ),
    },
  ];

  const salaryActions: RowAction<Salary>[] = can("team:write")
    ? [
        {
          label: "Toggle Active",
          onClick: (s) => handleToggleSalaryActive(s.id, !s.isActive),
        },
        ...(can("team:delete")
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
        backHref="/team"
        title={`${employee.firstName} ${employee.lastName}`}
        onEdit={can("team:write") ? () => setEditOpen(true) : undefined}
        onDelete={can("team:delete") ? handleDelete : undefined}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <DetailField label="Contact">{employee.contact}</DetailField>
          <DetailField label="Email">{employee.email || "---"}</DetailField>
          <DetailField label="Date of Birth">
            {employee.dateOfBirth?.slice(0, 10) ?? "---"}
          </DetailField>
        </CardContent>
      </Card>

      <EmployeeWeekSchedule
        employeeId={id}
        slots={slots}
        scheduleDays={scheduleDays}
        vacations={vacations}
        weekStart={weekStart}
        onWeekChange={setWeekStart}
        onChange={reloadSchedule}
        canEditGeneral={can("schedule:write")}
        canRequestVacation={can("schedule:read")}
      />

      {/* Salaries + Payments */}
      <div className="flex flex-row gap-4">
        <Card
          className={`${can("transactions:read") ? "flex-1" : ""} flex flex-col gap-4`}
        >
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Salaries</CardTitle>
            {can("team:write") && (
              <Button
                size="sm"
                className="gap-1"
                onClick={() => setSalaryFormOpen(true)}
              >
                <Plus className="size-3.5" />
              </Button>
            )}
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {!employee.salaries || employee.salaries.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                No salary records.
              </p>
            ) : (
              <DataTable
                columns={salaryColumns}
                data={employee.salaries}
                rowKey={(s) => s.id}
                actions={salaryActions}
              />
            )}
          </CardContent>
        </Card>

        {can("transactions:read") && (
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
                  render: (p) => p.createdAt?.slice(0, 10) ?? "---",
                },
                {
                  header: "Type",
                  key: "type",
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
                  render: (p) => (
                    <span className="truncate text-muted-foreground">
                      {p.description || "---"}
                    </span>
                  ),
                },
                {
                  header: "Amount",
                  key: "amount",
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
                  ? "bg-amber-50 dark:bg-amber-950/30"
                  : undefined
              }
              rowKey={(p) => p.id}
              actions={
                can("transactions:delete")
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
              limit={10}
              hideSearch
              refreshKey={paymentsKey}
              headerActions={
                can("transactions:write") && (
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
                      ]}
                    />
                  </div>
                )
              }
            />
          </Card>
        )}
      </div>

      <DataList<SalaryPreparation>
        title="Prepared Salaries"
        endpoint={`/employees/${id}/prepared-salaries`}
        columns={[
          {
            header: "Period",
            key: "period",
            render: (p) =>
              `${p.periodStart?.slice(0, 10) ?? "---"} → ${p.periodEnd?.slice(0, 10) ?? "---"}`,
          },
          {
            header: "Base",
            key: "base",
            render: (p) => `$${p.baseSalary?.toFixed(2) ?? "0.00"}`,
          },
          {
            header: "Adjustment",
            key: "adjustment",
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
            render: (p) => (
              <span className="font-medium">
                ${p.preparedAmount?.toFixed(2) ?? "0.00"}
              </span>
            ),
          },
          {
            header: "Date",
            key: "date",
            render: (p) => p.createdAt?.slice(0, 10) ?? "---",
          },
        ]}
        rowKey={(p) => p.id}
        actions={[
          ...(can("transactions:write")
            ? [
                {
                  label: "Edit Adjustment",
                  icon: <Pencil className="size-3.5" />,
                  onClick: (p: SalaryPreparation) => setEditingAdjustment(p),
                },
              ]
            : []),
          ...(can("transactions:delete")
            ? [
                {
                  label: "Delete",
                  icon: <Trash2 className="size-3.5" />,
                  destructive: true,
                  onClick: (p: SalaryPreparation) => handleDeletePreparation(p),
                },
              ]
            : []),
        ]}
        limit={10}
        hideSearch
        refreshKey={preparedSalariesKey}
        emptyMessage="No prepared salaries."
      />

      <DataList<AuditLogEntry>
        title="Actions"
        endpoint={`/employees/${id}/actions`}
        columns={[
          {
            header: "Action",
            key: "action",
            render: (a) => (
              <Badge
                variant={
                  a.action?.startsWith("POST")
                    ? "default"
                    : a.action?.startsWith("DELETE")
                      ? "destructive"
                      : "secondary"
                }
              >
                {a.action}
              </Badge>
            ),
          },
          {
            header: "Entity",
            key: "entity",
            render: (a) => a.entityType ?? "---",
          },
          {
            header: "Details",
            key: "details",
            render: (a) => (
              <span className="truncate text-muted-foreground">
                {a.details || "---"}
              </span>
            ),
          },
          {
            header: "Date",
            key: "date",
            render: (a) => a.createdAt?.slice(0, 10) ?? "---",
          },
        ]}
        rowKey={(a) => a.id}
        limit={10}
        searchPlaceholder="Search actions…"
        emptyMessage="No recent actions."
      />

      <EmployeeForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={reloadDetails}
        initial={employee}
      />
      <SalaryForm
        open={salaryFormOpen}
        onClose={() => setSalaryFormOpen(false)}
        onSaved={reloadDetails}
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
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page export                                                        */
/* ------------------------------------------------------------------ */

export default function EmployeeDetailPage() {
  usePageTitle("Employee");
  return <EmployeeDetailContent />;
}
