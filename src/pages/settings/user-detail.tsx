"use client";

import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loading } from "@/components/shared/loading";
import { PageHeader } from "@/components/shared/page-header";
import { DetailField } from "@/components/shared/detail-field";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import { useUsersStore } from "@/lib/stores/users-store";
import { useAlertStore } from "@/lib/stores/alert-store";
import { usePageTitle } from "@/hooks/use-page-title";
import { UserForm } from "@/components/forms/user-form";

function UserDetailContent() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const addAlert = useAlertStore((s) => s.addAlert);

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

  const handleDelete = async () => {
    if (!user || !confirm(`Delete user ${user.username}?`)) return;
    try {
      await api.del(`/users/${id}`);
      addAlert("success", "User deleted.");
      navigate("/settings/users");
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    }
  };

  const handleToggleActive = async () => {
    if (!user) return;
    try {
      await api.put(`/users/${id}`, { isActive: !user.isActive });
      addAlert("success", user.isActive ? "User deactivated." : "User activated.");
      reload();
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    }
  };

  if (loading) return <Loading />;
  if (!user) {
    return (
      <p className="py-12 text-center text-muted-foreground">User not found.</p>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        backHref="/settings/users"
        title={user.displayName}
        badges={
          <>
            <Badge variant="outline">{user.role}</Badge>
            <Badge variant={user.isActive ? "default" : "secondary"}>
              {user.isActive ? "Active" : "Inactive"}
            </Badge>
          </>
        }
        onEdit={() => setEditOpen(true)}
        onDelete={handleDelete}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <DetailField label="Username">{user.username}</DetailField>
          <DetailField label="Display Name">{user.displayName}</DetailField>
          <DetailField label="Role">{user.role}</DetailField>
          <DetailField label="Status">
            <Badge
              variant={user.isActive ? "default" : "secondary"}
              className="cursor-pointer"
              onClick={handleToggleActive}
            >
              {user.isActive ? "Active" : "Inactive"}
            </Badge>
          </DetailField>
          <DetailField label="Created">
            {user.createdAt?.slice(0, 10) ?? "---"}
          </DetailField>
          <DetailField label="Updated">
            {user.updatedAt?.slice(0, 10) ?? "---"}
          </DetailField>
        </CardContent>
      </Card>

      <UserForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={reload}
        initial={user}
      />
    </div>
  );
}

export default function UserDetailPage() {
  usePageTitle("User");
  return <UserDetailContent />;
}
