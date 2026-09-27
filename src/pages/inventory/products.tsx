import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { type Column } from "@/components/data/data-table";
import { DataList } from "@/components/data/data-list";
import { AddButton } from "@/components/shared/add-button";
import { Badge } from "@/components/ui/badge";
import { useProductsStore } from "@/lib/stores/products-store";
import type { Product } from "@/lib/types";
import { formatMoney } from "@/lib/utils";
import { ProductForm } from "@/components/forms/product-form";
import { usePermissions } from "@/hooks/use-permissions";

export default function ProductsPage() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const fetchAll = useProductsStore((s) => s.fetch);

  const [refreshKey, setRefreshKey] = useState(0);
  const [prodFormOpen, setProdFormOpen] = useState(false);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleSaved = () => {
    setRefreshKey((k) => k + 1);
    fetchAll();
  };

  const prodColumns: Column<Product>[] = [
    {
      key: "name",
      header: "Name",
      className: "truncate",
      sortable: true,
      sortKey: "name",
      render: (p) => <span className="font-medium">{p.name}</span>,
    },
    {
      key: "category",
      header: "Category",
      className: "w-64",
      render: (p) => {
        const cat = p.category?.name || "";
        const parentcat = p.category?.parent?.name || "";
        if (!cat && !parentcat) return "---";
        return (
          <div className="flex flex-row gap-1">
            {parentcat && <Badge variant="outline">{parentcat}</Badge>}
            {cat && <Badge variant="outline">{cat}</Badge>}
          </div>
        );
      },
    },
    {
      key: "quantity",
      header: "Stock",
      className: "w-24 text-right",
      sortable: true,
      sortKey: "quantity",
      render: (p) => `${p.quantity}`,
    },
    {
      key: "price",
      header: "Unit Price",
      className: "w-40 text-right",
      sortable: true,
      sortKey: "unitPrice",
      render: (p) => (
        <span className="font-medium">
          {p.unitPrice != null ? formatMoney(p.unitPrice) : "---"}
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
        emptyMessage="No products yet."
        emptySearchMessage="No products match."
        onRowClick={(p) => navigate(`/inventory/products/${p.id}`)}
        headerActions={
          can("products:write") ? (
            <AddButton label="New" onClick={() => setProdFormOpen(true)} />
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
