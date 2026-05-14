import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Wallet } from "lucide-react";
import { usePageTitle } from "@/hooks/use-page-title";
import { DataList } from "@/components/data/data-list";
import { AddButton } from "@/components/shared/add-button";
import { type Column } from "@/components/data/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Employee } from "@/lib/types";
import { EmployeeForm } from "@/components/forms/employee-form";
import { SalaryPreparationForm } from "@/components/forms/salary-preparation-form";
import { usePermissions } from "@/hooks/use-permissions";

function TeamContent() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const [formOpen, setFormOpen] = useState(false);
  const [salaryPrepOpen, setSalaryPrepOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const columns: Column<Employee>[] = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      sortKey: "firstName",
      render: (e) => (
        <span className="font-medium">
          {e.firstName} {e.lastName}
        </span>
      ),
    },
    {
      key: "contact",
      header: "Contact",
      sortable: true,
      sortKey: "contact",
      render: (e) => e.contact,
    },
    {
      key: "email",
      header: "Email",
      sortable: true,
      sortKey: "email",
      render: (e) => e.email || "---",
    },
    {
      key: "role",
      header: "Role",
      className: "w-40",
      sortable: true,
      sortKey: "role",
      render: (e) => <Badge variant="outline">{e.role}</Badge>,
    },
    {
      key: "type",
      header: "Type",
      className: "w-25",
      sortable: true,
      sortKey: "employmentType",
      render: (e) => (
        <Badge
          variant={e.employmentType === "Full-time" ? "default" : "secondary"}
        >
          {e.employmentType}
        </Badge>
      ),
    },
  ];

  return (
    <>
      <DataList<Employee>
        title="Employees"
        endpoint="/employees"
        columns={columns}
        rowKey={(e) => e.id}
        searchPlaceholder="Search employees…"
        emptyMessage="No employees yet."
        emptySearchMessage="No employees match your search."
        onRowClick={(e) => navigate(`/team/${e.id}`)}
        headerActions={
          <div className="flex items-center gap-2">
            {can("employee-payments:write") && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => setSalaryPrepOpen(true)}
              >
                <Wallet className="size-3.5" />
                Prepare Salaries
              </Button>
            )}
            {can("employees:write") && (
              <AddButton
                label="Add Employee"
                onClick={() => setFormOpen(true)}
              />
            )}
          </div>
        }
        refreshKey={refreshKey}
      />

      <EmployeeForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />

      <SalaryPreparationForm
        open={salaryPrepOpen}
        onClose={() => setSalaryPrepOpen(false)}
      />
    </>
  );
}

export default function TeamPage() {
  usePageTitle("Team");
  return <TeamContent />;
}
