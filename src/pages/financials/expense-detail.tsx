import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataList } from "@/components/data/data-list";
import { type Column } from "@/components/data/data-table";
import { AddButton } from "@/components/shared/add-button";
import { DetailField } from "@/components/shared/detail-field";
import { Loading } from "@/components/shared/loading";
import { PageHeader } from "@/components/shared/page-header";
import { PaymentActionsMenu } from "@/components/shared/payment-actions-menu";
import { ExpenseForm } from "@/components/forms/expense-form";
import { ExpensePaymentForm } from "@/components/forms/expense-payment-form";
import { BalanceAdjustmentForm } from "@/components/forms/balance-adjustment-form";
import { usePageTitle } from "@/hooks/use-page-title";
import { usePermissions } from "@/hooks/use-permissions";
import { useConfirm } from "@/hooks/use-confirm";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage } from "@/lib/utils";
import type { BalanceTransaction, Expense } from "@/lib/types";
import { transactionColors } from "@/lib/constants";

function formatMoney(amount: number | undefined) {
  if (amount == null) return "---";
  return `${amount < 0 ? "-" : ""}$${Math.abs(amount).toFixed(2)}`;
}

function ExpenseDetailContent() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const addAlert = useAlertStore((s) => s.addAlert);
  const { can } = usePermissions();
  const confirm = useConfirm();

  const [expense, setExpense] = useState<Expense | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [writeOffOpen, setWriteOffOpen] = useState(false);
  const [paymentsKey, setPaymentsKey] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const loaded = await api.get<Expense>(`/expenses/${id}`);
      setExpense(loaded);
    } catch {
      addAlert("error", "Failed to load expense.");
      setExpense(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const bumpPayments = () => setPaymentsKey((k) => k + 1);

  const handleDelete = async () => {
    if (!expense) return;
    if (
      !(await confirm({
        title: "Delete expense?",
        description: `Delete expense ${expense.name}?`,
        confirmText: "Delete",
      }))
    ) {
      return;
    }
    try {
      await api.del(`/expenses/${id}`);
      addAlert("success", "Expense deleted.");
      navigate("/financials/expenses");
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
      await api.del(`/expense-payments/${paymentId}`);
      addAlert("success", "Payment deleted.");
      bumpPayments();
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    }
  };

  const expenseName = expense?.name;
  const paymentColumns: Column<BalanceTransaction>[] = [
    {
      key: "date",
      header: "Date",
      className: "w-32",
      render: (t) => t.createdAt?.slice(0, 10) ?? "---",
    },
    {
      key: "method",
      header: "Method",
      className: "w-32",
      render: (t) => {
        const isAdj =
          t.transactionType === "adjustment" ||
          t.transactionType === "write-off";
        return (
          <Badge
            variant={isAdj ? "outline" : "secondary"}
            className="capitalize"
          >
            {isAdj ? t.transactionType : t.transactionMethod || "---"}
          </Badge>
        );
      },
    },
    {
      key: "description",
      header: "Description",
      render: (t) => (
        <span className="text-muted-foreground">{t.description || "---"}</span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      className: "w-32 text-right",
      render: (t) => {
        const isInflow = !!expenseName && t.fromEntityName === expenseName;
        return (
          <span
            className={`font-medium ${isInflow ? transactionColors.inflow : transactionColors.outflow}`}
          >
            {isInflow ? "+" : "-"}${Math.abs(t.amount).toFixed(2)}
          </span>
        );
      },
    },
  ];

  if (loading) return <Loading />;
  if (!expense) {
    return (
      <p className="py-12 text-center text-muted-foreground">
        Expense not found.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        backHref="/financials/expenses"
        title={expense.name}
        onEdit={can("transactions:write") ? () => setEditOpen(true) : undefined}
        onDelete={can("transactions:delete") ? handleDelete : undefined}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Expense Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm">
          <DetailField label="Created">
            {expense.createdAt?.slice(0, 10) ?? "---"}
          </DetailField>
          <DetailField label="Notes">{expense.notes || "---"}</DetailField>
        </CardContent>
      </Card>

      <DataList<BalanceTransaction>
        title="Payments"
        endpoint={`/expenses/${id}/payments`}
        columns={paymentColumns}
        rowKey={(t) => t.id}
        actions={
          can("transactions:delete")
            ? [
                {
                  label: "Delete",
                  icon: <Trash2 className="size-3.5" />,
                  destructive: true,
                  onClick: (t) => handleDeletePayment(t.id),
                },
              ]
            : []
        }
        limit={10}
        hideSearch
        emptyMessage="No payments recorded yet."
        refreshKey={paymentsKey}
        rowClassName={(t) =>
          t.transactionType === "adjustment" ||
          t.transactionType === "write-off"
            ? "bg-amber-50 dark:bg-amber-950/30"
            : undefined
        }
        headerActions={
          can("transactions:write") ? (
            <div className="flex items-center gap-2">
              <AddButton label="New" onClick={() => setPaymentOpen(true)} />
              <PaymentActionsMenu
                actions={[
                  {
                    label: "Adjustment",
                    onClick: () => setAdjustmentOpen(true),
                  },
                  {
                    label: "Write-Off",
                    onClick: () => setWriteOffOpen(true),
                  },
                ]}
              />
            </div>
          ) : undefined
        }
      />

      <ExpenseForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={load}
        initial={expense}
      />
      <ExpensePaymentForm
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        onSaved={bumpPayments}
        expenseId={expense.id}
      />
      <BalanceAdjustmentForm
        open={adjustmentOpen}
        onClose={() => setAdjustmentOpen(false)}
        onSaved={bumpPayments}
        entityType="expense"
        entityId={expense.id}
        mode="adjustment"
        defaultDirection="outgoing"
      />
      <BalanceAdjustmentForm
        open={writeOffOpen}
        onClose={() => setWriteOffOpen(false)}
        onSaved={bumpPayments}
        entityType="expense"
        entityId={expense.id}
        mode="write-off"
        defaultDirection="outgoing"
      />
    </div>
  );
}

export default function ExpenseDetailPage() {
  usePageTitle("Expense");
  return <ExpenseDetailContent />;
}
