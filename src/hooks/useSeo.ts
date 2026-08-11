import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * The canonical origin, WITH the www — `mondoshope.shop` has no DNS record of
 * its own, so a canonical without it points at nothing.
 *
 * The production domain is the default rather than only an env var: when
 * VITE_SITE_URL went unset in Vercel, every canonical, og:url and sitemap entry
 * on the live site silently pointed at the placeholder domain instead. The env
 * var still wins where it is set, which is what preview deploys need.
 */
export const SITE_URL = (
  import.meta.env.VITE_SITE_URL || "https://www.mondoshope.shop"
).replace(/\/$/, "");

interface SeoOptions {
  title?: string;
  description?: string;
  image?: string | null;
  noIndex?: boolean;
  /** Injected as a page-scoped JSON-LD script and removed on unmount. */
  jsonLd?: unknown;
}

function upsertMeta(selector: string, attr: "name" | "property", key: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(selector);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

function upsertLink(rel: string, href: string) {
  let tag = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!tag) {
    tag = document.createElement("link");
    tag.setAttribute("rel", rel);
    document.head.appendChild(tag);
  }
  tag.setAttribute("href", href);
}

/**
 * Per-route title / description / canonical / og tags.
 *
 * This runs in the browser, so it does NOT help social-share crawlers (they do
 * not execute JS — middleware.ts handles those). It does help Googlebot, which
 * does, and it gives correct browser-tab titles per route.
 */
export function useSeo({ title, description, image, noIndex, jsonLd }: SeoOptions) {
  const { pathname } = useLocation();
  const serializedJsonLd = jsonLd ? JSON.stringify(jsonLd) : "";

  useEffect(() => {
    const previousTitle = document.title;
    if (title) document.title = title;

    if (description) {
      upsertMeta('meta[name="description"]', "name", "description", description);
      upsertMeta('meta[property="og:description"]', "property", "og:description", description);
      upsertMeta('meta[name="twitter:description"]', "name", "twitter:description", description);
    }
    if (title) {
      upsertMeta('meta[property="og:title"]', "property", "og:title", title);
      upsertMeta('meta[name="twitter:title"]', "name", "twitter:title", title);
    }
    if (image) {
      upsertMeta('meta[property="og:image"]', "property", "og:image", image);
      upsertMeta('meta[name="twitter:image"]', "name", "twitter:image", image);
    }

    const url = `${SITE_URL}${pathname}`;
    upsertLink("canonical", url);
    upsertMeta('meta[property="og:url"]', "property", "og:url", url);
    upsertMeta(
      'meta[name="robots"]',
      "name",
      "robots",
      noIndex ? "noindex, nofollow" : "index, follow",
    );

    return () => {
      document.title = previousTitle;
    };
  }, [title, description, image, noIndex, pathname]);

  // Depend on the SERIALIZED payload: callers build the object inline, so its
  // identity changes every render.
  useEffect(() => {
    if (!serializedJsonLd) return;
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.textContent = serializedJsonLd;
    script.dataset.pageScoped = "true";
    document.head.appendChild(script);
    // Removed on unmount so a product's schema never lingers on the next route.
    return () => {
      script.remove();
    };
  }, [serializedJsonLd]);
}
