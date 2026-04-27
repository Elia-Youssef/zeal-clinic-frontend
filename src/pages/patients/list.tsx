"use client";

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DataList } from "@/components/data/data-list";
import { AddButton } from "@/components/shared/add-button";
import { type Column } from "@/components/data/data-table";
import { Badge } from "@/components/ui/badge";
import type { Patient } from "@/lib/types";
import { PatientForm } from "@/components/forms/patient-form";
import { usePermissions } from "@/hooks/use-permissions";

export default function PatientsListPage() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const [formOpen, setFormOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const columns: Column<Patient>[] = [
    {
      key: "name",
      header: "Name",
      render: (p) => (
        <span className="font-medium">
          {p.firstName} {p.middleName ? `${p.middleName} ` : ""}
          {p.lastName}
        </span>
      ),
    },
    {
      key: "contact",
      header: "Contact",
      render: (p) => p.contact,
    },
    {
      key: "email",
      header: "Email",
      render: (p) => p.email || "—",
    },
    {
      key: "dob",
      header: "Date of Birth",
      className: "w-35",
      render: (p) => p.dateOfBirth?.slice(0, 10) ?? "—",
    },
  ];

  return (
    <>
      <DataList<Patient>
        title="All Patients"
        endpoint="/patients"
        columns={columns}
        rowKey={(p) => p.id}
        searchPlaceholder="Search patients…"
        emptyMessage={
          can("patients:write")
            ? "No patients yet. Click Add Patient to get started."
            : "No patients yet."
        }
        emptySearchMessage="No patients match your search."
        onRowClick={(p) => navigate(`/patients/${p.id}`)}
        headerActions={
          can("patients:write") ? (
            <AddButton label="Add Patient" onClick={() => setFormOpen(true)} />
          ) : undefined
        }
        refreshKey={refreshKey}
      />

      <PatientForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />
    </>
  );
}
