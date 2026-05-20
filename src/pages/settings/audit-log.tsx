import { type Column } from "@/components/data/data-table";
import { DataList } from "@/components/data/data-list";
import { Badge } from "@/components/ui/badge";
import type { AuditLogEntry } from "@/lib/types";
import { formatInBeirut } from "@/lib/tz";

const actionClasses: Record<string, string> = {
  POST: "bg-positive/10 text-positive border-positive/30",
  PUT: "bg-status-progress/15 text-status-progress border-status-progress/30",
  DELETE: "bg-destructive/10 text-destructive border-destructive/30",
};

const columns: Column<AuditLogEntry>[] = [
  {
    key: "time",
    header: "Time",
    className: "w-45",
    sortable: true,
    sortKey: "createdAt",
    render: (e) => (
      <span className="text-xs">
        {formatInBeirut(e.createdAt, "yyyy-MM-dd HH:mm:ss")}
      </span>
    ),
  },
  {
    key: "user",
    header: "Staff",
    className: "w-42",
    render: (e) => <span className="font-medium">{e.username}</span>,
  },
  {
    key: "role",
    header: "Role",
    className: "w-36",
    render: (e) => <Badge variant="outline">{e.userRole}</Badge>,
  },
  {
    key: "action",
    header: "Action",
    className: "w-32",
    sortable: true,
    sortKey: "action",
    render: (e) => (
      <Badge variant="outline" className={actionClasses[e.action]}>
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

export default function AuditLogPage() {
  return (
    <DataList<AuditLogEntry>
      title="Audit Log"
      endpoint="/audit-log"
      columns={columns}
      rowKey={(e) => e.id}
      emptyMessage="No entries."
      emptySearchMessage="No entries match your search."
      limit={50}
    />
  );
}
