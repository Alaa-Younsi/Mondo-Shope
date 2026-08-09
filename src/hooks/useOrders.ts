import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { GuestOrder, Order, OrderStatus } from "@/types/db";

export function useOrders(status: OrderStatus | "all" = "all") {
  return useQuery({
    queryKey: ["orders", status],
    queryFn: async (): Promise<Order[]> => {
      let query = supabase
        .from("orders")
        .select("*, order_items(*)")
        .order("created_at", { ascending: false });

      if (status !== "all") query = query.eq("status", status);

      const { data, error } = await query;
      if (error) throw error;
      return normalizeOrders(data);
    },
  });
}

export function useOrder(id: string | undefined) {
  return useQuery({
    queryKey: ["order", id],
    enabled: !!id,
    queryFn: async (): Promise<Order | null> => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data ? normalizeOrder(data) : null;
    },
  });
}

/**
 * Guest confirmation page. Goes through the get_order_by_number RPC, NOT a
 * direct .from("orders").select(...) — `orders` has no anon SELECT policy, so
 * the direct query 406s for every real customer while looking fine in dev if
 * you happen to be logged in as an admin.
 */
export function useGuestOrder(orderNumber: string | undefined) {
  return useQuery({
    queryKey: ["guest-order", orderNumber],
    enabled: !!orderNumber,
    retry: 0,
    queryFn: async (): Promise<GuestOrder | null> => {
      const { data, error } = await supabase.rpc("get_order_by_number", {
        p_order_number: orderNumber,
      });
      if (error) throw error;
      if (!data) return null;
      const order = data as GuestOrder;
      return { ...order, items: Array.isArray(order.items) ? order.items : [] };
    },
  });
}

/**
 * Normalise jsonb columns added by later migrations here, in the fetch hook —
 * a database that has not run the variants migration returns rows without the
 * column and `item.variants.map(...)` crashes the order detail page.
 */
function normalizeOrder(row: unknown): Order {
  const order = row as Order;
  return {
    ...order,
    order_items: (order.order_items ?? []).map((item) => ({
      ...item,
      variants: Array.isArray(item.variants) ? item.variants : [],
    })),
  };
}

function normalizeOrders(rows: unknown): Order[] {
  return Array.isArray(rows) ? rows.map(normalizeOrder) : [];
}
