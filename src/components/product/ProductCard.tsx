import { Link } from "react-router-dom";
import { Eye } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Price } from "@/components/ui/Price";
import { useLanguage } from "@/i18n/LanguageProvider";
import { discountPercent, pick } from "@/lib/utils";
import type { Product } from "@/types/db";

/**
 * The reference site's card: a hard-edged panel that takes an accent border and
 * halo on hover, with a "view" bar sliding up over the image. The bar is a
 * CSS-only translate — it is decoration on top of a Link, never a second
 * control, so nothing here is keyboard-reachable on its own.
 */
export function ProductCard({ product }: { product: Product }) {
  const { t, lang } = useLanguage();

  const name = pick(lang, product, "name");
  const image = product.product_images?.[0]?.url ?? null;
  const off = discountPercent(product.price, product.compare_at_price);
  const soldOut = product.stock <= 0;
  const category = product.category ? pick(lang, product.category, "name") : null;

  return (
    <Link
      to={`/produit/${product.slug}`}
      className="group relative flex flex-col overflow-hidden border border-line bg-panel transition-all duration-300 hover:border-brand hover:shadow-accent"
    >
      <div className="relative aspect-square overflow-hidden bg-panel-2">
        {image ? (
          <img
            src={image}
            alt={name}
            width={600}
            height={600}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="fx-grid h-full w-full opacity-40" />
        )}

        <div className="absolute inset-0 bg-brand opacity-0 transition-opacity duration-300 group-hover:opacity-10" />

        <div className="absolute start-3 top-3 flex flex-col items-start gap-1.5">
          {off !== null && <Badge tone="brand">-{off}%</Badge>}
          {soldOut && <Badge tone="danger">{t("outOfStock")}</Badge>}
        </div>

        <div className="absolute inset-x-0 bottom-0 flex translate-y-full items-center justify-center gap-2 bg-brand py-2 transition-transform duration-300 group-hover:translate-y-0">
          <Eye size={14} className="text-brand-ink" />
          <span className="font-display text-sm font-bold uppercase tracking-widest text-brand-ink">
            {t("preview")}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1 p-4">
        {category && (
          <p className="truncate font-mono text-xs uppercase tracking-widest text-brand">
            {category}
          </p>
        )}
        <h3 className="line-clamp-2 font-display text-lg font-bold uppercase leading-tight text-ink">
          {name}
        </h3>

        <div className="mt-auto flex flex-wrap items-baseline gap-2 pt-3">
          <Price value={product.price} className="font-mono font-semibold text-ink" />
          {product.compare_at_price && product.compare_at_price > product.price && (
            <Price
              value={product.compare_at_price}
              className="font-mono text-xs text-muted line-through"
            />
          )}
        </div>
      </div>
    </Link>
  );
}
