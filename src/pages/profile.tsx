import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loading } from "@/components/shared/loading";
import { DetailField } from "@/components/shared/detail-field";
import { EmployeeDetailView } from "@/components/shared/employee-detail-view";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/stores/auth-store";
import { usePageTitle } from "@/hooks/use-page-title";
import type { User } from "@/lib/types";

// Account-only self view (no linked employee record): a trimmed read-only card.
function AccountProfile() {
  const authName = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const userId = useAuthStore((s) => s.userId);

  const [account, setAccount] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (userId) {
          const data = await api.get<User>(`/users/${userId}`);
          if (!cancelled) setAccount(data);
        }
      } catch {
        // Non-403 failures fall back to the auth-store identity below.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading) return <Loading />;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 sm:gap-x-8 gap-y-3 text-sm">
          <DetailField label="Name">
            {account?.displayName || authName || "---"}
          </DetailField>
          <DetailField label="Role">{role || "---"}</DetailField>
          {account && (
            <>
              <DetailField label="Username">{account.username}</DetailField>
              <DetailField label="Status">
                <Badge variant={account.isActive ? "default" : "outline"}>
                  {account.isActive ? "Active" : "Inactive"}
                </Badge>
              </DetailField>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ProfilePage() {
  usePageTitle("My Profile");
  const employeeId = useAuthStore((s) => s.employeeId);

  if (employeeId) {
    return <EmployeeDetailView employeeId={employeeId} readOnly />;
  }
  return <AccountProfile />;
}
