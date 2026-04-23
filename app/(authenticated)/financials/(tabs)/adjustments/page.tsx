"use client";

import { useState } from "react";
import { type Column } from "@/components/data-table";
import { DataList } from "@/components/data-list";
import { AddButton } from "@/components/add-button";
import { Badge } from "@/components/ui/badge";
import type { Transaction } from "@/lib/types";
import { BalanceAdjustmentForm } from "@/components/forms/balance-adjustment-form";
import { usePermissions } from "@/hooks/use-permissions";

export default function AdjustmentsPage() {
  const { can } = usePermissions();
  const [refreshKey, setRefreshKey] = useState(0);
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [writeOffOpen, setWriteOffOpen] = useState(false);

  const handleSaved = () => setRefreshKey((k) => k + 1);

  return (
    <>
      <DataList<Transaction>
        title="Balance Adjustments & Write-Offs"
        endpoint="/transactions?transactionType=adjustment,write-off"
        columns={[
          {
            key: "from",
            header: "From",
            render: (t: Transaction) => t.fromEntityName,
          },
          {
            key: "to",
            header: "To",
            render: (t: Transaction) => t.toEntityName,
          },
          {
            key: "amount",
            header: "Amount",
            className: "text-right",
            render: (t: Transaction) => <span className="font-medium">${t.amount.toFixed(2)}</span>,
          },
          {
            key: "type",
            header: "Type",
            render: (t: Transaction) => (
              <Badge variant="outline" className="capitalize">
                {t.transactionType ?? "—"}
              </Badge>
            ),
          },
          {
            key: "description",
            header: "Description",
            render: (t: Transaction) => t.description || "—",
          },
          {
            key: "date",
            header: "Date",
            render: (t: Transaction) => t.createdAt?.slice(0, 10) ?? "—",
          },
        ]}
        rowKey={(t) => t.id}
        headerActions={
          can("transactions:write") ? (
            <div className="flex gap-2">
              <AddButton label="Adjustment" onClick={() => setAdjustmentOpen(true)} />
              <AddButton label="Write-Off" onClick={() => setWriteOffOpen(true)} />
            </div>
          ) : undefined
        }
        refreshKey={refreshKey}
      />

      <BalanceAdjustmentForm
        open={adjustmentOpen}
        onClose={() => setAdjustmentOpen(false)}
        onSaved={handleSaved}
        mode="adjustment"
      />
      <BalanceAdjustmentForm
        open={writeOffOpen}
        onClose={() => setWriteOffOpen(false)}
        onSaved={handleSaved}
        mode="write-off"
      />
    </>
  );
}
