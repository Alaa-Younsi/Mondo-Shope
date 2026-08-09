import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { DeliveryPrice, StoreSettings } from "@/types/db";

export function useStoreSettings() {
  return useQuery({
    queryKey: ["store-settings"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<StoreSettings | null> => {
      const { data, error } = await supabase
        .from("store_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      const row = data as StoreSettings;
      return {
        ...row,
        // A database that has not run 0007_hero_slides yet returns a row with
        // no such column, and the hero maps over this on every render.
        hero_slides: Array.isArray(row.hero_slides)
          ? row.hero_slides.filter((slide) => slide && typeof slide.image_url === "string")
          : [],
      };
    },
  });
}

export function useDeliveryPrices(activeOnly = false) {
  return useQuery({
    queryKey: ["delivery-prices", activeOnly],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<DeliveryPrice[]> => {
      let query = supabase.from("delivery_prices").select("*").order("wilaya");
      if (activeOnly) query = query.eq("active", true);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as DeliveryPrice[];
    },
  });
}

export interface ResolvedShipping {
  /** What to charge. 0 only when the free-shipping offer applies. */
  amount: number;
  /** True when a wilaya has been picked — otherwise the UI shows a dash. */
  known: boolean;
  /** True when the offer zeroed a real fee, so the UI can say "Offerte". */
  isFree: boolean;
}

/**
 * THE single shipping rule, shared by Checkout, InlineCheckout and the landing
 * page order form.
 *
 * It must mirror place_order() exactly. When these drifted apart once, the
 * checkout kept adding the wilaya fee while the server zeroed it above the
 * threshold, and customers saw a total several hundred DA higher than what they
 * were actually charged — with the Purchase pixel value wrong the same way.
 *
 * "No wilaya picked yet" and "free" must never collapse into the same dash.
 */
export function resolveShipping(
  wilayaFee: number | null | undefined,
  goodsTotalAfterDiscounts: number,
  settings: StoreSettings | null | undefined,
): ResolvedShipping {
  if (wilayaFee === null || wilayaFee === undefined) {
    return { amount: 0, known: false, isFree: false };
  }

  const fee = Number(wilayaFee) || 0;
  const threshold = settings?.free_ship_threshold;

  // A null threshold means the offer is OFF, not "everything ships free".
  if (threshold !== null && threshold !== undefined && goodsTotalAfterDiscounts >= threshold) {
    return { amount: 0, known: true, isFree: true };
  }

  return { amount: fee, known: true, isFree: fee === 0 };
}
