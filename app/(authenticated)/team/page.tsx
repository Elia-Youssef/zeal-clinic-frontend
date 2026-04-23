/**
 * Team page: Employee management with schedule availability.
 * Lists employees from GET /api/employees with CRUD operations.
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { usePageTitle } from "@/hooks/use-page-title";
import { DataList } from "@/components/data-list";
import { AddButton } from "@/components/add-button";
import { type Column } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import type { Employee } from "@/lib/types";
import { EmployeeForm } from "@/components/forms/employee-form";
import { usePermissions } from "@/hooks/use-permissions";

/* ------------------------------------------------------------------ */
/*  Team page content                                                  */
/* ------------------------------------------------------------------ */

function TeamContent() {
  const router = useRouter();
  const { can } = usePermissions();
  const [formOpen, setFormOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const columns: Column<Employee>[] = [
    {
      key: "name",
      header: "Name",
      render: (e) => (
        <span className="font-medium">
          {e.firstName} {e.lastName}
        </span>
      ),
    },
    { key: "contact", header: "Contact", render: (e) => e.contact },
    { key: "email", header: "Email", render: (e) => e.email || "—" },
    {
      key: "role",
      header: "Role",
      className: "w-40",
      render: (e) => <Badge variant="outline">{e.role}</Badge>,
    },
    {
      key: "type",
      header: "Type",
      className: "w-25",
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
        onRowClick={(e) => router.push(`/team/${e.id}`)}
        headerActions={
          can("team:write") ? (
            <AddButton label="Add Employee" onClick={() => setFormOpen(true)} />
          ) : undefined
        }
        refreshKey={refreshKey}
      />

      <EmployeeForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Page export                                                        */
/* ------------------------------------------------------------------ */

export default function TeamPage() {
  usePageTitle("Team");
  return <TeamContent />;
}
