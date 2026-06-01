import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { type Column } from "@/components/data/data-table";
import { DataList } from "@/components/data/data-list";
import { AddButton } from "@/components/shared/add-button";
import { ExpenseForm } from "@/components/forms/expense-form";
import { usePermissions } from "@/hooks/use-permissions";
import type { Expense } from "@/lib/types";
import { beirutDayKey } from "@/lib/tz";

export default function ExpensesPage() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const [formOpen, setFormOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const expenseColumns: Column<Expense>[] = [
    {
      key: "name",
      header: "Name",
      className: "w-70",
      sortable: true,
      sortKey: "name",
      render: (e) => <span className="font-medium">{e.name}</span>,
    },
    {
      key: "notes",
      header: "Notes",
      className: "truncate",
      sortable: true,
      sortKey: "notes",
      render: (e) => (
        <span className="text-muted-foreground">{e.notes || "---"}</span>
      ),
    },
    {
      key: "created",
      header: "Created",
      className: "w-36",
      render: (e) => beirutDayKey(e.createdAt) || "---",
    },
  ];

  const handleSaved = (expense: Expense) => {
    setRefreshKey((k) => k + 1);
  };

  return (
    <>
      <DataList<Expense>
        title="Expenses"
        endpoint="/expenses"
        dateFilter
        columns={expenseColumns}
        rowKey={(e) => e.id}
        onRowClick={(e) => navigate(`/financials/expenses/${e.id}`)}
        emptyMessage="No expenses yet."
        headerActions={
          can("expenses:write") ? (
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
