"use client";

import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loading } from "@/components/shared/loading";
import { PageHeader } from "@/components/shared/page-header";
import { DetailField } from "@/components/shared/detail-field";
import { DataList } from "@/components/data/data-list";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import { useAlertStore } from "@/lib/stores/alert-store";
import type {
  Procedure,
  ProcedureSession,
  ProcedureAllergyConflict,
  PatientProcedure,
} from "@/lib/types";
import { ProcedureForm } from "@/components/forms/procedure-form";
import { ProcedureSessionForm } from "@/components/forms/procedure-session-form";
import { ProcedureAllergyConflictForm } from "@/components/forms/procedure-allergy-conflict-form";
import { usePermissions } from "@/hooks/use-permissions";
import { usePageTitle } from "@/hooks/use-page-title";

/* ------------------------------------------------------------------ */
/*  Page content                                                       */
/* ------------------------------------------------------------------ */

function ProcedureDetailContent() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const addAlert = useAlertStore((s) => s.addAlert);
  const { can } = usePermissions();

  const [procedure, setProcedure] = useState<Procedure | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  /* Modals */
  const [editOpen, setEditOpen] = useState(false);
  const [sessionFormOpen, setSessionFormOpen] = useState(false);
  const [conflictFormOpen, setConflictFormOpen] = useState(false);

  const load = async () => {
    try {
      const proc = await api.get<Procedure>(`/procedures/${id}`);
      setProcedure(proc);
    } catch {
      addAlert("error", "Failed to load procedure.");
    } finally {
      setLoading(false);
    }
  };

  const reload = () => {
    load();
    setRefreshKey((k) => k + 1);
  };

  useEffect(() => {
    load();
  }, [id]);

  const handleDelete = async () => {
    if (!procedure || !confirm(`Delete procedure "${procedure.name}"?`)) return;
    try {
      await api.del(`/procedures/${id}`);
      addAlert("success", "Procedure deleted.");
      navigate("/services");
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await api.del(`/procedures/${id}/sessions/${sessionId}`);
      addAlert("success", "Session removed.");
      setRefreshKey((k) => k + 1);
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    }
  };

  const handleRemoveConflict = async (conflictId: string) => {
    try {
      await api.del(`/procedure-allergy-conflicts/${conflictId}`);
      addAlert("success", "Conflict removed.");
      setRefreshKey((k) => k + 1);
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    }
  };

  if (loading) return <Loading />;
  if (!procedure)
    return (
      <p className="py-12 text-center text-muted-foreground">
        Procedure not found.
      </p>
    );

  const categoryPath = (() => {
    if (!procedure.category?.name) return "—";
    const parts: string[] = [];
    let cat: typeof procedure.category | undefined = procedure.category;
    while (cat) {
      parts.unshift(cat.name);
      cat = cat.parent;
    }
    return parts.join(" > ");
  })();

  return (
    <div className="space-y-4">
      {/* Header */}
      <PageHeader
        backHref="/services"
        title={procedure.name}
        badges={
          <>
            <Badge variant={procedure.isActive ? "default" : "outline"}>
              {procedure.isActive ? "Active" : "Inactive"}
            </Badge>
            {procedure.category?.name && (
              <Badge variant="outline">{categoryPath}</Badge>
            )}
          </>
        }
        onEdit={can("services:write") ? () => setEditOpen(true) : undefined}
        onDelete={can("services:delete") ? handleDelete : undefined}
      />

      {/* Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <DetailField label="Type">{procedure.type?.name || "—"}</DetailField>
          <DetailField label="Price">
            <p>
              {procedure.price != null ? procedure.price : "—"}
              {procedure.priceNote && (
                <span className="ml-1 text-muted-foreground">
                  ({procedure.priceNote})
                </span>
              )}
            </p>
          </DetailField>
          <DetailField label="Category">{categoryPath}</DetailField>
          {procedure.includes && procedure.includes !== "[]" && (
            <DetailField label="Includes" className="col-span-2">
              {(() => {
                try {
                  return (JSON.parse(procedure.includes) as string[]).join(
                    ", ",
                  );
                } catch {
                  return procedure.includes;
                }
              })()}
            </DetailField>
          )}
          {procedure.remarks && (
            <DetailField label="Remarks" className="col-span-2">
              {procedure.remarks}
            </DetailField>
          )}
        </CardContent>
      </Card>

      {/* Sessions & Allergy Conflicts */}
      <div className="flex flex-row gap-4">
        <DataList<ProcedureSession>
          className="flex-1"
          title="Sessions"
          columns={[
            {
              header: "#",
              key: "sessionNumber",
              render: (i) => `#${i.sessionNumber}`,
            },
            {
              header: "Name",
              key: "name",
              render: (i) => i.name,
            },
            {
              header: "Description",
              key: "description",
              render: (i) => i.description ?? "—",
            },
            {
              header: "Price",
              key: "price",
              render: (i) => i.price,
            },
          ]}
          actions={
            can("services:delete")
              ? [
                  {
                    label: "Delete",
                    icon: <Trash2 className="size-3.5" />,
                    destructive: true,
                    onClick: (i) => handleDeleteSession(i.id),
                  },
                ]
              : []
          }
          endpoint={`/procedures/${id}/sessions`}
          rowKey={(i) => i.id}
          limit={5}
          hideSearch
          refreshKey={refreshKey}
          emptyMessage="No sessions defined."
          headerActions={
            can("services:write") && (
              <Button
                size="sm"
                className="gap-1"
                onClick={() => setSessionFormOpen(true)}
              >
                <Plus className="size-3.5" />
              </Button>
            )
          }
        />

        <DataList<ProcedureAllergyConflict>
          className="flex-1"
          title="Allergy Conflicts"
          columns={[
            {
              header: "Allergy",
              key: "allergy",
              render: (i) => i.allergyName ?? i.allergyId,
            },
            {
              header: "Notes",
              key: "notes",
              render: (i) => i.notes ?? "—",
            },
          ]}
          actions={
            can("services:delete")
              ? [
                  {
                    label: "Delete",
                    icon: <Trash2 className="size-3.5" />,
                    destructive: true,
                    onClick: (i) => handleRemoveConflict(i.id),
                  },
                ]
              : []
          }
          endpoint={`/procedures/${id}/allergy-conflicts`}
          rowKey={(i) => i.id}
          limit={5}
          hideSearch
          refreshKey={refreshKey}
          emptyMessage="No allergy conflicts."
          headerActions={
            can("services:write") && (
              <Button
                size="sm"
                className="gap-1"
                onClick={() => setConflictFormOpen(true)}
              >
                <Plus className="size-3.5" />
              </Button>
            )
          }
        />
      </div>

      {/* Patient Procedures */}
      <DataList<PatientProcedure>
        title="Patient Procedures"
        columns={[
          {
            header: "Patient",
            key: "patient",
            render: (i) => i.patientName ?? "—",
          },
          {
            header: "Status",
            key: "status",
            render: (i) => (
              <Badge
                variant={
                  i.status === "completed"
                    ? "default"
                    : i.status === "cancelled"
                      ? "destructive"
                      : "outline"
                }
              >
                {(i.status ?? "").replace("_", " ")}
              </Badge>
            ),
          },
          {
            header: "Notes",
            key: "notes",
            render: (i) => i.notes ?? "—",
          },
          {
            header: "Date",
            key: "createdAt",
            render: (i) => i.createdAt?.slice(0, 10) ?? "—",
          },
        ]}
        endpoint={`/procedures/${id}/patient-procedures`}
        rowKey={(i) => i.id}
        limit={5}
        hideSearch
        refreshKey={refreshKey}
        emptyMessage="No patient procedures."
        onRowClick={
          can("patients:read")
            ? (i) => i.patientId && navigate(`/patients/${i.patientId}`)
            : undefined
        }
      />

      {/* Edit modal */}
      <ProcedureForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={reload}
        initial={procedure}
      />

      {/* Add session modal */}
      <ProcedureSessionForm
        open={sessionFormOpen}
        onClose={() => setSessionFormOpen(false)}
        onSaved={reload}
        procedureId={id}
      />

      {/* Add conflict modal */}
      <ProcedureAllergyConflictForm
        open={conflictFormOpen}
        onClose={() => setConflictFormOpen(false)}
        onSaved={reload}
        procedureId={id}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page export                                                        */
/* ------------------------------------------------------------------ */

export default function ProcedureDetailPage() {
  usePageTitle("Procedure");
  return <ProcedureDetailContent />;
}
