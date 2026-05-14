import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Gift } from "lucide-react";
import { type Column } from "@/components/data/data-table";
import { DataList } from "@/components/data/data-list";
import { AddButton } from "@/components/shared/add-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Discount } from "@/lib/types";
import { DiscountForm } from "@/components/forms/discount-form";
import { GiftRedeemForm } from "@/components/forms/gift-redeem-form";
import { usePermissions } from "@/hooks/use-permissions";

export default function DiscountsPage() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const [formOpen, setFormOpen] = useState(false);
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const columns: Column<Discount>[] = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      sortKey: "name",
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
      key: "code",
      header: "Code",
      render: (d) =>
        d.code ? (
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
            {d.code}
          </code>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "dates",
      header: "Period",
      render: (d) => {
        const s = d.startDate?.slice(0, 10);
        const e = d.endDate?.slice(0, 10);
        if (!s && !e) return "---";
        return `${s ?? "…"} → ${e ?? "…"}`;
      },
    },
    {
      key: "isActive",
      header: "Status",
      sortable: true,
      sortKey: "isActive",
      render: (d) => {
        if (d.discountType === "gift" && d.redeemedAt) {
          return <Badge variant="outline">Redeemed</Badge>;
        }
        return (
          <Badge variant={d.isActive ? "default" : "outline"}>
            {d.isActive ? "Active" : "Inactive"}
          </Badge>
        );
      },
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
          <div className="flex gap-2">
            {can("discounts:write") && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => setRedeemOpen(true)}
              >
                <Gift className="size-3.5" /> Redeem Gift
              </Button>
            )}
            {can("discounts:write") && (
              <AddButton label="Add Offer" onClick={() => setFormOpen(true)} />
            )}
          </div>
        }
        refreshKey={refreshKey}
      />

      <DiscountForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />
      <GiftRedeemForm
        open={redeemOpen}
        onClose={() => setRedeemOpen(false)}
        onRedeemed={() => setRefreshKey((k) => k + 1)}
      />
    </>
  );
}
