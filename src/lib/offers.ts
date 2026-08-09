import type { QuantityOffer } from "@/types/db";

/**
 * CLIENT-SIDE MIRROR of the quantity-offer pricing inside place_order().
 *
 * This exists only so the cart and checkout can show an optimistic total while
 * the shopper types. The authoritative numbers always come back from the RPC.
 * If the offer math changes in 0003_functions.sql, change it here too.
 */

function sanitizeOffer(offer: QuantityOffer | null | undefined): QuantityOffer | null {
  if (!offer || typeof offer !== "object") return null;
  if (offer.type === "free") {
    const buy = Math.floor(Number(offer.buy));
    const get = Math.floor(Number(offer.get));
    if (!Number.isFinite(buy) || !Number.isFinite(get) || buy <= 0 || get <= 0) {
      return null;
    }
    return { type: "free", buy, get };
  }
  if (offer.type === "price") {
    const qty = Math.floor(Number(offer.qty));
    const price = Number(offer.price);
    if (!Number.isFinite(qty) || !Number.isFinite(price) || qty <= 0 || price <= 0) {
      return null;
    }
    return { type: "price", qty, price };
  }
  return null;
}

/** Drop malformed rows so they can never round-trip through the admin form. */
export function sanitizeOffers(offers: unknown): QuantityOffer[] {
  if (!Array.isArray(offers)) return [];
  return offers
    .map((offer) => sanitizeOffer(offer as QuantityOffer))
    .filter((offer): offer is QuantityOffer => offer !== null);
}

/** Cheapest applicable total for one cart line, offers considered. */
export function lineTotal(
  unitPrice: number,
  quantity: number,
  offers: QuantityOffer[] | null | undefined,
): number {
  const price = Number(unitPrice) || 0;
  const qty = Math.max(0, Math.floor(Number(quantity) || 0));
  const base = price * qty;
  let best = base;

  for (const offer of sanitizeOffers(offers)) {
    let candidate = base;
    if (offer.type === "free") {
      // Every full group of (buy + get) units contains `get` free units.
      const freeUnits = Math.floor(qty / (offer.buy + offer.get)) * offer.get;
      candidate = (qty - freeUnits) * price;
    } else {
      candidate =
        Math.floor(qty / offer.qty) * offer.price + (qty % offer.qty) * price;
    }
    if (candidate < best) best = candidate;
  }

  return best;
}

/** How much the offers took off this line (never negative). */
export function lineDiscount(
  unitPrice: number,
  quantity: number,
  offers: QuantityOffer[] | null | undefined,
): number {
  const base = (Number(unitPrice) || 0) * Math.max(0, Math.floor(Number(quantity) || 0));
  return Math.max(0, base - lineTotal(unitPrice, quantity, offers));
}

/** Human-readable label for an offer badge, e.g. "3 pour 2 500 DA". */
export function describeOffer(offer: QuantityOffer): { qty: number; kind: "free" | "price" } {
  return offer.type === "free"
    ? { qty: offer.buy + offer.get, kind: "free" }
    : { qty: offer.qty, kind: "price" };
}
