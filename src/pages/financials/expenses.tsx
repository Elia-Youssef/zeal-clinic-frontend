
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { type Column } from "@/components/data/data-table";
import { DataList } from "@/components/data/data-list";
import { AddButton } from "@/components/shared/add-button";
import { ExpenseForm } from "@/components/forms/expense-form";
import { usePermissions } from "@/hooks/use-permissions";
import type { Expense } from "@/lib/types";

export default function ExpensesPage() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const [formOpen, setFormOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const expenseColumns: Column<Expense>[] = [
    {
      key: "name",
      header: "Name",
      render: (e) => <span className="font-medium">{e.name}</span>,
    },
    {
      key: "notes",
      header: "Notes",
      render: (e) => (
        <span className="text-muted-foreground">{e.notes || "---"}</span>
      ),
    },
    {
      key: "created",
      header: "Created",
      className: "w-32",
      render: (e) => e.createdAt?.slice(0, 10) ?? "---",
    },
  ];

  const handleSaved = (expense: Expense) => {
    setRefreshKey((k) => k + 1);
    navigate(`/financials/expenses/${expense.id}`);
  };

  return (
    <>
      <DataList<Expense>
        title="Expenses"
        endpoint="/expenses"
        columns={expenseColumns}
        rowKey={(e) => e.id}
        onRowClick={(e) => navigate(`/financials/expenses/${e.id}`)}
        searchPlaceholder="Search expenses..."
        emptyMessage="No expenses yet."
        headerActions={
          can("transactions:write") ? (
            <AddButton label="New" onClick={() => setFormOpen(true)} />
          ) : undefined
        }
        refreshKey={refreshKey}
      />

      <ExpenseForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
      />
    </>
  );
}
