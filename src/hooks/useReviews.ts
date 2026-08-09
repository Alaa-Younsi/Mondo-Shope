import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { ClientReview } from "@/types/db";

export function useReviews(activeOnly = true) {
  return useQuery({
    queryKey: ["reviews", activeOnly],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ClientReview[]> => {
      let query = supabase
        .from("client_reviews")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (activeOnly) query = query.eq("active", true);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as ClientReview[];
    },
  });
}
