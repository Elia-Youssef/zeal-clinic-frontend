"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { type Column } from "@/components/data-table";
import { DataList } from "@/components/data-list";
import { AddButton } from "@/components/add-button";
import { Badge } from "@/components/ui/badge";
import type { Procedure } from "@/lib/types";
import { ProcedureForm } from "@/components/forms/procedure-form";
import { usePermissions } from "@/hooks/use-permissions";

export default function ProceduresPage() {
  const router = useRouter();
  const { can } = usePermissions();
  const [formOpen, setFormOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const columns: Column<Procedure>[] = [
    {
      key: "name",
      header: "Name",
      render: (p) => <span className="font-medium">{p.name}</span>,
    },
    { key: "type", header: "Type", render: (p) => p.type?.name || "—" },
    {
      key: "category",
      header: "Category",
      render: (p) => {
        if (!p.category?.name) return "—";
        const parts: string[] = [];
        let cat: typeof p.category | undefined = p.category;
        while (cat) {
          parts.unshift(cat.name);
          cat = cat.parent;
        }
        return <Badge variant="outline">{parts.join(" > ")}</Badge>;
      },
    },
    {
      key: "price",
      header: "Price",
      className: "text-right",
      render: (p) => (
        <span className="font-medium">
          {p.price != null
            ? `$${p.price}${p.priceNote ? ` (${p.priceNote})` : ""}`
            : "—"}
        </span>
      ),
    },
  ];

  return (
    <>
      <DataList<Procedure>
        title="Procedures"
        endpoint="/procedures"
        columns={columns}
        rowKey={(p) => p.id}
        searchPlaceholder="Search procedures…"
        emptyMessage="No procedures yet."
        emptySearchMessage="No procedures match your search."
        onRowClick={(p) => router.push(`/services/procedures/${p.id}`)}
        headerActions={
          can("services:write") ? (
            <AddButton
              label="Add Procedure"
              onClick={() => setFormOpen(true)}
            />
          ) : undefined
        }
        refreshKey={refreshKey}
      />

      <ProcedureForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />
    </>
  );
}
