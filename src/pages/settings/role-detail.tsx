import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loading } from "@/components/shared/loading";
import { PageHeader } from "@/components/shared/page-header";
import { DetailField } from "@/components/shared/detail-field";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import { useAlertStore } from "@/lib/stores/alert-store";
import { usePageTitle } from "@/hooks/use-page-title";
import { usePermissions } from "@/hooks/use-permissions";
import { useAdjustOnChange } from "@/hooks/use-adjust-on-change";
import { useApiQuery } from "@/hooks/use-api-query";
import { ALL_SCOPES, scopeMatrix } from "@/lib/scopes";
import type { Role } from "@/lib/types";

const ACTIONS = ["read", "write", "delete"] as const;
type Action = (typeof ACTIONS)[number];

function humanize(resource: string) {
  return resource
    .split("-")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

function setsEqual(a: Set<string>, b: Set<string>) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

export default function RoleDetailPage() {
  usePageTitle("Role");
  const { name = "" } = useParams<{ name: string }>();
  const addAlert = useAlertStore((s) => s.addAlert);
  const { can } = usePermissions();

  const canWrite = can("roles:write");
  const matrix = useMemo(() => scopeMatrix(ALL_SCOPES), []);

  const {
    data: role,
    loading,
    reload,
  } = useApiQuery(
    () => api.get<Role>(`/roles/${name}`),
    [name],
    (err) => addAlert("error", getErrorMessage(err)),
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  // A loaded role seeds the selection (also what Reset returns to).
  useAdjustOnChange([role], () => setSelected(new Set(role?.scopes ?? [])));

  const toggleScope = (scope: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const idx = scope.lastIndexOf(":");
      const resource = scope.slice(0, idx);
      const action = scope.slice(idx + 1) as Action;

      if (next.has(scope)) {
        next.delete(scope);
        // Removing read also removes dependents.
        if (action === "read") {
          next.delete(`${resource}:write`);
          next.delete(`${resource}:delete`);
        }
      } else {
        next.add(scope);
      }
      return next;
    });
  };

  const toggleResourceAll = (resource: string, allowed: Action[]) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const allOn = allowed.every((a) => next.has(`${resource}:${a}`));
      for (const a of allowed) {
        const key = `${resource}:${a}`;
        if (allOn) next.delete(key);
        else next.add(key);
      }
      return next;
    });
  };

  const toggleColumn = (action: Action) => {
    setSelected((prev) => {
      const next = new Set(prev);
      // Write/delete needs read when read exists.
      const eligibleRows = matrix.filter((row) => {
        if (!row.actions.includes(action)) return false;
        if (action === "read") return true;
        if (!row.actions.includes("read")) return true;
        return next.has(`${row.resource}:read`);
      });
      const colScopes = eligibleRows.map(
        (row) => `${row.resource}:${action}`,
      );
      const allOn =
        colScopes.length > 0 && colScopes.every((s) => next.has(s));
      for (const s of colScopes) {
        if (allOn) next.delete(s);
        else next.add(s);
      }
      // Turning read off cascades to write/delete.
      if (action === "read" && allOn) {
        for (const row of eligibleRows) {
          next.delete(`${row.resource}:write`);
          next.delete(`${row.resource}:delete`);
        }
      }
      return next;
    });
  };

  const dirty = useMemo(() => {
    if (!role) return false;
    return !setsEqual(selected, new Set(role.scopes));
  }, [role, selected]);

  const handleSave = async () => {
    if (!role) return;
    setSubmitting(true);
    try {
      await api.put(`/roles/${role.name}`, {
        scopes: Array.from(selected).sort(),
      });
      addAlert("success", "Role updated.");
      reload();
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    if (!role) return;
    setSelected(new Set(role.scopes));
  };

  if (loading) return <Loading />;
  if (!role) {
    return (
      <p className="py-12 text-center text-muted-foreground">Role not found.</p>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader backHref="/settings/roles" title={role.label || role.name} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 sm:gap-x-8 gap-y-3 text-sm">
          <DetailField label="Name">
            <span className="font-mono">{role.name}</span>
          </DetailField>
          <DetailField label="Label">{role.label}</DetailField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center gap-2">
          <CardTitle className="min-w-0 flex-1 basis-40 text-base font-semibold">
            Permissions
          </CardTitle>
          <span className="ml-auto text-right text-xs text-muted-foreground">
            {selected.size} of {ALL_SCOPES.length} selected
          </span>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-125 text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Resource</th>
                  {ACTIONS.map((a) => (
                    <th
                      key={a}
                      className="px-3 py-2 font-medium w-24 text-center"
                    >
                      {canWrite ? (
                        <button
                          type="button"
                          onClick={() => toggleColumn(a)}
                          className="capitalize hover:text-foreground transition-colors"
                          title={`Toggle all ${a}`}
                        >
                          {a}
                        </button>
                      ) : (
                        <span className="capitalize">{a}</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.map(({ resource, actions: allowed }) => {
                  const allOn = allowed.every((a) =>
                    selected.has(`${resource}:${a}`),
                  );
                  const hasRead = allowed.includes("read");
                  const readOn = !hasRead || selected.has(`${resource}:read`);
                  return (
                    <tr key={resource} className="border-t hover:bg-muted/65">
                      <td className="px-3 py-1.5">
                        {canWrite ? (
                          <button
                            type="button"
                            onClick={() => toggleResourceAll(resource, allowed)}
                            className={`text-left hover:text-foreground transition-colors ${
                              allOn ? "font-medium" : ""
                            }`}
                            title="Toggle all actions for this resource"
                          >
                            {humanize(resource)}
                          </button>
                        ) : (
                          <span className={allOn ? "font-medium" : ""}>
                            {humanize(resource)}
                          </span>
                        )}
                      </td>
                      {ACTIONS.map((a) => {
                        const scope = `${resource}:${a}`;
                        const exists = allowed.includes(a);
                        const checked = selected.has(scope);
                        const lockedByRead = a !== "read" && !readOn;
                        const disabled =
                          !canWrite || (exists && lockedByRead);
                        return (
                          <td key={a} className="px-3 py-1.5 align-middle">
                            <div className="flex justify-center">
                              {exists ? (
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={() =>
                                    canWrite &&
                                    !lockedByRead &&
                                    toggleScope(scope)
                                  }
                                  disabled={disabled}
                                />
                              ) : (
                                <span className="text-muted-foreground/40">
                                  —
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {canWrite && (
            <p className="mt-2 text-xs text-muted-foreground">
              Click a column header or resource name to toggle that row/column.
            </p>
          )}
        </CardContent>
      </Card>

      {canWrite && (
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={!dirty || submitting}
          >
            Reset
          </Button>
          <Button onClick={handleSave} disabled={!dirty || submitting}>
            {submitting ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      )}
    </div>
  );
}
