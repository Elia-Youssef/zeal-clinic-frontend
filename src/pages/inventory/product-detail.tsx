"use client";

import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, AlertTriangle, Trash2 } from "lucide-react";
import { Loading } from "@/components/shared/loading";
import { PageHeader } from "@/components/shared/page-header";
import { DetailField } from "@/components/shared/detail-field";
import { DataList } from "@/components/data/data-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/shared/modal";
import { SearchableDropdown } from "@/components/shared/searchable-dropdown";
import { api, type Paginated } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import { useAlertStore } from "@/lib/stores/alert-store";
import type {
  Invoice,
  Product,
  ProductAllergyConflict,
  ProductCategory,
} from "@/lib/types";
import { ProductAllergyConflictForm } from "@/components/forms/product-allergy-conflict-form";
import { usePermissions } from "@/hooks/use-permissions";
import { usePageTitle } from "@/hooks/use-page-title";

/* ------------------------------------------------------------------ */
/*  Page content                                                       */
/* ------------------------------------------------------------------ */

function ProductDetailContent() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const addAlert = useAlertStore((s) => s.addAlert);
  const { can } = usePermissions();

  const [product, setProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  /* Edit modal */
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [minThreshold, setMinThreshold] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  /* Allergy conflict add modal */
  const [conflictFormOpen, setConflictFormOpen] = useState(false);

  const load = async () => {
    try {
      const [prod, cats] = await Promise.all([
        api.get<Product>(`/products/${id}`),
        api.get<Paginated<ProductCategory>>("/product-categories"),
      ]);
      setProduct(prod);
      setCategories(cats.items ?? []);
      setName(prod.name);
      setCategoryId(prod.categoryId ?? "");
      setQuantity(prod.quantity.toString());
      setMinThreshold(prod.minThreshold?.toString() ?? "");
      setUnitPrice(prod.unitPrice.toString());
    } catch {
      addAlert("error", "Failed to load product.");
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

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const payload: Record<string, unknown> = {
      name,
      unitPrice: Number(unitPrice),
    };
    if (categoryId) payload.categoryId = categoryId;
    if (quantity) payload.quantity = Number(quantity);
    if (minThreshold) payload.minThreshold = Number(minThreshold);
    try {
      await api.put(`/products/${id}`, payload);
      addAlert("success", "Product updated.");
      setEditOpen(false);
      reload();
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!product || !confirm(`Delete product "${product.name}"?`)) return;
    try {
      await api.del(`/products/${id}`);
      addAlert("success", "Product deleted.");
      navigate("/inventory");
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    }
  };

  const handleRemoveConflict = async (conflictId: string) => {
    try {
      await api.del(`/product-allergy-conflicts/${conflictId}`);
      addAlert("success", "Conflict removed.");
      setRefreshKey((k) => k + 1);
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

  const catMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));

  return (
    <div className="space-y-4">
      <PageHeader
        backHref="/inventory"
        title={product.name}
        badges={
          product.categoryId ? (
            <Badge variant="outline">{catMap[product.categoryId] ?? "—"}</Badge>
          ) : undefined
        }
        onEdit={can("inventory:write") ? () => setEditOpen(true) : undefined}
        onDelete={can("inventory:delete") ? handleDelete : undefined}
      />

      {/* Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-x-8 gap-y-2 text-sm">
          <DetailField label="Unit Price">
            <p className="text-lg font-semibold">
              ${product.unitPrice.toFixed(2)}
            </p>
          </DetailField>
          <DetailField label="Stock">{product.quantity}</DetailField>
          <DetailField label="Min Threshold">
            {product.minThreshold ?? "—"}
          </DetailField>
        </CardContent>
      </Card>

      {/* Allergy conflicts & Invoices */}
      <div className="flex flex-row gap-4">
        <DataList<ProductAllergyConflict>
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
            can("inventory:delete")
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
          endpoint={`/products/${id}/allergy-conflicts`}
          rowKey={(i) => i.id}
          limit={5}
          hideSearch
          refreshKey={refreshKey}
          emptyMessage="No allergy conflicts."
          headerActions={
            can("inventory:write") && (
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

        <DataList<Invoice>
          className="flex-1"
          title="Invoices"
          columns={[
            {
              header: "#",
              key: "#",
              render: (i) => `#${i.invoiceNumber}`,
            },
            {
              header: "Date",
              key: "date",
              render: (i) => i.createdAt?.slice(0, 10) ?? "—",
            },
            {
              header: "Amount",
              key: "amount",
              render: (i) => `$${i.amount.toFixed(2)}`,
            },
          ]}
          endpoint={`/products/${id}/invoices`}
          rowKey={(i) => i.id}
          limit={5}
          hideSearch
          refreshKey={refreshKey}
          onRowClick={(i) => navigate(`/financials/invoices/${i.id}`)}
          emptyMessage="No invoices."
        />
      </div>

      {/* Add conflict modal */}
      <ProductAllergyConflictForm
        open={conflictFormOpen}
        onClose={() => setConflictFormOpen(false)}
        onSaved={reload}
        productId={id}
      />

      {/* Edit modal */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Product"
      >
        <form onSubmit={handleUpdate} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Name *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Category</label>
              <SearchableDropdown
                value={categoryId}
                onChange={setCategoryId}
                apiEndpoint="/product-categories/dropdown"
                mapItem={(c: any) => ({ value: c.id, label: c.name })}
                placeholder="None"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Unit Price *</label>
              <Input
                type="number"
                step="0.01"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Quantity</label>
              <Input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Min Threshold</label>
              <Input
                type="number"
                value={minThreshold}
                onChange={(e) => setMinThreshold(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Update"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page export                                                        */
/* ------------------------------------------------------------------ */

export default function ProductDetailPage() {
  usePageTitle("Product");
  return <ProductDetailContent />;
}
