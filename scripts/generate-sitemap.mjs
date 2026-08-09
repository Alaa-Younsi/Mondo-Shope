/**
 * Generates public/sitemap.xml at build time (wired as the `prebuild` script).
 *
 * Product and campaign pages are the money pages and they are database-driven,
 * so a hand-written sitemap goes stale immediately.
 *
 * Bun loads .env automatically — no dotenv dependency needed.
 */
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const DOMAIN = (process.env.VITE_SITE_URL || "https://PLACEHOLDER-DOMAIN.tld").replace(
  /\/$/,
  "",
);
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY;

/**
 * Every entry here must exist in App.tsx's <Route> table — a sitemap that
 * advertises a 404 to Google is worse than one that omits the page.
 */
const STATIC_ROUTES = [
  { path: "/", priority: "1.0", changefreq: "daily" },
  { path: "/shop", priority: "0.9", changefreq: "daily" },
];

const today = new Date().toISOString().slice(0, 10);

function urlEntry({ path, priority, changefreq, lastmod }) {
  return `  <url>
    <loc>${DOMAIN}${path}</loc>
    <lastmod>${lastmod ?? today}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

async function fetchRows(table, query) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return [];
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!response.ok) return [];
    return await response.json();
  } catch {
    return [];
  }
}

const [products, landingPages] = await Promise.all([
  fetchRows("products", "select=slug,updated_at&status=eq.active"),
  fetchRows("landing_pages", "select=slug,updated_at&status=eq.published"),
]);

const entries = [
  ...STATIC_ROUTES.map(urlEntry),
  ...products.map((row) =>
    urlEntry({
      path: `/produit/${row.slug}`,
      priority: "0.8",
      changefreq: "weekly",
      lastmod: row.updated_at?.slice(0, 10),
    }),
  ),
  ...landingPages.map((row) =>
    urlEntry({
      path: `/lp/${row.slug}`,
      priority: "0.7",
      changefreq: "weekly",
      lastmod: row.updated_at?.slice(0, 10),
    }),
  ),
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>
`;

await writeFile(resolve("public/sitemap.xml"), xml, "utf8");

console.log(
  `sitemap.xml written: ${STATIC_ROUTES.length} static, ${products.length} products, ${landingPages.length} landing pages`,
);
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn("  (no Supabase env — only static routes were written)");
}
