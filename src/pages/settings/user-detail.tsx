import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loading } from "@/components/shared/loading";
import { PageHeader } from "@/components/shared/page-header";
import { DetailField } from "@/components/shared/detail-field";
import { DataList } from "@/components/data/data-list";
import { type Column } from "@/components/data/data-table";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import { beirutDayKey, formatInBeirut } from "@/lib/tz";
import { useUsersStore } from "@/lib/stores/users-store";
import { useAlertStore } from "@/lib/stores/alert-store";
import { usePageTitle } from "@/hooks/use-page-title";
import { UserForm } from "@/components/forms/user-form";
import { usePermissions } from "@/hooks/use-permissions";
import type { AuditLogEntry } from "@/lib/types";
import { auditActionStyles } from "@/lib/constants";

const actionColumns: Column<AuditLogEntry>[] = [
  {
    key: "time",
    header: "Time",
    className: "w-40",
    sortable: true,
    sortKey: "createdAt",
    render: (e) => (
      <span className="text-xs">
        {formatInBeirut(e.createdAt, "yyyy-MM-dd HH:mm:ss")}
      </span>
    ),
  },
  {
    key: "action",
    header: "Action",
    className: "w-28",
    sortable: true,
    sortKey: "action",
    render: (e) => (
      <Badge variant="outline" className={auditActionStyles[e.action]}>
        {e.action}
      </Badge>
    ),
  },
  {
    key: "entity",
    header: "Entity",
    className: "truncate",
    render: (e) => `${e.entityType} #${e.entityId.slice(0, 8)}`,
  },
];

function StaffDetailContent() {
  const { id = "" } = useParams<{ id: string }>();
  const addAlert = useAlertStore((s) => s.addAlert);
  const { can } = usePermissions();

  const user = useUsersStore((s) => s.current);
  const loading = useUsersStore((s) => s.detailLoading);
  const fetchDetail = useUsersStore((s) => s.fetchDetail);
  const setCurrent = useUsersStore((s) => s.setCurrent);

  const [editOpen, setEditOpen] = useState(false);

  const reload = () => fetchDetail(id);

  useEffect(() => {
    reload();
    return () => {
      setCurrent(null);
    };
  }, [id]);

  const handleToggleActive = async () => {
    if (!user) return;
    try {
      await api.put(`/users/${id}`, { isActive: !user.isActive });
      addAlert(
        "success",
        user.isActive ? "Staff member deactivated." : "Staff member activated.",
      );
      reload();
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    }
  };

  if (loading) return <Loading />;
  if (!user) {
    return (
      <p className="py-12 text-center text-muted-foreground">Staff member not found.</p>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        backHref="/settings/staff"
        title={user.displayName}
        onEdit={can("users:write") ? () => setEditOpen(true) : undefined}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 sm:gap-x-8 gap-y-3 text-sm">
          <DetailField label="Username">{user.username}</DetailField>
          <DetailField label="Display Name">{user.displayName}</DetailField>
          <DetailField label="Role">{user.role}</DetailField>
          <DetailField label="Status">
            <Badge
              variant={user.isActive ? "default" : "outline"}
              className={can("users:write") ? "cursor-pointer" : undefined}
              onClick={can("users:write") ? handleToggleActive : undefined}
            >
              {user.isActive ? "Active" : "Inactive"}
            </Badge>
          </DetailField>
          <DetailField label="Created">
            {beirutDayKey(user.createdAt) || "---"}
          </DetailField>
          <DetailField label="Updated">
            {beirutDayKey(user.updatedAt) || "---"}
          </DetailField>
        </CardContent>
      </Card>

      <DataList<AuditLogEntry>
        title="Actions"
        endpoint={`/users/${id}/actions`}
        columns={actionColumns}
        rowKey={(a) => a.id}
        limit={50}
        emptyMessage="No entries."
        emptySearchMessage="No entries match your search."
      />

      <UserForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={reload}
        initial={user}
      />
    </div>
  );
}

export default function StaffDetailPage() {
  usePageTitle("Staff");
  return <StaffDetailContent />;
}
