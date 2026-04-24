"use client";

import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loading } from "@/components/shared/loading";
import { PageHeader } from "@/components/shared/page-header";
import { DetailField } from "@/components/shared/detail-field";
import { DataList } from "@/components/data/data-list";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import { useSuppliersStore } from "@/lib/stores/suppliers-store";
import { useAlertStore } from "@/lib/stores/alert-store";
import type { Invoice, BalanceTransaction } from "@/lib/types";
import { SupplierForm } from "@/components/forms/supplier-form";
import { SupplierInvoiceForm } from "@/components/forms/supplier-invoice-form";
import { SupplierPaymentForm } from "@/components/forms/supplier-payment-form";
import { usePermissions } from "@/hooks/use-permissions";
import { usePageTitle } from "@/hooks/use-page-title";

function SupplierDetailContent() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const addAlert = useAlertStore((s) => s.addAlert);
  const { can } = usePermissions();

  const supplier = useSuppliersStore((s) => s.current);
  const loading = useSuppliersStore((s) => s.detailLoading);
  const fetchDetail = useSuppliersStore((s) => s.fetchDetail);
  const setCurrent = useSuppliersStore((s) => s.setCurrent);

  const [editOpen, setEditOpen] = useState(false);
  const [invoiceFormOpen, setInvoiceFormOpen] = useState(false);
  const [paymentFormOpen, setPaymentFormOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const reload = () => {
    fetchDetail(id);
    setRefreshKey((k) => k + 1);
  };

  useEffect(() => {
    fetchDetail(id);
    return () => {
      setCurrent(null);
    };
  }, [id]);

  const handleDelete = async () => {
    if (!supplier || !confirm(`Delete supplier ${supplier.name}?`)) return;
    try {
      await api.del(`/suppliers/${id}`);
      addAlert("success", "Supplier deleted.");
      navigate("/suppliers");
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    }
  };

  if (loading) return <Loading />;
  if (!supplier)
    return (
      <p className="py-12 text-center text-muted-foreground">
        Supplier not found.
      </p>
    );

  const balanceAmount = supplier.balance?.amount ?? 0;

  return (
    <div className="space-y-4">
      <PageHeader
        backHref="/suppliers"
        title={supplier.name}
        onEdit={can("inventory:write") ? () => setEditOpen(true) : undefined}
        onDelete={can("inventory:delete") ? handleDelete : undefined}
      />

      {/* Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Supplier Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-x-8 gap-y-2 text-sm">
          <DetailField label="Email">{supplier.email || "—"}</DetailField>
          <DetailField label="Contact">{supplier.contact || "—"}</DetailField>
          <DetailField label="Address">{supplier.address || "—"}</DetailField>
          <DetailField label="Notes" className="col-span-3">
            {supplier.notes || "---"}
          </DetailField>
        </CardContent>
      </Card>

      {/* Invoices & Payments */}
      <div className="flex flex-row gap-4">
        <DataList<Invoice>
          className="flex-1"
          title="Invoices"
          columns={[
            {
              header: "#",
              key: "#",
              render: (i) => `#${i.invoiceNumber}`,
            },
            {
              header: "Date",
              key: "date",
              render: (i) => i.createdAt?.slice(0, 10) ?? "—",
            },
            {
              header: "Amount",
              key: "amount",
              render: (i) => `$${i.amount.toFixed(2)}`,
            },
          ]}
          endpoint={`/suppliers/${id}/invoices`}
          rowKey={(i) => i.id}
          limit={5}
          hideSearch
          refreshKey={refreshKey}
          onRowClick={(i) => navigate(`/financials/invoices/${i.id}`)}
          headerActions={
            can("transactions:write") && (
              <Button
                size="sm"
                className="gap-1"
                onClick={() => setInvoiceFormOpen(true)}
              >
                <Plus className="size-3.5" />
              </Button>
            )
          }
        />

        {/* Payments (with balance header) */}
        <Card className="flex-1 gap-0">
          {supplier.balance && (
            <CardHeader className="pb-4 border-b">
              <CardTitle>
                <p className="font-semibold">
                  Balance:{" "}
                  <span
                    className={
                      balanceAmount === 0
                        ? "text-gray-600 dark:text-gray-400"
                        : balanceAmount > 0
                          ? "text-red-600 dark:text-red-400"
                          : "text-green-600 dark:text-green-400"
                    }
                  >
                    {balanceAmount < 0 ? "-" : ""}$
                    {Math.abs(balanceAmount).toFixed(2)}
                  </span>
                </p>
              </CardTitle>
            </CardHeader>
          )}
          <DataList<BalanceTransaction>
            className="ring-0"
            title="Payments"
            columns={[
              {
                header: "Date",
                key: "date",
                render: (i) => i.createdAt?.slice(0, 10) ?? "—",
              },
              {
                header: "Method",
                key: "method",
                render: (i) => (
                  <Badge variant="secondary" className="capitalize">
                    {i.transactionMethod || "—"}
                  </Badge>
                ),
              },
              {
                header: "Description",
                key: "description",
                render: (i) => (
                  <span className="text-muted-foreground truncate">
                    {i.description || "—"}
                  </span>
                ),
              },
              {
                header: "Amount",
                key: "amount",
                render: (i) => (
                  <span className="text-right font-medium text-red-500">
                    -${i.amount.toFixed(2)}
                  </span>
                ),
              },
            ]}
            endpoint={`/suppliers/${id}/payments`}
            rowKey={(i) => i.id}
            limit={5}
            hideSearch
            refreshKey={refreshKey}
            headerActions={
              can("transactions:write") && (
                <Button
                  size="sm"
                  className="gap-1"
                  onClick={() => setPaymentFormOpen(true)}
                >
                  <Plus className="size-3.5" />
                </Button>
              )
            }
          />
        </Card>
      </div>

      {/* Modals */}
      <SupplierForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={reload}
        initial={supplier}
      />
      <SupplierInvoiceForm
        open={invoiceFormOpen}
        onClose={() => setInvoiceFormOpen(false)}
        onSaved={reload}
      />
      <SupplierPaymentForm
        open={paymentFormOpen}
        onClose={() => setPaymentFormOpen(false)}
        onSaved={reload}
        supplierBalance={supplier.balance}
      />
    </div>
  );
}

export default function SupplierDetailPage() {
  usePageTitle("Supplier");
  return <SupplierDetailContent />;
}
