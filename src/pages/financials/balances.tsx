"use client";

import { useState } from "react";
import { type Column } from "@/components/data/data-table";
import { DataList } from "@/components/data/data-list";
import { Tabs } from "@/components/shared/tabs";
import type { Balance } from "@/lib/types";

const entityTabs = ["Patient", "Supplier"];

export default function BalancesPage() {
  const [entityTab, setEntityTab] = useState(entityTabs[0]);
  const [refreshKey, setRefreshKey] = useState(0);

  const entityEndpointKey = (entity: string) =>
    entity.toLowerCase() as "patient" | "supplier";

  const getTextColor = (amount: number | undefined) => {
    let color = "text-gray-600 dark:text-gray-300";
    let green = "text-green-900 dark:text-green-300";
    let red = "text-red-900 dark:text-red-300";

    if (!amount) return color;
    if (amount < 0) {
      color = entityTab === "Patient" ? green : red;
    } else if (amount > 0) {
      color = entityTab === "Patient" ? red : green;
    }

    return color;
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
            : "—"}
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
