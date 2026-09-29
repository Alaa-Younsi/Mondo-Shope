import { next } from "@vercel/edge";

/**
 * Link previews for shared product and campaign URLs.
 *
 * Facebook, WhatsApp, Instagram, Twitter and Telegram scrapers do NOT execute
 * JavaScript. On a client-rendered SPA every shared /produit/<slug> link
 * therefore previews as the generic homepage card — a real conversion loss for
 * a store that sells through social and paid ads. This intercepts crawler
 * requests only and answers with a small standalone document carrying the
 * product's own tags. Real visitors fall straight through untouched.
 *
 * DEPLOY REQUIREMENT: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set
 * in the Vercel project env, or this silently degrades to the generic card.
 * Verify after deploy with:
 *   curl -A "facebookexternalhit/1.1" https://<domain>/produit/<slug>
 */
export const config = {
  matcher: ["/produit/:slug*", "/lp/:slug*"],
};

// Production origin as the default, not just an env var: an unset
// VITE_SITE_URL used to make every shared link preview point at a domain that
// does not exist. Keep the www — the apex has no DNS record.
const SITE_URL = (process.env.VITE_SITE_URL || "https://www.mondoshope.shop").replace(
  /\/$/,
  "",
);
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

/**
 * Link-preview scrapers ONLY. Search engines are deliberately absent: Googlebot
 * and Bingbot execute JavaScript and must index the real page — its body copy,
 * internal links and Product JSON-LD. Handing them this two-line card instead
 * would index a stub and serve crawlers different content than shoppers see.
 */
const CRAWLER_RE =
  /facebookexternalhit|facebookcatalog|WhatsApp|Twitterbot|TelegramBot|Discordbot|Slackbot|LinkedInBot|Pinterest|SkypeUriPreview|redditbot|vkShare|instagram/i;

/** Every interpolated field goes through this. */
function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function query(path: string): Promise<unknown[] | null> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!response.ok) return null;
    return (await response.json()) as unknown[];
  } catch {
    return null;
  }
}

interface Card {
  title: string;
  description: string;
  image: string;
  url: string;
  price?: number;
  availability?: string;
}

function render(card: Card): string {
  const priceTags = card.price
    ? `<meta property="product:price:amount" content="${escapeHtml(card.price)}" />
    <meta property="product:price:currency" content="DZD" />
    <meta property="product:availability" content="${escapeHtml(card.availability ?? "in stock")}" />`
    : "";

  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(card.title)}</title>
    <meta name="description" content="${escapeHtml(card.description)}" />
    <link rel="canonical" href="${escapeHtml(card.url)}" />
    <meta property="og:type" content="${card.price ? "product" : "website"}" />
    <meta property="og:site_name" content="Mondo Shope" />
    <meta property="og:title" content="${escapeHtml(card.title)}" />
    <meta property="og:description" content="${escapeHtml(card.description)}" />
    <meta property="og:url" content="${escapeHtml(card.url)}" />
    <meta property="og:image" content="${escapeHtml(card.image)}" />
    <meta property="og:locale" content="fr_FR" />
    <meta property="og:locale:alternate" content="ar_DZ" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(card.title)}" />
    <meta name="twitter:description" content="${escapeHtml(card.description)}" />
    <meta name="twitter:image" content="${escapeHtml(card.image)}" />
    ${priceTags}
  </head>
  <body><h1>${escapeHtml(card.title)}</h1><p>${escapeHtml(card.description)}</p></body>
</html>`;
}

export default async function middleware(request: Request) {
  const userAgent = request.headers.get("user-agent") ?? "";
  // A crawler is never worth a 500: anything unexpected falls through.
  if (!CRAWLER_RE.test(userAgent)) return next();

  try {
    const url = new URL(request.url);
    const segments = url.pathname.split("/").filter(Boolean);
    const kind = segments[0];
    const slug = segments[1];
    if (!slug) return next();

    if (kind === "produit") {
      const rows = await query(
        `products?select=name_fr,description_fr,price,stock,product_images(url,sort_order)&slug=eq.${encodeURIComponent(slug)}&status=eq.active&limit=1`,
      );
      const product = rows?.[0] as
        | {
            name_fr: string;
            description_fr: string | null;
            price: number;
            stock: number;
            product_images: Array<{ url: string; sort_order: number }>;
          }
        | undefined;
      if (!product) return next();

      const image =
        [...(product.product_images ?? [])].sort(
          (a, b) => a.sort_order - b.sort_order,
        )[0]?.url ?? `${SITE_URL}/og-image.png`;

      return new Response(
        render({
          title: `${product.name_fr} | Mondo Shope`,
          description:
            product.description_fr ??
            "Paiement à la livraison dans toutes les wilayas.",
          image,
          url: `${SITE_URL}/produit/${slug}`,
          price: product.price,
          availability: product.stock > 0 ? "in stock" : "out of stock",
        }),
        {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "public, s-maxage=600, stale-while-revalidate=86400",
          },
        },
      );
    }

    if (kind === "lp") {
      const rows = await query(
        `landing_pages?select=title_fr,seo&slug=eq.${encodeURIComponent(slug)}&status=eq.published&limit=1`,
      );
      const page = rows?.[0] as
        | {
            title_fr: string;
            seo: { title_fr?: string; description_fr?: string; og_image?: string | null };
          }
        | undefined;
      if (!page) return next();

      return new Response(
        render({
          title: page.seo?.title_fr || page.title_fr || "Mondo Shope",
          description:
            page.seo?.description_fr ??
            "Paiement à la livraison dans toutes les wilayas.",
          image: page.seo?.og_image || `${SITE_URL}/og-image.png`,
          url: `${SITE_URL}/lp/${slug}`,
        }),
        {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "public, s-maxage=600, stale-while-revalidate=86400",
          },
        },
      );
    }

    return next();
  } catch {
    return next();
  }
}
