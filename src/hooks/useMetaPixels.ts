import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { MetaPixel } from "@/types/db";

/**
 * Storefront: the active pixels.
 *
 * `retry: 0` so a project whose database has not run the pixels migration
 * degrades to "no pixels" instead of hammering PostgREST on every page mount.
 * The long staleTime matters because every page mounts this.
 */
export function useActivePixels() {
  return useQuery({
    queryKey: ["active-pixels"],
    staleTime: 60 * 60 * 1000,
    retry: 0,
    queryFn: async (): Promise<MetaPixel[]> => {
      const { data, error } = await supabase
        .from("meta_pixels")
        .select("*")
        .eq("active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return normalize(data);
    },
  });
}

export function useAllPixelsAdmin() {
  return useQuery({
    queryKey: ["admin-pixels"],
    queryFn: async (): Promise<MetaPixel[]> => {
      const { data, error } = await supabase
        .from("meta_pixels")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return normalize(data);
    },
  });
}

/** `id` absent means insert; present means update. */
export type PixelInput = Omit<MetaPixel, "id" | "created_at" | "updated_at"> & {
  id?: string;
};

export function useSavePixel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: PixelInput) => {
      const { id, ...values } = input;
      if (id) {
        const { error } = await supabase.from("meta_pixels").update(values).eq("id", id);
        if (error) throw error;
        return id;
      }
      const { data, error } = await supabase
        .from("meta_pixels")
        .insert(values)
        .select("id")
        .single();
      if (error) throw error;
      return (data as { id: string }).id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-pixels"] });
      queryClient.invalidateQueries({ queryKey: ["active-pixels"] });
    },
  });
}

export function useDeletePixel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("meta_pixels").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-pixels"] });
      queryClient.invalidateQueries({ queryKey: ["active-pixels"] });
    },
  });
}

function normalize(rows: unknown): MetaPixel[] {
  if (!Array.isArray(rows)) return [];
  return (rows as MetaPixel[]).map((row) => ({
    ...row,
    match_values: Array.isArray(row.match_values) ? row.match_values : [],
    events: (row.events ?? {}) as MetaPixel["events"],
  }));
}
