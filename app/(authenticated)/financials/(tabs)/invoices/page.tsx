"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { type Column } from "@/components/data-table";
import { DataList } from "@/components/data-list";
import { AddButton } from "@/components/add-button";
import { Tabs } from "@/components/tabs";
import type { Invoice } from "@/lib/types";
import { ClientInvoiceForm } from "@/components/forms/client-invoice-form";
import { SupplierInvoiceForm } from "@/components/forms/supplier-invoice-form";
import { usePermissions } from "@/hooks/use-permissions";

const entityTabs = ["Patient", "Supplier"];

export default function InvoicesPage() {
  const router = useRouter();
  const { can } = usePermissions();
  const [entityTab, setEntityTab] = useState(entityTabs[0]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [clientInvoiceOpen, setClientInvoiceOpen] = useState(false);
  const [supplierInvoiceOpen, setSupplierInvoiceOpen] = useState(false);

  const handleSaved = () => setRefreshKey((k) => k + 1);

  const entityEndpointKey = (entity: string) =>
    entity.toLowerCase() as "patient" | "supplier";

  const invoiceRowClick = (i: Invoice) => {
    router.push(`/financials/invoices/${i.id}`);
  };

  const invoiceColumns: Column<Invoice>[] = [
    {
      key: "number",
      header: "#",
      className: "w-20",
      render: (i) => <span className="font-medium">#{i.invoiceNumber}</span>,
    },
    {
      key: "date",
      header: "Date",
      className: "w-35",
      render: (i) => i.createdAt?.slice(0, 10) ?? "—",
    },
    {
      key: "entity",
      header: "Entity",
      render: (i) => (
        <span className="font-medium">
          {entityTab == "Supplier" ? i.fromEntityName : i.toEntityName}
        </span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      className: "text-right",
      render: (i) => (
        <span
          className={`font-medium ${entityTab == "Patient" ? "text-green-900 dark:text-green-300" : "text-red-900 dark:text-red-300"}`}
        >
          ${i.amount.toFixed(2)}
        </span>
      ),
    },
  ];

  return (
    <>
      <DataList<Invoice>
        key={`invoices-${entityTab}`}
        title={
          <Tabs
            tabs={entityTabs}
            activeTab={entityTab}
            onChange={setEntityTab}
          />
        }
        endpoint={`/invoices?type=${entityEndpointKey(entityTab)}`}
        columns={invoiceColumns}
        rowKey={(i) => i.id}
        onRowClick={invoiceRowClick}
        headerActions={
          can("transactions:write") ? (
            entityTab === "Patient" ? (
              <AddButton
                label="New Invoice"
                onClick={() => setClientInvoiceOpen(true)}
              />
            ) : entityTab === "Supplier" ? (
              <AddButton
                label="New Invoice"
                onClick={() => setSupplierInvoiceOpen(true)}
              />
            ) : undefined
          ) : undefined
        }
        refreshKey={refreshKey}
      />

      <ClientInvoiceForm
        open={clientInvoiceOpen}
        onClose={() => setClientInvoiceOpen(false)}
        onSaved={handleSaved}
      />
      <SupplierInvoiceForm
        open={supplierInvoiceOpen}
        onClose={() => setSupplierInvoiceOpen(false)}
        onSaved={handleSaved}
      />
    </>
  );
}
