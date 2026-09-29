import type { PixelEventKey, PublicMetaPixel } from "@/types/db";

/**
 * Meta pixel runtime. Two rules shape everything here:
 *
 *  1. Every event goes through `trackSingle`, never plain `track`. `track`
 *     broadcasts to EVERY initialised pixel, which files a landing page's
 *     conversions into the general retargeting pixel and makes both campaigns'
 *     numbers wrong.
 *  2. Which pixels are live is decided from the database, by scope + match
 *     values — never hardcoded.
 *
 * Nothing in this module throws. An ad blocker is the normal case for a real
 * share of Algerian visitors and must never break checkout.
 */

declare global {
  interface Window {
    fbq?: FbqFn;
    _fbq?: FbqFn;
  }
}

type FbqFn = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[][];
  push?: unknown;
  loaded?: boolean;
  version?: string;
};

export interface PixelContext {
  pathname: string;
  productSlug?: string | null;
  landingSlug?: string | null;
  /** Pixel row ids a landing page force-enables regardless of scope. */
  extraPixelIds?: string[];
}

export type PixelParams = Record<string, unknown>;

const EVENT_NAMES: Record<PixelEventKey, string> = {
  page_view: "PageView",
  view_content: "ViewContent",
  add_to_cart: "AddToCart",
  initiate_checkout: "InitiateCheckout",
  purchase: "Purchase",
  lead: "Lead",
  search: "Search",
};

const SCRIPT_SRC = "https://connect.facebook.net/en_US/fbevents.js";

/** Idempotent per pixel id: re-initialising re-registers the pixel and, on some
 *  versions, re-fires an automatic PageView nobody asked for. */
const initialised = new Set<string>();

function ensureFbq(): FbqFn | null {
  if (typeof window === "undefined" || typeof document === "undefined") return null;
  if (window.fbq) return window.fbq;

  // Meta's stub: buffers calls made before the real script downloads.
  const stub: FbqFn = function (...args: unknown[]) {
    if (stub.callMethod) {
      stub.callMethod(...args);
    } else {
      stub.queue?.push(args);
    }
  } as FbqFn;
  stub.queue = [];
  stub.loaded = true;
  stub.version = "2.0";

  window.fbq = stub;
  window._fbq = stub;

  if (!document.querySelector(`script[src="${SCRIPT_SRC}"]`)) {
    const script = document.createElement("script");
    script.async = true;
    script.src = SCRIPT_SRC;
    document.head.appendChild(script);
  }

  return stub;
}

/**
 * `all`      → every storefront page
 * `paths`    → pathname prefix match ("/shop" matches "/shop/x")
 * `products` → ctx.productSlug ∈ match_values
 * `landing`  → ctx.landingSlug ∈ match_values
 *
 * An EMPTY match_values on a scoped pixel means "every page of that kind" —
 * one pixel for all product pages. The opposite reading makes the row useless.
 */
export function matchPixels(pixels: PublicMetaPixel[], ctx: PixelContext): PublicMetaPixel[] {
  const forced = new Set(ctx.extraPixelIds ?? []);

  return pixels.filter((pixel) => {
    if (!pixel.active) return false;
    if (forced.has(pixel.id)) return true;

    switch (pixel.scope) {
      case "all":
        return true;
      case "paths":
        if (pixel.match_values.length === 0) return true;
        return pixel.match_values.some(
          (value) => value && ctx.pathname.startsWith(value),
        );
      case "products":
        if (!ctx.productSlug) return false;
        if (pixel.match_values.length === 0) return true;
        return pixel.match_values.includes(ctx.productSlug);
      case "landing":
        if (!ctx.landingSlug) return false;
        if (pixel.match_values.length === 0) return true;
        return pixel.match_values.includes(ctx.landingSlug);
      default:
        return false;
    }
  });
}

export function initPixels(pixels: PublicMetaPixel[]): void {
  const fbq = ensureFbq();
  if (!fbq) return;

  const fresh = pixels.filter((pixel) => !initialised.has(pixel.pixel_id));
  if (fresh.length === 0) return;

  // The pixel's own automatic PageView ignores the per-pixel event toggles and
  // doubles up with the one the router sends.
  fbq("set", "autoConfig", false, "all");

  for (const pixel of fresh) {
    initialised.add(pixel.pixel_id);
    if (pixel.test_event_code) {
      fbq("init", pixel.pixel_id, {}, { agent: pixel.test_event_code });
    } else {
      fbq("init", pixel.pixel_id);
    }
  }
}

export function isInitialised(pixelId: string): boolean {
  return initialised.has(pixelId);
}

/**
 * A `value` that resolves to undefined / NaN / 0 is still accepted by Meta as a
 * "successful" event, silently corrupting ROAS reporting instead of failing
 * visibly. Skip those.
 */
function hasValidValue(params?: PixelParams): boolean {
  if (!params || !("value" in params)) return true;
  const value = params.value;
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function trackEvent(
  pixels: PublicMetaPixel[],
  key: PixelEventKey,
  params?: PixelParams,
  eventId?: string,
): void {
  const fbq = ensureFbq();
  if (!fbq) return;

  if (!hasValidValue(params)) {
    if (import.meta.env.DEV) {
      console.warn(`[pixel] skipped ${key}: invalid value`, params);
    }
    return;
  }

  for (const pixel of pixels) {
    if (pixel.events?.[key] === false) continue;
    if (!initialised.has(pixel.pixel_id)) continue;

    const payload: PixelParams = { ...params };
    if ("value" in payload && !payload.currency) {
      payload.currency = pixel.currency || "DZD";
    }

    // eventID is Meta's dedup key: the same conversion sent server-side later
    // collapses into one.
    fbq(
      "trackSingle",
      pixel.pixel_id,
      EVENT_NAMES[key],
      payload,
      eventId ? { eventID: eventId } : undefined,
    );
  }
}
