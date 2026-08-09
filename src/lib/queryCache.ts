import type { QueryClient } from "@tanstack/react-query";

/**
 * A product lives under several React Query keys at once. Invalidating only the
 * admin list leaves the storefront serving the old price for the rest of the
 * session — which the client experiences as "it saved but the site didn't
 * change". Every product write goes through this helper.
 */
export function invalidateProducts(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: ["admin-products"] });
  queryClient.invalidateQueries({ queryKey: ["products"] });
  queryClient.invalidateQueries({ queryKey: ["product"] });
  queryClient.invalidateQueries({ queryKey: ["related-products"] });
  queryClient.invalidateQueries({ queryKey: ["featured-products"] });
  queryClient.invalidateQueries({ queryKey: ["landing-page"] });
}

/**
 * Taxonomy writes must ALSO invalidate the product caches: the product
 * listings embed `category:categories(*)`, so a renamed category is stale in
 * them until they refetch.
 */
export function invalidateCategories(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: ["categories"] });
  queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
  invalidateProducts(queryClient);
}

export function invalidateOrders(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: ["orders"] });
  queryClient.invalidateQueries({ queryKey: ["order"] });
  queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
}

export function invalidateLandingPages(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: ["admin-landing-pages"] });
  queryClient.invalidateQueries({ queryKey: ["admin-landing-page"] });
  queryClient.invalidateQueries({ queryKey: ["landing-page"] });
}
