import { useState } from "react";
import { Pencil } from "lucide-react";
import { type Column, type RowAction } from "@/components/data/data-table";
import { DataList } from "@/components/data/data-list";
import { AddButton } from "@/components/shared/add-button";
import type { Currency } from "@/lib/types";
import { CurrencyForm } from "@/components/forms/currency-form";
import { usePermissions } from "@/hooks/use-permissions";

export default function CurrenciesPage() {
  const { can } = usePermissions();
  const [refreshKey, setRefreshKey] = useState(0);
  const [curFormOpen, setCurFormOpen] = useState(false);
  const [editingCur, setEditingCur] = useState<Currency | undefined>();

  const handleSaved = () => setRefreshKey((k) => k + 1);

  const curColumns: Column<Currency>[] = [
    {
      key: "code",
      header: "Code",
      render: (c) => <span className="font-medium">{c.code}</span>,
    },
    { key: "name", header: "Name", render: (c) => c.name },
    { key: "symbol", header: "Symbol", render: (c) => c.symbol },
    {
      key: "exchangeRate",
      header: "Exchange Rate",
      render: (c) => c.exchangeRate,
    },
  ];

  const curActions: RowAction<Currency>[] = [
    ...(can("currencies:write")
      ? [
          {
            label: "Edit",
            icon: <Pencil className="size-3.5" />,
            onClick: (c: Currency) => {
              setEditingCur(c);
              setCurFormOpen(true);
            },
          },
        ]
      : []),
  ];

  return (
    <>
      <DataList<Currency>
        title="Currencies"
        endpoint="/currencies"
        columns={curColumns}
        actions={curActions}
        rowKey={(c) => c.id}
        headerActions={
          can("currencies:write") ? (
            <AddButton
              label="Add"
              onClick={() => {
                setEditingCur(undefined);
                setCurFormOpen(true);
              }}
            />
          ) : undefined
        }
        refreshKey={refreshKey}
      />
      <CurrencyForm
        key={editingCur?.id ?? "new-cur"}
        open={curFormOpen}
        onClose={() => setCurFormOpen(false)}
        onSaved={handleSaved}
        initial={editingCur}
      />
    </>
  );
}
