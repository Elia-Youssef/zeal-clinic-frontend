"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loading } from "@/components/loading";
import { PageHeader } from "@/components/page-header";
import { DetailField } from "@/components/detail-field";
import { DataList } from "@/components/data-list";
import { DataTable, type Column, type RowAction } from "@/components/data-table";
import { EmployeeWeekSchedule } from "@/components/employee-week-schedule";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import { useEmployeesStore } from "@/lib/stores/employees-store";
import { useAlertStore } from "@/lib/stores/alert-store";
import type { AuditLogEntry, Salary, Transaction } from "@/lib/types";
import { EmployeeForm } from "@/components/forms/employee-form";
import { EmployeePaymentForm } from "@/components/forms/employee-payment-form";
import { SalaryForm } from "@/components/forms/salary-form";
import { usePermissions } from "@/hooks/use-permissions";
import { usePageTitle } from "@/hooks/use-page-title";

/* ------------------------------------------------------------------ */
/*  Page content                                                       */
/* ------------------------------------------------------------------ */

function EmployeeDetailContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const addAlert = useAlertStore((s) => s.addAlert);
  const { can } = usePermissions();

  const employee = useEmployeesStore((s) => s.current);
  const slots = useEmployeesStore((s) => s.slots);
  const loading = useEmployeesStore((s) => s.detailLoading);
  const fetchDetail = useEmployeesStore((s) => s.fetchDetail);
  const setCurrent = useEmployeesStore((s) => s.setCurrent);

  const [editOpen, setEditOpen] = useState(false);
  const [salaryFormOpen, setSalaryFormOpen] = useState(false);
  const [paymentFormOpen, setPaymentFormOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const reload = () => {
    fetchDetail(id);
    setRefreshKey((k) => k + 1);
  };

  useEffect(() => {
    reload();
    return () => {
      setCurrent(null);
    };
  }, [id]);

  const handleDelete = async () => {
    if (
      !employee ||
      !confirm(`Delete employee ${employee.firstName} ${employee.lastName}?`)
    ) {
      return;
    }
    try {
      await api.del(`/employees/${id}`);
      addAlert("success", "Employee deleted.");
      router.push("/team");
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    }
  };

  const handleDeleteSalary = async (salaryId: string) => {
    if (!confirm("Delete this salary record?")) return;
    try {
      await api.del(`/employee-salaries/${salaryId}`);
      addAlert("success", "Salary deleted.");
      reload();
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
      reload();
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
      render: (s) => s.effectiveDate?.slice(0, 10) ?? "—",
    },
    {
      key: "notes",
      header: "Notes",
      render: (s) => (
        <span className="text-muted-foreground">{s.notes || "—"}</span>
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
        badges={
          <>
            <Badge variant="outline">{employee.role}</Badge>
            <Badge
              variant={
                employee.employmentType === "Full-time"
                  ? "default"
                  : "secondary"
              }
            >
              {employee.employmentType}
            </Badge>
          </>
        }
        onEdit={can("team:write") ? () => setEditOpen(true) : undefined}
        onDelete={can("team:delete") ? handleDelete : undefined}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
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
        onChange={reload}
        canEdit={can("team:write")}
      />

      {/* Salaries + Payments */}
      <div className="flex flex-row gap-4">
        <Card className="flex-1 flex flex-col gap-4">
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

        <DataList<Transaction>
          className="flex-1"
          title="Payments"
          endpoint={`/employees/${id}/payments`}
          columns={[
            {
              header: "Date",
              key: "date",
              render: (p) => p.createdAt?.slice(0, 10) ?? "—",
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
                  "—"
                ),
            },
            {
              header: "Description",
              key: "description",
              render: (p) => (
                <span className="truncate text-muted-foreground">
                  {p.description || "—"}
                </span>
              ),
            },
            {
              header: "Amount",
              key: "amount",
              render: (p) => {
                const isIn = p.transactionType === "refund";
                return (
                  <span
                    className={`text-right font-medium ${isIn ? "text-green-600" : "text-red-500"}`}
                  >
                    {isIn ? "+" : "-"}${p.amount.toFixed(2)}
                  </span>
                );
              },
            },
          ]}
          rowKey={(p) => p.id}
          limit={10}
          hideSearch
          refreshKey={refreshKey}
          headerActions={
            can("transactions:write") && (
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
      </div>

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
            render: (a) => a.entityType ?? "—",
          },
          {
            header: "Details",
            key: "details",
            render: (a) => (
              <span className="truncate text-muted-foreground">
                {a.details || "—"}
              </span>
            ),
          },
          {
            header: "Date",
            key: "date",
            render: (a) => a.createdAt?.slice(0, 10) ?? "—",
          },
        ]}
        rowKey={(a) => a.id}
        limit={10}
        searchPlaceholder="Search actions…"
        emptyMessage="No recent actions."
        refreshKey={refreshKey}
      />

      <EmployeeForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={reload}
        initial={employee}
      />
      <SalaryForm
        open={salaryFormOpen}
        onClose={() => setSalaryFormOpen(false)}
        onSaved={reload}
        employeeId={id}
      />
      <EmployeePaymentForm
        open={paymentFormOpen}
        onClose={() => setPaymentFormOpen(false)}
        onSaved={reload}
        employeeId={id}
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
