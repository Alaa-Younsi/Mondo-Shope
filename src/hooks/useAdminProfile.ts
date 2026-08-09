import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { AdminUser } from "@/types/db";

/**
 * Reads the caller's own `admin_users` row.
 *
 * This MIRRORS the RLS gate so the dashboard can show a proper "no access"
 * screen instead of an empty shell — it is never the boundary itself. Every
 * table's policy independently calls is_admin(), so a user who forces their way
 * past this hook still cannot read or write a single row.
 */
export function useAdminProfile(userId: string | undefined) {
  const query = useQuery({
    queryKey: ["admin-profile", userId],
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    retry: 0,
    queryFn: async (): Promise<AdminUser | null> => {
      const { data, error } = await supabase
        .from("admin_users")
        .select("*")
        .eq("user_id", userId!)
        .maybeSingle();

      if (error) throw error;
      return data as AdminUser | null;
    },
  });

  return {
    profile: query.data ?? null,
    isAdmin: !!query.data?.active,
    isLoading: query.isLoading,
    error: query.error,
  };
}
