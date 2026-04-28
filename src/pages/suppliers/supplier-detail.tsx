
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
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
import { transactionColors } from "@/lib/constants";
import type { Invoice, BalanceTransaction } from "@/lib/types";
import { SupplierForm } from "@/components/forms/supplier-form";
import { SupplierInvoiceForm } from "@/components/forms/supplier-invoice-form";
import { SupplierPaymentForm } from "@/components/forms/supplier-payment-form";
import { BalanceAdjustmentForm } from "@/components/forms/balance-adjustment-form";
import { usePermissions } from "@/hooks/use-permissions";
import { usePageTitle } from "@/hooks/use-page-title";
import { useConfirm } from "@/hooks/use-confirm";

function SupplierDetailContent() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const addAlert = useAlertStore((s) => s.addAlert);
  const { can } = usePermissions();
  const confirm = useConfirm();

  const supplier = useSuppliersStore((s) => s.current);
  const loading = useSuppliersStore((s) => s.detailLoading);
  const fetchDetail = useSuppliersStore((s) => s.fetchDetail);
  const setCurrent = useSuppliersStore((s) => s.setCurrent);

  const [editOpen, setEditOpen] = useState(false);
  const [invoiceFormOpen, setInvoiceFormOpen] = useState(false);
  const [paymentFormOpen, setPaymentFormOpen] = useState(false);
  const [adjustmentFormOpen, setAdjustmentFormOpen] = useState(false);
  const [writeOffFormOpen, setWriteOffFormOpen] = useState(false);
  const [invoicesKey, setInvoicesKey] = useState(0);
  const [paymentsKey, setPaymentsKey] = useState(0);

  const reloadDetails = () => fetchDetail(id);
  const bumpInvoices = () => setInvoicesKey((k) => k + 1);
  const bumpPayments = () => setPaymentsKey((k) => k + 1);

  useEffect(() => {
    fetchDetail(id);
    return () => {
      setCurrent(null);
    };
  }, [id]);

  const handleDelete = async () => {
    if (!supplier) return;
    if (
      !(await confirm({
        title: "Delete supplier?",
        description: `Delete supplier ${supplier.name}?`,
        confirmText: "Delete",
      }))
    ) {
      return;
    }
    try {
      await api.del(`/suppliers/${id}`);
      addAlert("success", "Supplier deleted.");
      navigate("/suppliers");
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (
      !(await confirm({
        title: "Delete payment?",
        description: "Delete this payment?",
        confirmText: "Delete",
      }))
    ) {
      return;
    }
    try {
      await api.del(`/supplier-payments/${paymentId}`);
      addAlert("success", "Payment deleted.");
      bumpPayments();
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
      {can("transactions:read") && (
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
          refreshKey={invoicesKey}
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
                        ? transactionColors.neutral
                        : balanceAmount > 0
                          ? transactionColors.outflow
                          : transactionColors.inflow
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
                render: (i) => {
                  const isAdj =
                    i.transactionType === "adjustment" ||
                    i.transactionType === "write-off";
                  return (
                    <Badge
                      variant={isAdj ? "outline" : "secondary"}
                      className="capitalize"
                    >
                      {isAdj ? i.transactionType : i.transactionMethod || "—"}
                    </Badge>
                  );
                },
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
                render: (i) => {
                  const isInflow = i.fromBalanceId === supplier.balance?.id;
                  return (
                    <span
                      className={`text-right font-medium ${isInflow ? transactionColors.inflow : transactionColors.outflow}`}
                    >
                      {isInflow ? "+" : "-"}${i.amount.toFixed(2)}
                    </span>
                  );
                },
              },
            ]}
            rowClassName={(i) =>
              i.transactionType === "adjustment" ||
              i.transactionType === "write-off"
                ? "bg-amber-50 dark:bg-amber-950/30"
                : undefined
            }
            endpoint={`/suppliers/${id}/payments`}
            rowKey={(i) => i.id}
            actions={
              can("transactions:delete")
                ? [
                    {
                      label: "Delete",
                      icon: <Trash2 className="size-3.5" />,
                      destructive: true,
                      onClick: (i) => handleDeletePayment(i.id),
                    },
                  ]
                : []
            }
            limit={5}
            hideSearch
            refreshKey={paymentsKey}
            headerActions={
              can("transactions:write") && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setAdjustmentFormOpen(true)}
                  >
                    Adjustment
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setWriteOffFormOpen(true)}
                  >
                    Write-Off
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1"
                    onClick={() => setPaymentFormOpen(true)}
                  >
                    <Plus className="size-3.5" />
                  </Button>
                </div>
              )
            }
          />
        </Card>
      </div>
      )}

      {/* Modals */}
      <SupplierForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={reloadDetails}
        initial={supplier}
      />
      <SupplierInvoiceForm
        open={invoiceFormOpen}
        onClose={() => setInvoiceFormOpen(false)}
        onSaved={bumpInvoices}
      />
      <SupplierPaymentForm
        open={paymentFormOpen}
        onClose={() => setPaymentFormOpen(false)}
        onSaved={bumpPayments}
        supplierBalance={supplier.balance}
      />
      <BalanceAdjustmentForm
        open={adjustmentFormOpen}
        onClose={() => setAdjustmentFormOpen(false)}
        onSaved={bumpPayments}
        entityType="supplier"
        entityId={id}
        mode="adjustment"
        defaultDirection="outgoing"
      />
      <BalanceAdjustmentForm
        open={writeOffFormOpen}
        onClose={() => setWriteOffFormOpen(false)}
        onSaved={bumpPayments}
        entityType="supplier"
        entityId={id}
        mode="write-off"
        defaultDirection="outgoing"
      />
    </div>
  );
}

export default function SupplierDetailPage() {
  usePageTitle("Supplier");
  return <SupplierDetailContent />;
}
