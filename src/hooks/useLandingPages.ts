import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { normalizeBlocks, normalizeSeo, normalizeTheme } from "@/lib/landing";
import { invalidateLandingPages } from "@/lib/queryCache";
import { normalizeProduct } from "./useCatalog";
import type { LandingPage, LandingPagePayload } from "@/types/landing";

/**
 * Public renderer. Goes through get_landing_page(), not a table select: a
 * campaign page may legitimately point at a `draft` product deliberately kept
 * out of /shop, and the anon products policy hides those. The RPC exposes
 * exactly that one product rather than widening the policy.
 */
export function useLandingPage(slug: string | undefined, preview = false) {
  return useQuery({
    queryKey: ["landing-page", slug, preview],
    enabled: !!slug,
    retry: 0,
    queryFn: async (): Promise<LandingPagePayload | null> => {
      if (preview) {
        const draft = await fetchDraftForPreview(slug!);
        if (draft) return draft;
        // Not signed in as an admin, or no such page — fall through to the
        // public path so a ?preview=1 link that leaks still shows only what
        // the public would see.
      }

      const { data, error } = await supabase.rpc("get_landing_page", { p_slug: slug });
      if (error) throw error;
      if (!data) return null;

      const payload = data as LandingPagePayload;
      return {
        ...payload,
        theme: normalizeTheme(payload.theme),
        blocks: normalizeBlocks(payload.blocks),
        seo: normalizeSeo(payload.seo),
        pixel_ids: Array.isArray(payload.pixel_ids) ? payload.pixel_ids : [],
        product: payload.product ? normalizeProduct(payload.product) : null,
      };
    },
  });
}

/**
 * Draft preview.
 *
 * get_landing_page() hard-filters `status = 'published'` — correct, an
 * unfinished campaign must not be reachable — which left the client unable to
 * look at a page before publishing it. This reads the row through the normal
 * table policies instead, so RLS is the gate: an admin session sees the draft,
 * anyone else gets nothing and the caller falls back to the public RPC. No
 * policy is widened and no secret lives in the URL.
 */
async function fetchDraftForPreview(slug: string): Promise<LandingPagePayload | null> {
  const { data, error } = await supabase
    .from("landing_pages")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) return null;

  const page = normalizeRow(data);

  let product = null;
  if (page.product_id) {
    const { data: productRow } = await supabase
      .from("products")
      .select("*, product_images(*)")
      .eq("id", page.product_id)
      .maybeSingle();
    product = productRow ? normalizeProduct(productRow) : null;
  }

  return { ...page, product };
}

export function useAdminLandingPages() {
  return useQuery({
    queryKey: ["admin-landing-pages"],
    queryFn: async (): Promise<LandingPage[]> => {
      const { data, error } = await supabase
        .from("landing_pages")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return normalizeRows(data);
    },
  });
}

export function useAdminLandingPage(id: string | undefined) {
  return useQuery({
    queryKey: ["admin-landing-page", id],
    enabled: !!id && id !== "new",
    queryFn: async (): Promise<LandingPage | null> => {
      const { data, error } = await supabase
        .from("landing_pages")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data ? normalizeRow(data) : null;
    },
  });
}

export function useDeleteLandingPage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("landing_pages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateLandingPages(queryClient),
  });
}

function normalizeRow(row: unknown): LandingPage {
  const page = row as LandingPage;
  return {
    ...page,
    theme: normalizeTheme(page.theme),
    blocks: normalizeBlocks(page.blocks),
    seo: normalizeSeo(page.seo),
    pixel_ids: Array.isArray(page.pixel_ids) ? page.pixel_ids : [],
  };
}

function normalizeRows(rows: unknown): LandingPage[] {
  return Array.isArray(rows) ? rows.map(normalizeRow) : [];
}
