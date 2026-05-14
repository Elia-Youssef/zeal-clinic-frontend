import { useNavigate } from "react-router-dom";
import { type Column } from "@/components/data/data-table";
import { DataList } from "@/components/data/data-list";
import type { Role } from "@/lib/types";

export default function RolesPage() {
  const navigate = useNavigate();

  const columns: Column<Role>[] = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      sortKey: "name",
      render: (r) => <span className="font-mono text-sm">{r.name}</span>,
    },
    {
      key: "label",
      header: "Label",
      sortable: true,
      sortKey: "label",
      render: (r) => <span className="font-medium">{r.label}</span>,
    },
    {
      key: "permissions",
      header: "Permissions",
      render: (r) => (
        <span className="text-xs text-muted-foreground">
          {r.scopes.length} permissions
        </span>
      ),
    },
  ];

  return (
    <DataList<Role>
      title="Roles"
      endpoint="/roles"
      columns={columns}
      rowKey={(r) => r.name}
      onRowClick={(r) => navigate(`/settings/roles/${r.name}`)}
      emptyMessage="No roles."
    />
  );
}
