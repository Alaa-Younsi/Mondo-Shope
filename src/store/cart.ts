import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { QuantityOffer, VariantSelection } from "@/types/db";
import { lineTotal } from "@/lib/offers";
import { MAX_QTY_PER_LINE } from "@/lib/limits";
import { variantKey } from "@/lib/utils";

export interface CartItem {
  productId: string;
  slug: string;
  nameFr: string;
  nameAr: string;
  price: number;
  image: string | null;
  quantity: number;
  color: string | null;
  size: string | null;
  variants: VariantSelection[];
  /** Snapshot so the cart can price offers optimistically without a refetch. */
  offers: QuantityOffer[];
  maxStock: number;
}

/**
 * A line's identity is productId + colour + size + an ORDER-INDEPENDENT key of
 * the custom variant picks, so the same picks made in a different order merge
 * into one line instead of silently duplicating it.
 */
export function lineIdentity(item: {
  productId: string;
  color: string | null;
  size: string | null;
  variants: VariantSelection[];
}): string {
  return [
    item.productId,
    item.color ?? "",
    item.size ?? "",
    variantKey(item.variants),
  ].join("::");
}

interface CartState {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (identity: string) => void;
  updateQuantity: (identity: string, quantity: number) => void;
  clear: () => void;
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],

      addItem: (item) =>
        set((state) => {
          const identity = lineIdentity(item);
          const existing = state.items.find((entry) => lineIdentity(entry) === identity);

          if (!existing) {
            return { items: [...state.items, item] };
          }

          const merged = Math.min(
            existing.quantity + item.quantity,
            Math.max(1, item.maxStock),
            MAX_QTY_PER_LINE,
          );
          return {
            items: state.items.map((entry) =>
              lineIdentity(entry) === identity ? { ...entry, quantity: merged } : entry,
            ),
          };
        }),

      removeItem: (identity) =>
        set((state) => ({
          items: state.items.filter((entry) => lineIdentity(entry) !== identity),
        })),

      updateQuantity: (identity, quantity) =>
        set((state) => ({
          items: state.items.map((entry) =>
            lineIdentity(entry) === identity
              ? {
                  ...entry,
                  quantity: Math.min(
                    Math.max(1, quantity),
                    Math.max(1, entry.maxStock),
                    MAX_QTY_PER_LINE,
                  ),
                }
              : entry,
          ),
        })),

      clear: () => set({ items: [] }),
    }),
    {
      name: "mondo-cart",
      // v2 introduced MAX_QTY_PER_LINE. A cart persisted before it can still
      // hold a line above the cap, and nothing re-clamps a line the shopper
      // never touches again — so clamp once on rehydrate.
      version: 2,
      migrate: (persisted) => {
        const state = persisted as { items?: CartItem[] } | undefined;
        return {
          ...state,
          items: (state?.items ?? []).map((item) => ({
            ...item,
            quantity: Math.min(Math.max(1, item.quantity), MAX_QTY_PER_LINE),
          })),
        } as CartState;
      },
    },
  ),
);

/** Optimistic goods total (offers applied). The server recomputes all of it. */
export function cartGoodsTotal(items: CartItem[]): number {
  return items.reduce(
    (sum, item) => sum + lineTotal(item.price, item.quantity, item.offers),
    0,
  );
}

/** Sum before offers — what the "before discount" line shows. */
export function cartSubtotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

export function cartCount(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}
