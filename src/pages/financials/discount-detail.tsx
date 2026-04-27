"use client";

import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Trash2, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loading } from "@/components/shared/loading";
import { PageHeader } from "@/components/shared/page-header";
import { DetailField } from "@/components/shared/detail-field";
import { DataTable, type Column, type RowAction } from "@/components/data/data-table";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import { useAlertStore } from "@/lib/stores/alert-store";
import type { Discount, DiscountItem, Voucher } from "@/lib/types";
import { DiscountForm } from "@/components/forms/discount-form";
import { DiscountItemForm } from "@/components/forms/discount-item-form";
import { DiscountVoucherForm } from "@/components/forms/discount-voucher-form";
import { usePermissions } from "@/hooks/use-permissions";
import { usePageTitle } from "@/hooks/use-page-title";

function DiscountDetailContent() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const addAlert = useAlertStore((s) => s.addAlert);
  const { can } = usePermissions();

  const [discount, setDiscount] = useState<Discount | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [itemFormOpen, setItemFormOpen] = useState(false);
  const [voucherFormOpen, setVoucherFormOpen] = useState(false);

  const load = async () => {
    try {
      const d = await api.get<Discount>(`/discounts/${id}`);
      setDiscount(d);
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
    if (!discount || !confirm(`Delete discount "${discount.name}"?`)) return;
    try {
      await api.del(`/discounts/${id}`);
      addAlert("success", "Discount deleted.");
      navigate("/financials/discounts");
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    try {
      await api.del(`/discounts/${id}/items/${itemId}`);
      addAlert("success", "Item removed.");
      load();
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    }
  };

  const handleUseVoucher = async (voucherId: string) => {
    try {
      await api.put(`/discounts/${id}/vouchers/${voucherId}/use`);
      addAlert("success", "Voucher marked as used.");
      load();
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    }
  };

  const handleDeleteVoucher = async (voucherId: string) => {
    try {
      await api.del(`/discounts/${id}/vouchers/${voucherId}`);
      addAlert("success", "Voucher deleted.");
      load();
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

  const itemColumns: Column<DiscountItem>[] = [
    {
      key: "type",
      header: "Type",
      render: (i) => (
        <Badge variant="outline" className="capitalize">
          {i.itemType}
        </Badge>
      ),
    },
    {
      key: "name",
      header: "Name",
      render: (i) => i.itemName ?? i.itemId.slice(0, 8),
    },
    {
      key: "created",
      header: "Added",
      render: (i) => i.createdAt?.slice(0, 10) ?? "—",
    },
  ];

  const itemActions: RowAction<DiscountItem>[] = can("services:delete")
    ? [
        {
          label: "Remove",
          icon: <Trash2 className="size-3.5" />,
          destructive: true,
          onClick: (i) => handleRemoveItem(i.id),
        },
      ]
    : [];

  const voucherColumns: Column<Voucher>[] = [
    {
      key: "code",
      header: "Code",
      render: (v) => (
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
          {v.code}
        </code>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (v) => (
        <Badge variant={v.isUsed ? "outline" : "default"}>
          {v.isUsed ? "Used" : "Available"}
        </Badge>
      ),
    },
    {
      key: "created",
      header: "Created",
      render: (v) => v.createdAt?.slice(0, 10) ?? "—",
    },
  ];

  const voucherActions: RowAction<Voucher>[] = [
    ...(can("services:write")
      ? [{
          label: "Mark as used",
          icon: <Check className="size-3.5" />,
          onClick: (v: Voucher) => handleUseVoucher(v.id),
          hidden: (v: Voucher) => !!v.isUsed,
        }]
      : []),
    ...(can("services:delete")
      ? [{
          label: "Delete",
          icon: <Trash2 className="size-3.5" />,
          destructive: true,
          onClick: (v: Voucher) => handleDeleteVoucher(v.id),
        }]
      : []),
  ];

  const valueDisplay =
    discount.valueType === "percentage"
      ? `${discount.value}%`
      : `$${discount.value.toFixed(2)}`;

  return (
    <div className="space-y-4">
      <PageHeader
        backHref="/financials/discounts"
        title={discount.name}
        badges={
          <>
            <Badge variant="outline" className="capitalize">
              {discount.discountType}
            </Badge>
            <Badge variant={discount.isActive ? "default" : "outline"}>
              {discount.isActive ? "Active" : "Inactive"}
            </Badge>
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
        <CardContent className="grid grid-cols-3 gap-x-8 gap-y-2 text-sm">
          <DetailField label="Value">
            {valueDisplay}
            <span className="ml-1 text-muted-foreground capitalize">
              ({discount.valueType})
            </span>
          </DetailField>
          <DetailField label="Usages">
            {discount.currentUsages}
            {discount.maxUsages != null ? ` / ${discount.maxUsages}` : ""}
          </DetailField>
          <DetailField label="Type" className="capitalize">
            {discount.discountType}
          </DetailField>
          <DetailField label="Start Date">
            {discount.startDate?.slice(0, 10) ?? "—"}
          </DetailField>
          <DetailField label="End Date">
            {discount.endDate?.slice(0, 10) ?? "—"}
          </DetailField>
          <DetailField label="Status">
            {discount.isActive ? "Active" : "Inactive"}
          </DetailField>
          <DetailField label="Created">
            {discount.createdAt?.slice(0, 10) ?? "—"}
          </DetailField>
          <DetailField label="Updated">
            {discount.updatedAt?.slice(0, 10) ?? "—"}
          </DetailField>
          <DetailField label="Description" className="col-span-3">
            {discount.description || "—"}
          </DetailField>
        </CardContent>
      </Card>

      {/* Linked Items */}
      <Card className="gap-4">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Linked Items</CardTitle>
          {can("services:write") && (
            <Button
              size="sm"
              className="gap-1"
              onClick={() => setItemFormOpen(true)}
            >
              <Plus className="size-3.5" />
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {!discount.items || discount.items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No items linked.
            </p>
          ) : (
            <DataTable
              columns={itemColumns}
              actions={itemActions}
              data={discount.items}
              rowKey={(i) => i.id}
            />
          )}
        </CardContent>
      </Card>

      {/* Vouchers */}
      <Card className="gap-4">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Vouchers</CardTitle>
          {can("services:write") && (
            <Button
              size="sm"
              className="gap-1"
              onClick={() => setVoucherFormOpen(true)}
            >
              <Plus className="size-3.5" />
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {!discount.vouchers || discount.vouchers.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No vouchers.
            </p>
          ) : (
            <DataTable
              columns={voucherColumns}
              actions={voucherActions}
              data={discount.vouchers}
              rowKey={(v) => v.id}
            />
          )}
        </CardContent>
      </Card>

      <DiscountForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={load}
        initial={discount}
      />
      <DiscountItemForm
        open={itemFormOpen}
        onClose={() => setItemFormOpen(false)}
        onSaved={load}
        discountId={id}
      />
      <DiscountVoucherForm
        open={voucherFormOpen}
        onClose={() => setVoucherFormOpen(false)}
        onSaved={load}
        discountId={id}
      />
    </div>
  );
}

export default function DiscountDetailPage() {
  usePageTitle("Discount");
  return <DiscountDetailContent />;
}
