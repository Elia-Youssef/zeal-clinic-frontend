import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePageTitle } from "@/hooks/use-page-title";
import { DataList } from "@/components/data/data-list";
import { AddButton } from "@/components/shared/add-button";
import { type Column } from "@/components/data/data-table";
import type { Supplier } from "@/lib/types";
import { SupplierForm } from "@/components/forms/supplier-form";
import { usePermissions } from "@/hooks/use-permissions";
import { beirutDayKey } from "@/lib/tz";

function SuppliersContent() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const [formOpen, setFormOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const columns: Column<Supplier>[] = [
    {
      key: "name",
      header: "Name",
      className: "truncate",
      sortable: true,
      sortKey: "name",
      render: (s) => <span className="font-medium">{s.name}</span>,
    },
    {
      key: "contact",
      header: "Contact",
      className: "w-45",
      sortable: true,
      sortKey: "contact",
      render: (s) => s.contact || "---",
    },
    {
      key: "email",
      header: "Email",
      className: "w-68",
      sortable: true,
      sortKey: "email",
      render: (s) => s.email || "---",
    },
    {
      key: "address",
      header: "Address",
      className: "w-65",
      render: (s) => s.address || "---",
    },
    {
      key: "date",
      header: "Created",
      className: "w-36",
      render: (s) => beirutDayKey(s.createdAt) || "---",
    },
  ];

  return (
    <>
      <DataList<Supplier>
        title="All Suppliers"
        endpoint="/suppliers"
        columns={columns}
        rowKey={(s) => s.id}
        emptyMessage={
          can("suppliers:write")
            ? "No suppliers yet. Click Add Supplier to get started."
            : "No suppliers yet."
        }
        emptySearchMessage="No suppliers match your search."
        onRowClick={(s) => navigate(`/suppliers/${s.id}`)}
        headerActions={
          can("suppliers:write") ? (
            <AddButton label="New" onClick={() => setFormOpen(true)} />
          ) : undefined
        }
        refreshKey={refreshKey}
      />

      <SupplierForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />
    </>
  );
}

export default function SuppliersPage() {
  usePageTitle("Suppliers");
  return <SuppliersContent />;
}
