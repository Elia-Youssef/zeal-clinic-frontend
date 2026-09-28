import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Gift } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/shared/loading";
import { PageHeader } from "@/components/shared/page-header";
import { DetailField } from "@/components/shared/detail-field";
import { DataList } from "@/components/data/data-list";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import { beirutDayKey } from "@/lib/tz";
import { useAlertStore } from "@/lib/stores/alert-store";
import type { Discount, Invoice, Patient } from "@/lib/types";
import { DiscountForm } from "@/components/forms/discount-form";
import { GiftRedeemForm } from "@/components/forms/gift-redeem-form";
import { usePermissions } from "@/hooks/use-permissions";
import { usePageTitle } from "@/hooks/use-page-title";
import { useConfirm } from "@/hooks/use-confirm";
import { useApiQuery } from "@/hooks/use-api-query";

function DiscountDetailContent() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const addAlert = useAlertStore((s) => s.addAlert);
  const { can } = usePermissions();
  const confirm = useConfirm();

  const {
    data: bundle,
    loading,
    reload,
  } = useApiQuery(
    async () => {
      const discount = await api.get<Discount>(`/discounts/${id}`);
      const recipient = discount.patientId
        ? await api
            .get<Patient>(`/patients/${discount.patientId}`)
            .catch(() => null)
        : null;
      return { discount, recipient };
    },
    [id],
    () => addAlert("error", "Failed to load discount."),
  );
  const discount = bundle?.discount ?? null;
  const recipient = bundle?.recipient ?? null;
  const [editOpen, setEditOpen] = useState(false);
  const [redeemOpen, setRedeemOpen] = useState(false);

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
        onEdit={can("discounts:write") ? () => setEditOpen(true) : undefined}
        onDelete={can("discounts:delete") ? handleDelete : undefined}
      />

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center gap-2">
          <CardTitle className="min-w-0 flex-1 basis-32 text-base font-semibold">
            Details
          </CardTitle>
          {isRedeemable && can("discounts:write") && (
            <Button
              size="sm"
              className="ml-auto gap-1"
              onClick={() => setRedeemOpen(true)}
            >
              <Gift className="size-3.5" /> Redeem
            </Button>
          )}
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 sm:gap-x-8 gap-y-3 text-sm">
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
                  ? beirutDayKey(discount.redeemedAt)
                  : "Not yet"}
              </DetailField>
            </>
          )}

          <DetailField label="Start Date">
            {beirutDayKey(discount.startDate) || "---"}
          </DetailField>
          <DetailField label="End Date">
            {beirutDayKey(discount.endDate) || "---"}
          </DetailField>
          <DetailField label="Created">
            {beirutDayKey(discount.createdAt) || "---"}
          </DetailField>
          <DetailField label="Description" className="sm:col-span-2 md:col-span-3">
            {discount.description || "---"}
          </DetailField>
        </CardContent>
      </Card>

      {/* Gift cards are applied to patient balances, never to invoices. */}
      {!isGift && can("invoices:read") && (
        <DataList<Invoice>
          title="Invoices"
          columns={[
            {
              header: "Invoice No.",
              key: "number",
              className: "w-28",
              render: (i) => (
                <span className="font-medium">#{i.invoiceNumber}</span>
              ),
            },
            {
              header: "Date",
              key: "date",
              className: "w-36",
              render: (i) => beirutDayKey(i.createdAt) || "---",
            },
            {
              header: "Entity",
              key: "entity",
              className: "truncate",
              render: (i) => (
                <span className="font-medium capitalize">
                  {(i.fromEntityId === "self"
                    ? i.toEntityName
                    : i.fromEntityName) || "---"}
                </span>
              ),
            },
            {
              header: "Amount",
              key: "amount",
              className: "w-32 text-right",
              render: (i) => `$${(i.amount ?? 0).toFixed(2)}`,
            },
            {
              header: "Discount",
              key: "discount",
              className: "w-32 text-right",
              render: (i) => `-$${(i.discountValue ?? 0).toFixed(2)}`,
            },
            {
              header: "Total",
              key: "total",
              className: "w-32 text-right",
              render: (i) => (
                <span className="font-medium">
                  ${(i.finalAmount ?? i.amount ?? 0).toFixed(2)}
                </span>
              ),
            },
          ]}
          endpoint={`/discounts/${id}/invoices`}
          rowKey={(i) => i.id}
          limit={5}
          hideSearch
          dateFilter
          onRowClick={(i) => navigate(`/financials/invoices/${i.id}`)}
          emptyMessage="No invoices."
        />
      )}

      <DiscountForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={() => reload({ quiet: true })}
        initial={discount}
      />
      <GiftRedeemForm
        open={redeemOpen}
        onClose={() => setRedeemOpen(false)}
        onRedeemed={() => reload({ quiet: true })}
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
