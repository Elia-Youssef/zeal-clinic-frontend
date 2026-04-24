"use client";

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePageTitle } from "@/hooks/use-page-title";
import { DataList } from "@/components/data/data-list";
import { AddButton } from "@/components/shared/add-button";
import { type Column } from "@/components/data/data-table";
import type { Supplier } from "@/lib/types";
import { SupplierForm } from "@/components/forms/supplier-form";
import { usePermissions } from "@/hooks/use-permissions";

function SuppliersContent() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const [formOpen, setFormOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const columns: Column<Supplier>[] = [
    {
      key: "name",
      header: "Name",
      render: (s) => <span className="font-medium">{s.name}</span>,
    },
    {
      key: "contact",
      header: "Contact",
      render: (s) => s.contact || "—",
    },
    {
      key: "email",
      header: "Email",
      render: (s) => s.email || "—",
    },
    {
      key: "address",
      header: "Address",
      render: (s) => s.address || "—",
    },
    {
      key: "date",
      header: "Created",
      render: (s) => s.createdAt?.slice(0, 10) ?? "—",
    },
  ];

  return (
    <>
      <DataList<Supplier>
        title="All Suppliers"
        endpoint="/suppliers"
        columns={columns}
        rowKey={(s) => s.id}
        searchPlaceholder="Search suppliers…"
        emptyMessage="No suppliers yet. Click Add Supplier to get started."
        emptySearchMessage="No suppliers match your search."
        onRowClick={(s) => navigate(`/suppliers/${s.id}`)}
        headerActions={
          can("inventory:write") ? (
            <AddButton label="Add Supplier" onClick={() => setFormOpen(true)} />
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
