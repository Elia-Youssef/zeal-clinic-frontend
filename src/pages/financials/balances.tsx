
import { useState } from "react";
import { type Column } from "@/components/data/data-table";
import { DataList } from "@/components/data/data-list";
import { Tabs } from "@/components/shared/tabs";
import type { Balance } from "@/lib/types";
import { transactionColors } from "@/lib/constants";

const entityTabs = ["Patient", "Supplier"];

export default function BalancesPage() {
  const [entityTab, setEntityTab] = useState(entityTabs[0]);
  const [refreshKey, setRefreshKey] = useState(0);

  const entityEndpointKey = (entity: string) =>
    entity.toLowerCase() as "patient" | "supplier";

  const getTextColor = (amount: number | undefined) => {
    if (!amount) return transactionColors.neutral;
    if (amount < 0) {
      return entityTab === "Patient"
        ? transactionColors.inflow
        : transactionColors.outflow;
    }
    return entityTab === "Patient"
      ? transactionColors.outflow
      : transactionColors.inflow;
  };

  const balanceColumns: Column<Balance>[] = [
    {
      key: "entityName",
      header: "Name",
      render: (b) => <span className="font-medium">{b.entityName}</span>,
    },
    {
      key: "amount",
      header: "Amount",
      className: "text-right",
      render: (b) => (
        <span className={`font-medium ${getTextColor(b.amount)}`}>
          {b.amount != null
            ? `${b.amount < 0 ? "-" : ""}$${Math.abs(b.amount).toFixed(2)}`
            : "---"}
        </span>
      ),
    },
  ];

  return (
    <DataList<Balance>
      key={`balances-${entityTab}`}
      title={
        <Tabs tabs={entityTabs} activeTab={entityTab} onChange={setEntityTab} />
      }
      endpoint={`/balances/${entityEndpointKey(entityTab)}`}
      columns={balanceColumns}
      rowKey={(b) => b.id}
      refreshKey={refreshKey}
    />
  );
}
