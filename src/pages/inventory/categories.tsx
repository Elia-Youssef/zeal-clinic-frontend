
import { useState, useEffect } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { type Column, type RowAction } from "@/components/data/data-table";
import { DataList } from "@/components/data/data-list";
import { AddButton } from "@/components/shared/add-button";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import { useProductsStore } from "@/lib/stores/products-store";
import { useAlertStore } from "@/lib/stores/alert-store";
import type { ProductCategory } from "@/lib/types";
import { CategoryForm } from "@/components/forms/category-form";
import { usePermissions } from "@/hooks/use-permissions";
import { useConfirm } from "@/hooks/use-confirm";

export default function CategoriesPage() {
  const addAlert = useAlertStore((s) => s.addAlert);
  const { can } = usePermissions();
  const confirm = useConfirm();
  const fetchAll = useProductsStore((s) => s.fetch);

  const [refreshKey, setRefreshKey] = useState(0);
  const [catFormOpen, setCatFormOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<ProductCategory | undefined>();

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleSaved = () => {
    setRefreshKey((k) => k + 1);
    fetchAll();
  };

  const handleDeleteCat = async (c: ProductCategory) => {
    if (
      !(await confirm({
        title: "Delete category?",
        description: `Delete category "${c.name}"?`,
        confirmText: "Delete",
      }))
    ) {
      return;
    }
    try {
      await api.del(`/product-categories/${c.id}`);
      addAlert("success", "Category deleted.");
      handleSaved();
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    }
  };

  const catColumns: Column<ProductCategory>[] = [
    {
      key: "name",
      header: "Name",
      render: (c) => <span className="font-medium">{c.name}</span>,
    },
    { key: "desc", header: "Description", render: (c) => c.description || "---" },
  ];

  const catActions: RowAction<ProductCategory>[] = [
    ...(can("inventory:write")
      ? [{
          label: "Edit",
          icon: <Pencil className="size-3.5" />,
          onClick: (c: ProductCategory) => {
            setEditingCat(c);
            setCatFormOpen(true);
          },
        }]
      : []),
    ...(can("inventory:delete")
      ? [{
          label: "Delete",
          icon: <Trash2 className="size-3.5" />,
          destructive: true,
          onClick: (c: ProductCategory) => handleDeleteCat(c),
        }]
      : []),
  ];

  return (
    <>
      <DataList<ProductCategory>
        title="Categories"
        endpoint="/product-categories"
        columns={catColumns}
        actions={catActions}
        rowKey={(c) => c.id}
        emptyMessage="No categories yet."
        headerActions={
          can("inventory:write") ? (
            <AddButton
              label="Add Category"
              onClick={() => {
                setEditingCat(undefined);
                setCatFormOpen(true);
              }}
            />
          ) : undefined
        }
        refreshKey={refreshKey}
      />

      <CategoryForm
        key={editingCat?.id ?? "new-cat"}
        open={catFormOpen}
        onClose={() => setCatFormOpen(false)}
        onSaved={handleSaved}
        initial={editingCat}
      />
    </>
  );
}
