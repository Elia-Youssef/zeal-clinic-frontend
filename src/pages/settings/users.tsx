
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DataList } from "@/components/data/data-list";
import { AddButton } from "@/components/shared/add-button";
import { type Column } from "@/components/data/data-table";
import { Badge } from "@/components/ui/badge";
import type { User } from "@/lib/types";
import { UserForm } from "@/components/forms/user-form";
import { usePermissions } from "@/hooks/use-permissions";

function UsersContent() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const [formOpen, setFormOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const columns: Column<User>[] = [
    {
      key: "username",
      header: "Username",
      render: (u) => <span className="font-medium">{u.username}</span>,
    },
    {
      key: "displayName",
      header: "Display Name",
      render: (u) => u.displayName,
    },
    {
      key: "role",
      header: "Role",
      className: "w-36",
      render: (u) => <Badge variant="outline">{u.role}</Badge>,
    },
    {
      key: "status",
      header: "Status",
      className: "w-30",
      render: (u) => (
        <Badge variant={u.isActive ? "default" : "secondary"}>
          {u.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
  ];

  return (
    <>
      <DataList<User>
        title="Users"
        endpoint="/users"
        columns={columns}
        rowKey={(u) => u.id}
        searchPlaceholder="Search users…"
        emptyMessage="No users yet."
        emptySearchMessage="No users match your search."
        onRowClick={(u) => navigate(`/settings/users/${u.id}`)}
        headerActions={
          can("team:write") ? (
            <AddButton label="Add User" onClick={() => setFormOpen(true)} />
          ) : undefined
        }
        refreshKey={refreshKey}
      />

      <UserForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />
    </>
  );
}

export default function UsersPage() {
  return <UsersContent />;
}
