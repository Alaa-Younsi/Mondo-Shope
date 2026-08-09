import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";
import { useActivePixels } from "@/hooks/useMetaPixels";
import {
  initPixels,
  matchPixels,
  trackEvent,
  type PixelParams,
} from "@/lib/metaPixel";
import type { PixelEventKey } from "@/types/db";

interface RouteContext {
  productSlug: string | null;
  landingSlug: string | null;
  extraPixelIds: string[];
}

interface PixelContextValue {
  track: (key: PixelEventKey, params?: PixelParams, eventId?: string) => void;
  setContext: (next: Partial<RouteContext>) => void;
}

const PixelCtx = createContext<PixelContextValue | null>(null);

const EMPTY_CONTEXT: RouteContext = {
  productSlug: null,
  landingSlug: null,
  extraPixelIds: [],
};

export function MetaPixelProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { data: pixels } = useActivePixels();
  const [routeContext, setRouteContext] = useState<RouteContext>(EMPTY_CONTEXT);

  // Firing conversions while the owner clicks around their own dashboard
  // poisons every campaign's data with staff traffic.
  const isAdmin = pathname.startsWith("/admin");

  // A route that unmounts must not leave its slug behind for the next one.
  useEffect(() => {
    setRouteContext(EMPTY_CONTEXT);
  }, [pathname]);

  const matched = useMemo(() => {
    if (isAdmin || !pixels || pixels.length === 0) return [];
    return matchPixels(pixels, {
      pathname,
      productSlug: routeContext.productSlug,
      landingSlug: routeContext.landingSlug,
      extraPixelIds: routeContext.extraPixelIds,
    });
  }, [isAdmin, pixels, pathname, routeContext]);

  useEffect(() => {
    if (matched.length > 0) initPixels(matched);
  }, [matched]);

  /**
   * PageView bookkeeping is per (path, pixel id), not per path. A product page
   * registers its slug one render AFTER it mounts, which widens the matched
   * set; a plain "already sent for this path" flag would either double-fire the
   * first batch or never fire the newly-matched ones.
   */
  const sent = useRef<{ path: string; ids: Set<string> }>({
    path: "",
    ids: new Set(),
  });

  useEffect(() => {
    if (matched.length === 0) return;

    if (sent.current.path !== pathname) {
      sent.current = { path: pathname, ids: new Set() };
    }

    const fresh = matched.filter((pixel) => !sent.current.ids.has(pixel.pixel_id));
    if (fresh.length === 0) return;

    for (const pixel of fresh) sent.current.ids.add(pixel.pixel_id);
    trackEvent(fresh, "page_view");
  }, [matched, pathname]);

  const track = useCallback(
    (key: PixelEventKey, params?: PixelParams, eventId?: string) => {
      if (matched.length === 0) return;
      trackEvent(matched, key, params, eventId);
    },
    [matched],
  );

  /**
   * Bail out when the value is unchanged. Routes call this from an effect whose
   * deps are recreated each render — without the guard it is an infinite
   * re-render loop.
   */
  const setContext = useCallback((next: Partial<RouteContext>) => {
    setRouteContext((current) => {
      const merged = { ...current, ...next };
      if (
        merged.productSlug === current.productSlug &&
        merged.landingSlug === current.landingSlug &&
        merged.extraPixelIds.join() === current.extraPixelIds.join()
      ) {
        return current;
      }
      return merged;
    });
  }, []);

  const value = useMemo<PixelContextValue>(
    () => ({ track, setContext }),
    [track, setContext],
  );

  return <PixelCtx.Provider value={value}>{children}</PixelCtx.Provider>;
}

export function usePixel(): PixelContextValue {
  const ctx = useContext(PixelCtx);
  if (!ctx) throw new Error("usePixel must be used inside <MetaPixelProvider>");
  return ctx;
}
