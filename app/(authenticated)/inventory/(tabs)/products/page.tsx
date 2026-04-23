"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { type Column } from "@/components/data-table";
import { DataList } from "@/components/data-list";
import { AddButton } from "@/components/add-button";
import { Badge } from "@/components/ui/badge";
import { useProductsStore } from "@/lib/stores/products-store";
import type { Product } from "@/lib/types";
import { ProductForm } from "@/components/forms/product-form";
import { usePermissions } from "@/hooks/use-permissions";

export default function ProductsPage() {
  const router = useRouter();
  const { can } = usePermissions();
  const categories = useProductsStore((s) => s.categories);
  const fetchAll = useProductsStore((s) => s.fetch);

  const [refreshKey, setRefreshKey] = useState(0);
  const [prodFormOpen, setProdFormOpen] = useState(false);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const catMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));

  const handleSaved = () => {
    setRefreshKey((k) => k + 1);
    fetchAll();
  };

  const prodColumns: Column<Product>[] = [
    {
      key: "name",
      header: "Name",
      render: (p) => <span className="font-medium">{p.name}</span>,
    },
    {
      key: "category",
      header: "Category",
      render: (p) =>
        p.categoryId ? (
          <Badge variant="outline">{catMap[p.categoryId] ?? "—"}</Badge>
        ) : (
          "—"
        ),
    },
    {
      key: "quantity",
      header: "Stock",
      render: (p) => `${p.quantity}`,
    },
    {
      key: "price",
      header: "Unit Price",
      className: "text-right",
      render: (p) => (
        <span className="font-medium">
          {p.unitPrice != null ? `$${p.unitPrice.toFixed(2)}` : "—"}
        </span>
      ),
    },
  ];

  return (
    <>
      <DataList<Product>
        title="Products"
        endpoint="/products"
        columns={prodColumns}
        rowKey={(p) => p.id}
        searchPlaceholder="Search products…"
        emptyMessage="No products yet."
        emptySearchMessage="No products match."
        onRowClick={(p) => router.push(`/inventory/products/${p.id}`)}
        headerActions={
          can("inventory:write") ? (
            <AddButton
              label="Add Product"
              onClick={() => setProdFormOpen(true)}
            />
          ) : undefined
        }
        refreshKey={refreshKey}
      />

      <ProductForm
        open={prodFormOpen}
        onClose={() => setProdFormOpen(false)}
        onSaved={handleSaved}
      />
    </>
  );
}
