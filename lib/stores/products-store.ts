import { create } from "zustand";
import { api, type Paginated } from "@/lib/api";
import type { Product, ProductCategory } from "@/lib/types";

type ProductsState = {
  products: Product[];
  categories: ProductCategory[];
  loading: boolean;
  fetch: () => Promise<void>;
};

export const useProductsStore = create<ProductsState>((set) => ({
  products: [],
  categories: [],
  loading: true,

  fetch: async () => {
    set({ loading: true });
    try {
      const [prodRes, catRes] = await Promise.all([
        api.get<Paginated<Product>>("/products"),
        api.get<Paginated<ProductCategory>>("/product-categories"),
      ]);
      set({ products: prodRes.items, categories: catRes.items });
    } finally {
      set({ loading: false });
    }
  },
}));
