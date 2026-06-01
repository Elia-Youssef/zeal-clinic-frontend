import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Loading } from "@/components/shared/loading";
import { PageHeader } from "@/components/shared/page-header";
import { DetailField } from "@/components/shared/detail-field";
import { DataList } from "@/components/data/data-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import { beirutDayKey } from "@/lib/tz";
import { useAlertStore } from "@/lib/stores/alert-store";
import type {
  Invoice,
  Product,
  ProductAllergyConflict,
  ProductPrice,
} from "@/lib/types";
import { ProductAllergyConflictForm } from "@/components/forms/product-allergy-conflict-form";
import { ProductForm } from "@/components/forms/product-form";
import { usePermissions } from "@/hooks/use-permissions";
import { usePageTitle } from "@/hooks/use-page-title";
import { useConfirm } from "@/hooks/use-confirm";

function ProductDetailContent() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const addAlert = useAlertStore((s) => s.addAlert);
  const { can } = usePermissions();
  const confirm = useConfirm();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [pricingKey, setPricingKey] = useState(0);
  const [conflictsKey, setConflictsKey] = useState(0);

  const bumpPricing = () => setPricingKey((k) => k + 1);
  const bumpConflicts = () => setConflictsKey((k) => k + 1);

  const [editOpen, setEditOpen] = useState(false);

  const [conflictFormOpen, setConflictFormOpen] = useState(false);
  const [editingConflict, setEditingConflict] =
    useState<ProductAllergyConflict | null>(null);

  const load = async () => {
    try {
      const prod = await api.get<Product>(`/products/${id}`);
      setProduct(prod);
    } catch {
      addAlert("error", "Failed to load product.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const handleDelete = async () => {
    if (!product) return;
    if (
      !(await confirm({
        title: "Delete product?",
        description: `Delete product "${product.name}"?`,
        confirmText: "Delete",
      }))
    ) {
      return;
    }
    try {
      await api.del(`/products/${id}`);
      addAlert("success", "Product deleted.");
      navigate("/inventory/products");
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    }
  };

  const handleRemoveConflict = async (conflictId: string) => {
    if (
      !(await confirm({
        title: "Remove conflict?",
        description: "Remove this allergy conflict?",
        confirmText: "Remove",
      }))
    ) {
      return;
    }
    try {
      await api.del(`/product-allergy-conflicts/${conflictId}`);
      addAlert("success", "Conflict removed.");
      bumpConflicts();
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    }
  };

  if (loading) return <Loading />;
  if (!product)
    return (
      <p className="py-12 text-center text-muted-foreground">
        Product not found.
      </p>
    );

  return (
    <div className="space-y-4">
      <PageHeader
        backHref="/inventory/products"
        title={product.name}
        onEdit={can("products:write") ? () => setEditOpen(true) : undefined}
        onDelete={can("products:delete") ? handleDelete : undefined}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 sm:gap-x-8 gap-y-3 text-sm">
          <DetailField label="Price">
            <p className="font-semibold">${product.unitPrice.toFixed(2)}</p>
          </DetailField>
          <DetailField label="Category">
            {(() => {
              let cats = [
                product.category?.parent?.name || "",
                product.category?.name || "",
              ].filter((c) => c);
              if (!cats.length) return "---";
              return (
                <div className="flex flex-row gap-1">
                  {cats.map((cat, i) => (
                    <Badge variant="outline" key={i}>
                      {cat}
                    </Badge>
                  ))}
                </div>
              );
            })()}
          </DetailField>
          <DetailField label="Stock">{product.quantity}</DetailField>
          <DetailField label="Min Threshold">
            {product.minThreshold ?? "---"}
          </DetailField>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DataList<ProductAllergyConflict>
          title="Allergy Conflicts"
          columns={[
            {
              header: "Allergy",
              key: "allergy",
              className: "w-75",
              render: (i) => i.allergyName ?? i.allergyId,
            },
            {
              header: "Notes",
              key: "notes",
              className: "truncate",
              render: (i) => i.notes ?? "---",
            },
          ]}
          actions={
            can("product-allergy-conflicts:write")
              ? [
                  {
                    label: "Edit",
                    icon: <Pencil className="size-3.5" />,
                    onClick: (i) => {
                      setEditingConflict(i);
                      setConflictFormOpen(true);
                    },
                  },
                  {
                    label: "Delete",
                    icon: <Trash2 className="size-3.5" />,
                    destructive: true,
                    onClick: (i) => handleRemoveConflict(i.id),
                  },
                ]
              : []
          }
          endpoint={`/products/${id}/allergy-conflicts`}
          rowKey={(i) => i.id}
          limit={5}
          hideSearch
          refreshKey={conflictsKey}
          emptyMessage="No allergy conflicts."
          headerActions={
            can("product-allergy-conflicts:write") && (
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

        {can("invoices:read") && (
          <DataList<Invoice>
            title="Invoices"
            columns={[
              {
                header: "Invoice No.",
                key: "Invoice No.",
                className: "w-28",
                render: (i) => `#${i.invoiceNumber}`,
              },
              {
                header: "Type",
                key: "type",
                className: "w-40",
                render: (i) => (
                  <Badge variant="secondary">
                    {i.fromEntityId == "self" ? "Sale" : "Purchase"}
                  </Badge>
                ),
              },
              {
                header: "Date",
                key: "date",
                render: (i) => beirutDayKey(i.createdAt) || "---",
              },
              {
                header: "Amount",
                key: "amount",
                className: "w-40 text-right",
                render: (i) => `$${i.amount.toFixed(2)}`,
              },
            ]}
            endpoint={`/products/${id}/invoices`}
            rowKey={(i) => i.id}
            limit={5}
            hideSearch
            onRowClick={(i) => navigate(`/financials/invoices/${i.id}`)}
            emptyMessage="No invoices."
          />
        )}

        <DataList<ProductPrice>
          title="Pricing History"
          columns={[
            {
              header: "",
              key: "status",
              className: "w-28",
              render: (i) => (i.isActive ? <Badge>Current</Badge> : null),
            },
            {
              header: "Price",
              key: "price",
              render: (i) => (
                <span className="font-medium">${i.price.toFixed(2)}</span>
              ),
            },
            {
              header: "Date",
              key: "createdAt",
              className: "w-40",
              render: (i) => beirutDayKey(i.createdAt) || "---",
            },
          ]}
          endpoint={`/products/${id}/prices`}
          rowKey={(i) => i.id}
          limit={5}
          hideSearch
          emptyMessage="No price history."
          refreshKey={pricingKey}
        />
      </div>

      <ProductAllergyConflictForm
        open={conflictFormOpen}
        onClose={() => {
          setConflictFormOpen(false);
          setEditingConflict(null);
        }}
        onSaved={bumpConflicts}
        productId={id}
        initial={editingConflict}
      />

      <ProductForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          load();
          bumpPricing();
        }}
        initial={product}
      />
    </div>
  );
}

export default function ProductDetailPage() {
  usePageTitle("Product");
  return <ProductDetailContent />;
}
