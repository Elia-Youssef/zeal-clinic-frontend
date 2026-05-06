import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Gift } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/shared/loading";
import { PageHeader } from "@/components/shared/page-header";
import { DetailField } from "@/components/shared/detail-field";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import { useAlertStore } from "@/lib/stores/alert-store";
import type { Discount, Patient } from "@/lib/types";
import { DiscountForm } from "@/components/forms/discount-form";
import { GiftRedeemForm } from "@/components/forms/gift-redeem-form";
import { usePermissions } from "@/hooks/use-permissions";
import { usePageTitle } from "@/hooks/use-page-title";
import { useConfirm } from "@/hooks/use-confirm";

function DiscountDetailContent() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const addAlert = useAlertStore((s) => s.addAlert);
  const { can } = usePermissions();
  const confirm = useConfirm();

  const [discount, setDiscount] = useState<Discount | null>(null);
  const [recipient, setRecipient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [redeemOpen, setRedeemOpen] = useState(false);

  const load = async () => {
    try {
      const d = await api.get<Discount>(`/discounts/${id}`);
      setDiscount(d);
      if (d.patientId) {
        try {
          const p = await api.get<Patient>(`/patients/${d.patientId}`);
          setRecipient(p);
        } catch {
          setRecipient(null);
        }
      } else {
        setRecipient(null);
      }
    } catch {
      addAlert("error", "Failed to load discount.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const handleDelete = async () => {
    if (!discount) return;
    if (
      !(await confirm({
        title: "Delete discount?",
        description: `Delete discount "${discount.name}"?`,
        confirmText: "Delete",
      }))
    ) {
      return;
    }
    try {
      await api.del(`/discounts/${id}`);
      addAlert("success", "Discount deleted.");
      navigate("/financials/discounts");
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    }
  };

  if (loading) return <Loading />;
  if (!discount)
    return (
      <p className="py-12 text-center text-muted-foreground">
        Discount not found.
      </p>
    );

  const isGift = discount.discountType === "gift";
  const isRedeemable =
    isGift && !!discount.code && !discount.redeemedAt && !!discount.isActive;
  const valueDisplay =
    discount.valueType === "percentage"
      ? `${discount.value}%`
      : `$${discount.value.toFixed(2)}`;
  const recipientName = recipient
    ? [recipient.firstName, recipient.middleName, recipient.lastName]
        .filter(Boolean)
        .join(" ")
    : null;

  return (
    <div className="space-y-4">
      <PageHeader
        backHref="/financials/discounts"
        title={discount.name}
        onEdit={can("services:write") ? () => setEditOpen(true) : undefined}
        onDelete={can("services:delete") ? handleDelete : undefined}
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold">Details</CardTitle>
          {isRedeemable && can("transactions:write") && (
            <Button
              size="sm"
              className="gap-1"
              onClick={() => setRedeemOpen(true)}
            >
              <Gift className="size-3.5" /> Redeem
            </Button>
          )}
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-x-8 gap-y-3 text-sm">
          <DetailField label="Type" className="capitalize">
            {discount.discountType}
          </DetailField>
          <DetailField label="Value">
            {valueDisplay}
            <span className="ml-1 text-muted-foreground capitalize">
              ({discount.valueType})
            </span>
          </DetailField>
          <DetailField label="Status">
            {discount.isActive ? "Active" : "Inactive"}
          </DetailField>

          {isGift && (
            <>
              <DetailField label="Code">
                {discount.code ? (
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                    {discount.code}
                  </code>
                ) : (
                  "---"
                )}
              </DetailField>
              <DetailField label="Recipient">
                {discount.patientId ? (
                  can("patients:read") ? (
                    <Link
                      to={`/patients/${discount.patientId}`}
                      className="font-medium capitalize hover:underline"
                    >
                      {recipientName ?? "View patient"}
                    </Link>
                  ) : (
                    recipientName ?? "---"
                  )
                ) : (
                  "---"
                )}
              </DetailField>
              <DetailField label="Redeemed">
                {discount.redeemedAt
                  ? discount.redeemedAt.slice(0, 10)
                  : "Not yet"}
              </DetailField>
            </>
          )}

          <DetailField label="Start Date">
            {discount.startDate?.slice(0, 10) ?? "---"}
          </DetailField>
          <DetailField label="End Date">
            {discount.endDate?.slice(0, 10) ?? "---"}
          </DetailField>
          <DetailField label="Created">
            {discount.createdAt?.slice(0, 10) ?? "---"}
          </DetailField>
          <DetailField label="Description" className="col-span-3">
            {discount.description || "---"}
          </DetailField>
        </CardContent>
      </Card>

      <DiscountForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={load}
        initial={discount}
      />
      <GiftRedeemForm
        open={redeemOpen}
        onClose={() => setRedeemOpen(false)}
        onRedeemed={load}
        prefilledCode={discount.code ?? ""}
        codeLocked
      />
    </div>
  );
}

export default function DiscountDetailPage() {
  usePageTitle("Discount");
  return <DiscountDetailContent />;
}
