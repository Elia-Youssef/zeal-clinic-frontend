"use client";

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { type Column } from "@/components/data/data-table";
import { DataList } from "@/components/data/data-list";
import { AddButton } from "@/components/shared/add-button";
import { Badge } from "@/components/ui/badge";
import type { Discount } from "@/lib/types";
import { DiscountForm } from "@/components/forms/discount-form";
import { usePermissions } from "@/hooks/use-permissions";

export function DiscountsPanel() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const [formOpen, setFormOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const columns: Column<Discount>[] = [
    {
      key: "name",
      header: "Name",
      render: (d) => <span className="font-medium">{d.name}</span>,
    },
    {
      key: "discountType",
      header: "Type",
      render: (d) => (
        <Badge variant="outline" className="capitalize">
          {d.discountType}
        </Badge>
      ),
    },
    {
      key: "value",
      header: "Value",
      render: (d) =>
        d.valueType === "percentage" ? `${d.value}%` : `$${d.value.toFixed(2)}`,
    },
    {
      key: "usages",
      header: "Usages",
      render: (d) =>
        d.maxUsages != null
          ? `${d.currentUsages} / ${d.maxUsages}`
          : String(d.currentUsages),
    },
    {
      key: "dates",
      header: "Period",
      render: (d) => {
        const s = d.startDate?.slice(0, 10);
        const e = d.endDate?.slice(0, 10);
        if (!s && !e) return "—";
        return `${s ?? "…"} → ${e ?? "…"}`;
      },
    },
    {
      key: "isActive",
      header: "Status",
      render: (d) => (
        <Badge variant={d.isActive ? "default" : "outline"}>
          {d.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
  ];

  return (
    <>
      <DataList<Discount>
        title="Discounts"
        endpoint="/discounts"
        columns={columns}
        rowKey={(d) => d.id}
        searchPlaceholder="Search discounts…"
        emptyMessage="No discounts yet."
        emptySearchMessage="No discounts match your search."
        onRowClick={(d) => navigate(`/financials/discounts/${d.id}`)}
        headerActions={
          can("services:write") ? (
            <AddButton label="Add Discount" onClick={() => setFormOpen(true)} />
          ) : undefined
        }
        refreshKey={refreshKey}
      />

      <DiscountForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />
    </>
  );
}
