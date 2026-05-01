import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { type Column } from "@/components/data/data-table";
import { DataList } from "@/components/data/data-list";
import { AddButton } from "@/components/shared/add-button";
import { Badge } from "@/components/ui/badge";
import type { Procedure } from "@/lib/types";
import { ProcedureForm } from "@/components/forms/procedure-form";
import { usePermissions } from "@/hooks/use-permissions";

export default function ProceduresPage() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const [formOpen, setFormOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const columns: Column<Procedure>[] = [
    {
      key: "type",
      header: "Type",
      className: "w-36",
      render: (p) => <Badge variant="secondary">{p.type?.name || "---"}</Badge>,
    },
    {
      key: "category",
      header: "Category",
      className: "w-48",
      render: (p) => {
        let cat = p.category?.name || "";
        let parentcat = p.category?.parent?.name || "";
        if (!cat && !parentcat) return "---";
        return (
          <div className="flex flex-row gap-1">
            {parentcat && <Badge variant="outline">{parentcat}</Badge>}
            {cat && <Badge variant="outline">{cat}</Badge>}
          </div>
        );
      },
    },
    {
      key: "name",
      header: "Name",
      render: (p) => <span className="font-medium">{p.name}</span>,
    },
    {
      key: "price",
      header: "Price",
      className: "text-right",
      render: (p) => (
        <span className="font-medium">
          {p.price ? <span>${p.price}</span> : null}
          {p.priceNote && p.price ? (
            <span className="text-muted-foreground">{" - "}</span>
          ) : null}
          {p.priceNote && (
            <span className="text-muted-foreground">{p.priceNote}</span>
          )}
          {!p.priceNote && !p.price ? (
            <span className="text-muted-foreground">---</span>
          ) : null}
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
        onRowClick={(p) => navigate(`/services/procedures/${p.id}`)}
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
