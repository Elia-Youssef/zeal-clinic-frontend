"use client";

import { type Column } from "@/components/data/data-table";
import { DataList } from "@/components/data/data-list";
import { Badge } from "@/components/ui/badge";
import type { AuditLogEntry } from "@/lib/types";

const actionColors: Record<string, string> = {
  POST: "bg-green-100 text-green-800",
  PUT: "bg-blue-100 text-blue-800",
  DELETE: "bg-red-100 text-red-800",
};

const columns: Column<AuditLogEntry>[] = [
  {
    key: "time",
    header: "Time",
    className: "w-40",
    render: (e) => (
      <span className="text-xs">
        {e.createdAt?.slice(0, 19).replace("T", " ")}
      </span>
    ),
  },
  {
    key: "user",
    header: "User",
    render: (e) => <span className="font-medium">{e.userName}</span>,
  },
  {
    key: "role",
    header: "Role",
    render: (e) => <Badge variant="outline">{e.userRole}</Badge>,
  },
  {
    key: "action",
    header: "Action",
    render: (e) => <Badge className={actionColors[e.action]}>{e.action}</Badge>,
  },
  {
    key: "entity",
    header: "Entity",
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
      searchPlaceholder="Search log…"
      emptyMessage="No entries."
      emptySearchMessage="No entries match your search."
      limit={50}
    />
  );
}
