import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Gift } from "lucide-react";
import { type Column } from "@/components/data/data-table";
import { DataList } from "@/components/data/data-list";
import { AddButton } from "@/components/shared/add-button";
import { Tabs } from "@/components/shared/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Discount } from "@/lib/types";
import { beirutDayKey } from "@/lib/tz";
import { formatMoney } from "@/lib/utils";
import { DiscountForm } from "@/components/forms/discount-form";
import { GiftRedeemForm } from "@/components/forms/gift-redeem-form";
import { usePermissions } from "@/hooks/use-permissions";

const typeTabs = ["All", "Offers", "Gifts"];
const typeParams: Record<string, string> = { Offers: "offer", Gifts: "gift" };

export default function DiscountsPage() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const [typeTab, setTypeTab] = useState(typeTabs[0]);
  const [formOpen, setFormOpen] = useState(false);
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const type = typeParams[typeTab] ?? "";

  const columns: Column<Discount>[] = [
    {
      key: "name",
      header: "Name",
      className: "truncate",
      sortable: true,
      sortKey: "name",
      render: (d) => <span className="font-medium">{d.name}</span>,
    },
    {
      key: "discountType",
      header: "Type",
      className: "w-28",
      render: (d) => (
        <Badge variant="outline" className="capitalize">
          {d.discountType}
        </Badge>
      ),
    },
    {
      key: "value",
      header: "Value",
      className: "w-32",
      render: (d) =>
        d.valueType === "percentage" ? `${d.value}%` : formatMoney(d.value),
    },
    {
      key: "code",
      header: "Code",
      className: "w-40",
      render: (d) =>
        d.code ? (
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
            {d.code}
          </code>
        ) : (
          <span className="text-muted-foreground">---</span>
        ),
    },
    {
      key: "dates",
      header: "Period",
      className: "w-65",
      render: (d) => {
        const s = beirutDayKey(d.startDate);
        const e = beirutDayKey(d.endDate);
        if (!s && !e) return "---";
        return `${s || "---"} → ${e || "---"}`;
      },
    },
    {
      key: "isActive",
      header: "Status",
      className: "w-30",
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
        resetKey={typeTab}
        title={
          <Tabs tabs={typeTabs} activeTab={typeTab} onChange={setTypeTab} />
        }
        endpoint={`/discounts${type ? `?type=${type}` : ""}`}
        columns={columns}
        rowKey={(d) => d.id}
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
              <AddButton label="New" onClick={() => setFormOpen(true)} />
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
