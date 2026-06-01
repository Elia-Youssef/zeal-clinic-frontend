import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loading } from "@/components/shared/loading";
import { PageHeader } from "@/components/shared/page-header";
import { DetailField } from "@/components/shared/detail-field";
import { MultilineText } from "@/components/shared/multiline-text";
import { DataList } from "@/components/data/data-list";
import { PaymentActionsMenu } from "@/components/shared/payment-actions-menu";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import { beirutDayKey } from "@/lib/tz";
import { useSuppliersStore } from "@/lib/stores/suppliers-store";
import { useAlertStore } from "@/lib/stores/alert-store";
import { transactionColors, adjustmentRowTint } from "@/lib/constants";
import type { Invoice, BalanceTransaction } from "@/lib/types";
import { SupplierForm } from "@/components/forms/supplier-form";
import { SupplierInvoiceForm } from "@/components/forms/supplier-invoice-form";
import { SupplierPaymentForm } from "@/components/forms/supplier-payment-form";
import { BalanceAdjustmentForm } from "@/components/forms/balance-adjustment-form";
import { usePermissions } from "@/hooks/use-permissions";
import { usePageTitle } from "@/hooks/use-page-title";
import { useConfirm } from "@/hooks/use-confirm";

function TagList({ values }: { values: string | null | undefined }) {
  const items = (values ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (items.length === 0) {
    return <p className="text-sm text-foreground">---</p>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item, idx) => (
        <Badge key={`${item}-${idx}`} variant="secondary">
          {item}
        </Badge>
      ))}
    </div>
  );
}

function SupplierDetailContent() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const addAlert = useAlertStore((s) => s.addAlert);
  const { can } = usePermissions();
  const confirm = useConfirm();

  const supplier = useSuppliersStore((s) => s.current);
  const balance = useSuppliersStore((s) => s.currentBalance);
  const loading = useSuppliersStore((s) => s.detailLoading);
  const fetchDetail = useSuppliersStore((s) => s.fetchDetail);
  const fetchBalance = useSuppliersStore((s) => s.fetchBalance);
  const setCurrent = useSuppliersStore((s) => s.setCurrent);

  const [editOpen, setEditOpen] = useState(false);
  const [invoiceFormOpen, setInvoiceFormOpen] = useState(false);
  const [paymentFormOpen, setPaymentFormOpen] = useState(false);
  const [adjustmentFormOpen, setAdjustmentFormOpen] = useState(false);
  const [writeOffFormOpen, setWriteOffFormOpen] = useState(false);
  const [invoicesKey, setInvoicesKey] = useState(0);
  const [paymentsKey, setPaymentsKey] = useState(0);

  const reloadDetails = () => fetchDetail(id);
  const bumpInvoices = () => {
    setInvoicesKey((k) => k + 1);
    fetchBalance(id);
  };
  const bumpPayments = () => {
    setPaymentsKey((k) => k + 1);
    fetchBalance(id);
  };

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

  const balanceAmount = balance?.amount ?? 0;

  return (
    <div className="space-y-4">
      <PageHeader
        backHref="/suppliers"
        title={supplier.name}
        onEdit={can("suppliers:write") ? () => setEditOpen(true) : undefined}
        onDelete={can("suppliers:delete") ? handleDelete : undefined}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 sm:gap-x-8 gap-y-3 text-sm">
          <DetailField label="Emails">
            <TagList values={supplier.email} />
          </DetailField>
          <DetailField label="Contacts">
            <TagList values={supplier.contact} />
          </DetailField>
          <DetailField label="Address">{supplier.address || "---"}</DetailField>
          <DetailField label="Notes" className="sm:col-span-2 md:col-span-3">
            <MultilineText value={supplier.notes} />
          </DetailField>
        </CardContent>
      </Card>

      {(can("invoices:read") || can("payments:read")) && (
        <div className="flex flex-col gap-4 lg:flex-row">
          <DataList<Invoice>
            className="flex-1"
            title="Invoices"
            columns={[
              {
                header: "Invoice No.",
                key: "Invoice No.",
                render: (i) => `#${i.invoiceNumber}`,
              },
              {
                header: "Date",
                key: "date",
                render: (i) => beirutDayKey(i.createdAt) || "---",
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
              can("invoices:write") && (
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

          <Card className="flex-1 gap-0">
            {balance && (
              <CardHeader className="pb-4 border-b">
                <CardTitle>
                  <div className="flex items-center justify-between gap-4 font-semibold">
                    <p>
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
                    <p className="text-sm font-normal text-muted-foreground">
                      In:{" "}
                      <span className={transactionColors.inflow}>
                        ${(balance.totalOut ?? 0).toFixed(2)}
                      </span>
                      {"  "}· Out:{" "}
                      <span className={transactionColors.outflow}>
                        ${(balance.totalIn ?? 0).toFixed(2)}
                      </span>
                    </p>
                  </div>
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
                  render: (i) => beirutDayKey(i.createdAt) || "---",
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
                        {isAdj ? i.transactionType : i.transactionMethod || "---"}
                      </Badge>
                    );
                  },
                },
                {
                  header: "Description",
                  key: "description",
                  render: (i) => (
                    <span className="text-muted-foreground truncate">
                      {i.description || "---"}
                    </span>
                  ),
                },
                {
                  header: "Amount",
                  key: "amount",
                  render: (i) => {
                    const isInflow = i.fromBalanceId === balance?.id;
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
                  ? adjustmentRowTint
                  : undefined
              }
              endpoint={`/suppliers/${id}/payments`}
              rowKey={(i) => i.id}
              actions={
                can("payments:delete")
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
                can("payments:write") && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      className="gap-1"
                      onClick={() => setPaymentFormOpen(true)}
                    >
                      <Plus className="size-3.5" />
                    </Button>
                    <PaymentActionsMenu
                      actions={[
                        {
                          label: "Adjustment",
                          onClick: () => setAdjustmentFormOpen(true),
                        },
                        {
                          label: "Write-Off",
                          onClick: () => setWriteOffFormOpen(true),
                        },
                      ]}
                    />
                  </div>
                )
              }
            />
          </Card>
        </div>
      )}

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
        defaultSupplierId={id}
        defaultSupplierLabel={supplier.name}
      />
      <SupplierPaymentForm
        open={paymentFormOpen}
        onClose={() => setPaymentFormOpen(false)}
        onSaved={bumpPayments}
        defaultSupplierId={id}
        defaultSupplierLabel={supplier.name}
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
