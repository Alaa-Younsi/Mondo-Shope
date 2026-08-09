import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { ProductCard } from "@/components/product/ProductCard";
import { EmptyState, ProductCardSkeleton } from "@/components/ui/Feedback";
import { Input, Select } from "@/components/ui/Form";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useCategories, useProducts, type ProductFilters } from "@/hooks/useCatalog";
import { usePixel } from "@/components/MetaPixelProvider";
import { useSeo } from "@/hooks/useSeo";
import { cn, pick } from "@/lib/utils";

export default function Shop() {
  const { t, lang } = useLanguage();
  const pixel = usePixel();
  const [searchParams, setSearchParams] = useSearchParams();

  const categorySlug = searchParams.get("categorie");
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [debounced, setDebounced] = useState(search);
  const [sort, setSort] = useState<ProductFilters["sort"]>("newest");

  const { data: categories } = useCategories();
  const activeCategory = useMemo(
    () => (categories ?? []).find((category) => category.slug === categorySlug) ?? null,
    [categories, categorySlug],
  );

  const { data: products, isLoading } = useProducts({
    categoryId: activeCategory?.id ?? null,
    search: debounced,
    sort,
  });

  useSeo({
    title: `${activeCategory ? pick(lang, activeCategory, "name") : t("shopTitle")} | ${t("brandName")}`,
    description: t("shopSubtitle"),
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search), 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  // Report Search once the debounced term settles, not on every keystroke.
  useEffect(() => {
    if (!debounced.trim()) return;
    pixel.track("search", { search_string: debounced.trim() });
    // pixel.track's identity changes whenever the matched pixel set widens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const selectCategory = (slug: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (slug) next.set("categorie", slug);
    else next.delete("categorie");
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <header className="mb-8">
        <p className="eyebrow mb-2">{t("navShop")}</p>
        <h1 className="font-display text-3xl font-bold uppercase tracking-tight text-ink sm:text-4xl">
          {activeCategory ? pick(lang, activeCategory, "name") : t("shopTitle")}
        </h1>
        <p className="mt-2 text-sm text-muted">{t("shopSubtitle")}</p>
      </header>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("searchPlaceholder")}
            className="ps-9"
            aria-label={t("search")}
          />
        </div>
        <Select
          value={sort}
          onChange={(event) => setSort(event.target.value as ProductFilters["sort"])}
          aria-label={t("sortLabel")}
          className="sm:w-48"
        >
          <option value="newest">{t("sortNewest")}</option>
          <option value="price-asc">{t("sortPriceAsc")}</option>
          <option value="price-desc">{t("sortPriceDesc")}</option>
        </Select>
      </div>

      {/* Category chips scroll horizontally; wrapping changes the row height
          between FR and AR and reflows the grid under the user's thumb. */}
      {(categories ?? []).length > 0 && (
        <div className="no-scrollbar mb-8 flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => selectCategory(null)}
            className={cn(
              "shrink-0 rounded-full border px-4 py-2 font-mono text-xs uppercase tracking-wider transition-colors",
              !activeCategory
                ? "border-brand bg-brand/10 text-brand"
                : "border-line text-muted hover:border-muted hover:text-ink",
            )}
          >
            {t("all")}
          </button>
          {(categories ?? []).map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => selectCategory(category.slug)}
              className={cn(
                "shrink-0 rounded-full border px-4 py-2 font-mono text-xs uppercase tracking-wider transition-colors",
                activeCategory?.id === category.id
                  ? "border-brand bg-brand/10 text-brand"
                  : "border-line text-muted hover:border-muted hover:text-ink",
              )}
            >
              {pick(lang, category, "name")}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <ProductCardSkeleton key={index} />
          ))}
        </div>
      ) : (products ?? []).length === 0 ? (
        <EmptyState title={t("noProducts")} text={t("noProductsHint")} />
      ) : (
        <>
          <p className="mb-4 font-mono text-xs text-muted">
            <span dir="ltr">{products?.length}</span> {t("productsFound")}
          </p>
          <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
            {(products ?? []).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
