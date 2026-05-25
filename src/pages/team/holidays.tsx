import { useState } from "react";
import { Trash2 } from "lucide-react";
import { usePageTitle } from "@/hooks/use-page-title";
import { DataList } from "@/components/data/data-list";
import { AddButton } from "@/components/shared/add-button";
import { type Column, type RowAction } from "@/components/data/data-table";
import type { Holiday } from "@/lib/types";
import { HolidayForm } from "@/components/forms/holiday-form";
import { usePermissions } from "@/hooks/use-permissions";
import { useConfirm } from "@/hooks/use-confirm";
import { useAlertStore } from "@/lib/stores/alert-store";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import { beirutDayKey } from "@/lib/tz";

function HolidaysContent() {
  const { can } = usePermissions();
  const confirm = useConfirm();
  const addAlert = useAlertStore((s) => s.addAlert);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Holiday | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = () => setRefreshKey((k) => k + 1);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (h: Holiday) => {
    setEditing(h);
    setFormOpen(true);
  };

  const fmtRange = (h: Holiday) => {
    const start = beirutDayKey(h.startDate);
    const end = beirutDayKey(h.endDate);
    if (!start) return "---";
    if (!end || start === end) return start;
    return `${start} → ${end}`;
  };

  const handleDelete = async (h: Holiday) => {
    if (
      !(await confirm({
        title: "Delete holiday?",
        description: `Delete ${h.name}? Employees will no longer be marked off across ${fmtRange(h)}.`,
        confirmText: "Delete",
      }))
    ) {
      return;
    }
    try {
      await api.del(`/holidays/${h.id}`);
      addAlert("success", "Holiday deleted.");
      refresh();
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    }
  };

  const columns: Column<Holiday>[] = [
    {
      key: "name",
      header: "Name",
      className: "w-75",
      sortable: true,
      sortKey: "name",
      render: (h) => <span className="font-medium">{h.name}</span>,
    },
    {
      key: "dates",
      header: "Dates",
      className: "w-50",
      render: (h) => fmtRange(h),
    },
    {
      key: "notes",
      header: "Notes",
      className: "truncate",
      render: (h) => (
        <span className="text-muted-foreground">{h.notes || "---"}</span>
      ),
    },
  ];

  const actions: RowAction<Holiday>[] = can("hr:delete")
    ? [
        {
          label: "Delete",
          icon: <Trash2 className="size-3.5" />,
          destructive: true,
          onClick: handleDelete,
        },
      ]
    : [];

  return (
    <>
      <DataList<Holiday>
        title="Holidays"
        endpoint="/holidays"
        columns={columns}
        rowKey={(h) => h.id}
        emptyMessage="No holidays yet."
        emptySearchMessage="No holidays match your search."
        onRowClick={can("hr:write") ? openEdit : undefined}
        actions={actions}
        headerActions={
          can("hr:write") ? (
            <AddButton label="New" onClick={openCreate} />
          ) : undefined
        }
        refreshKey={refreshKey}
      />

      <HolidayForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={refresh}
        initial={editing}
      />
    </>
  );
}

export default function HolidaysPage() {
  usePageTitle("Holidays");
  return <HolidaysContent />;
}
