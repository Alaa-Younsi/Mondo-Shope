import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { sanitizeSearchTerm } from "@/lib/utils";
import type { Category, Product } from "@/types/db";

const PRODUCT_SELECT = "*, category:categories(*), product_images(*)";

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("name_fr", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Category[];
    },
  });
}

export interface ProductFilters {
  categoryId?: string | null;
  search?: string;
  sort?: "newest" | "price-asc" | "price-desc";
}

export function useProducts(filters: ProductFilters = {}) {
  const { categoryId = null, search = "", sort = "newest" } = filters;

  return useQuery({
    queryKey: ["products", { categoryId, search, sort }],
    queryFn: async (): Promise<Product[]> => {
      let query = supabase.from("products").select(PRODUCT_SELECT).eq("status", "active");

      if (categoryId) query = query.eq("category_id", categoryId);

      const term = sanitizeSearchTerm(search.trim());
      if (term) {
        // NEVER interpolate raw input here: `.or()` takes a filter STRING, so a
        // term containing , ( ) would inject extra filter clauses.
        query = query.or(`name_fr.ilike.%${term}%,name_ar.ilike.%${term}%`);
      }

      if (sort === "price-asc") query = query.order("price", { ascending: true });
      else if (sort === "price-desc") query = query.order("price", { ascending: false });
      else query = query.order("created_at", { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      return normalizeProducts(data);
    },
  });
}

export function useFeaturedProducts(limit = 8) {
  return useQuery({
    queryKey: ["featured-products", limit],
    staleTime: 60 * 1000,
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await supabase
        .from("products")
        .select(PRODUCT_SELECT)
        .eq("status", "active")
        .eq("featured", true)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return normalizeProducts(data);
    },
  });
}

export function useProduct(slug: string | undefined) {
  return useQuery({
    queryKey: ["product", slug],
    enabled: !!slug,
    queryFn: async (): Promise<Product | null> => {
      const { data, error } = await supabase
        .from("products")
        .select(PRODUCT_SELECT)
        .eq("slug", slug!)
        .eq("status", "active")
        .maybeSingle();
      if (error) throw error;
      return data ? normalizeProduct(data) : null;
    },
  });
}

export function useRelatedProducts(categoryId: string | null, excludeId: string | undefined) {
  return useQuery({
    queryKey: ["related-products", categoryId, excludeId],
    enabled: !!categoryId,
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await supabase
        .from("products")
        .select(PRODUCT_SELECT)
        .eq("status", "active")
        .eq("category_id", categoryId!)
        .limit(8);
      if (error) throw error;
      return normalizeProducts(data).filter((product) => product.id !== excludeId).slice(0, 4);
    },
  });
}

/**
 * Normalise jsonb columns added by later migrations HERE, in the fetch layer —
 * a deployed database that has not run one of them returns rows without the
 * column, and `product.variants.map(...)` then crashes the page. Every consumer
 * can trust these are arrays.
 */
function normalizeProduct(row: unknown): Product {
  const product = row as Product;
  return {
    ...product,
    colors: Array.isArray(product.colors) ? product.colors : [],
    sizes: Array.isArray(product.sizes) ? product.sizes : [],
    variants: Array.isArray(product.variants) ? product.variants : [],
    quantity_offers: Array.isArray(product.quantity_offers) ? product.quantity_offers : [],
    details_fr: Array.isArray(product.details_fr) ? product.details_fr : [],
    details_ar: Array.isArray(product.details_ar) ? product.details_ar : [],
    product_images: Array.isArray(product.product_images)
      ? [...product.product_images].sort((a, b) => a.sort_order - b.sort_order)
      : [],
  };
}

function normalizeProducts(rows: unknown): Product[] {
  return Array.isArray(rows) ? rows.map(normalizeProduct) : [];
}

export { normalizeProduct };
