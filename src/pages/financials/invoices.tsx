import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { type Column } from "@/components/data/data-table";
import { DataList } from "@/components/data/data-list";
import { AddButton } from "@/components/shared/add-button";
import { Tabs } from "@/components/shared/tabs";
import type { Invoice } from "@/lib/types";
import { beirutDayKey } from "@/lib/tz";
import { ClientInvoiceForm } from "@/components/forms/client-invoice-form";
import { SupplierInvoiceForm } from "@/components/forms/supplier-invoice-form";
import { usePermissions } from "@/hooks/use-permissions";
import { transactionColors } from "@/lib/constants";

const entityTabs = ["Patient", "Supplier"];

export default function InvoicesPage() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const [entityTab, setEntityTab] = useState(entityTabs[0]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [clientInvoiceOpen, setClientInvoiceOpen] = useState(false);
  const [supplierInvoiceOpen, setSupplierInvoiceOpen] = useState(false);

  const handleSaved = () => setRefreshKey((k) => k + 1);

  const entityEndpointKey = (entity: string) =>
    entity.toLowerCase() as "patient" | "supplier";

  const invoiceRowClick = (i: Invoice) => {
    navigate(`/financials/invoices/${i.id}`);
  };

  const invoiceColumns: Column<Invoice>[] = [
    {
      key: "number",
      header: "Invoice No.",
      className: "w-28",
      sortable: true,
      sortKey: "invoiceNumber",
      render: (i) => <span className="font-medium">#{i.invoiceNumber}</span>,
    },
    {
      key: "date",
      header: "Date",
      className: "w-36",
      render: (i) => beirutDayKey(i.createdAt) || "---",
    },
    {
      key: "entity",
      header: "Entity",
      className: "truncate",
      render: (i) => (
        <span className="font-medium">
          {entityTab == "Supplier" ? i.fromEntityName : i.toEntityName}
        </span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      sortable: true,
      sortKey: "amount",
      className: "w-40 text-right",
      render: (i) => (
        <span
          className={`font-medium ${entityTab == "Patient" ? transactionColors.inflow : transactionColors.outflow}`}
        >
          ${i.amount.toFixed(2)}
        </span>
      ),
    },
  ];

  return (
    <>
      <DataList<Invoice>
        resetKey={entityTab}
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
          can("invoices:write") ? (
            entityTab === "Patient" ? (
              can("patients:read") ? (
                <AddButton
                  label="New"
                  onClick={() => setClientInvoiceOpen(true)}
                />
              ) : undefined
            ) : entityTab === "Supplier" ? (
              can("suppliers:read") ? (
                <AddButton
                  label="New"
                  onClick={() => setSupplierInvoiceOpen(true)}
                />
              ) : undefined
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
