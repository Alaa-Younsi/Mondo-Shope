import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Check, ShoppingCart, Tag } from "lucide-react";
import { Gallery, type GalleryImage } from "@/components/product/Gallery";
import {
  ColorPicker,
  CustomVariantPicker,
  QuantityStepper,
  SizePicker,
} from "@/components/product/VariantPickers";
import { ProductCard } from "@/components/product/ProductCard";
import type { CheckoutLine } from "@/components/checkout/CheckoutForm";
import { LazyCheckoutForm } from "@/components/checkout/LazyCheckoutForm";
import { loadCheckoutForm } from "@/components/checkout/loadCheckoutForm";
import { Button } from "@/components/ui/Button";
import { Badge, SectionHeading } from "@/components/ui/Badge";
import { EmptyState, LoadingBlock } from "@/components/ui/Feedback";
import { Discount, Price } from "@/components/ui/Price";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useProduct, useRelatedProducts } from "@/hooks/useCatalog";
import { useSeo, SITE_URL } from "@/hooks/useSeo";
import { usePixel } from "@/components/MetaPixelProvider";
import { useCart } from "@/store/cart";
import { MAX_QTY_PER_LINE } from "@/lib/limits";
import { discountPercent, pick } from "@/lib/utils";
import {
  availableStock,
  isSoldOut,
  missingChoices,
  optionAvailability,
  sizeAfterColorChange,
} from "@/lib/variantStock";
import { formatPrice } from "@/lib/format";
import type { ProductColor, VariantSelection } from "@/types/db";

export default function Product() {
  const { slug } = useParams<{ slug: string }>();
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const pixel = usePixel();
  const addItem = useCart((state) => state.addItem);

  const { data: product, isLoading } = useProduct(slug);
  const { data: related } = useRelatedProducts(product?.category_id ?? null, product?.id);

  const [activeImage, setActiveImage] = useState(0);
  const [colorHex, setColorHex] = useState<string | null>(null);
  const [colorLabel, setColorLabel] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [variantPicks, setVariantPicks] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  // Memoised so the `?? []` fallbacks do not produce a new array identity on
  // every render and re-run the gallery memo below.
  const images = useMemo(() => product?.product_images ?? [], [product]);
  const colors = useMemo(() => product?.colors ?? [], [product]);

  // Real product_images come FIRST so images[0] stays what gets snapshotted
  // into the cart line — never a colour photo.
  const galleryImages = useMemo<GalleryImage[]>(() => {
    const base = images.map((image) => ({
      key: image.id,
      url: image.url,
      alt: image.alt,
    }));
    const seen = new Set(base.map((entry) => entry.url));
    const colorImages = colors
      .filter(
        (color): color is ProductColor & { image_url: string } =>
          !!color.image_url && !seen.has(color.image_url),
      )
      .map((color) => ({
        key: `color-${color.hex}`,
        url: color.image_url,
        alt: pick(lang, color, "label"),
      }));
    return [...base, ...colorImages];
  }, [images, colors, lang]);

  // The buy-now form is below the fold and code-split; start fetching it now so
  // it is ready long before the shopper scrolls to it.
  useEffect(() => {
    void loadCheckoutForm();
  }, []);

  // Register this route's slug so landing/product-scoped pixels match it.
  useEffect(() => {
    if (product?.slug) pixel.setContext({ productSlug: product.slug });
  }, [product?.slug, pixel]);

  // Value-compared ref: pixel.track's identity changes when the matched set
  // widens, so an unguarded effect would refire ViewContent.
  const viewedId = useRef<string | null>(null);
  useEffect(() => {
    if (!product || viewedId.current === product.id) return;
    viewedId.current = product.id;
    pixel.track("view_content", {
      content_ids: [product.id],
      content_name: pick(lang, product, "name"),
      content_type: "product",
      // A numeric Postgres column can arrive over PostgREST as a string.
      value: Number(product.price),
      currency: "DZD",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  const name = product ? pick(lang, product, "name") : "";
  const description = product ? pick(lang, product, "description") : "";
  const details = product
    ? lang === "ar" && product.details_ar.length > 0
      ? product.details_ar
      : product.details_fr
    : [];

  useSeo({
    title: product ? `${name} | ${t("brandName")}` : t("brandName"),
    description: description || t("brandTagline"),
    image: images[0]?.url ?? null,
    jsonLd: product
      ? {
          "@context": "https://schema.org",
          "@type": "Product",
          name,
          description,
          image: images.map((image) => image.url),
          sku: product.style_code ?? product.slug,
          brand: { "@type": "Brand", name: t("brandName") },
          offers: {
            "@type": "Offer",
            priceCurrency: "DZD",
            price: Number(product.price),
            url: `${SITE_URL}/produit/${product.slug}`,
            availability: isSoldOut(product)
              ? "https://schema.org/OutOfStock"
              : "https://schema.org/InStock",
            seller: { "@type": "Organization", name: t("brandName") },
          },
        }
      : undefined,
  });

  if (isLoading) return <LoadingBlock label={t("loading")} />;
  if (!product) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24">
        <EmptyState title={t("productNotFound")} />
      </div>
    );
  }

  // Sold out when the product pool is empty OR some axis has no option left —
  // a shirt with every size at zero is not buyable whatever the total says.
  const soldOut = isSoldOut(product);
  const off = discountPercent(product.price, product.compare_at_price);

  const choice = { colorHex, size, variantPicks };
  // The ceiling is the smallest pool among everything actually selected — the
  // grid cell under a stock grid, the per-axis pools otherwise. Used only to
  // cap the stepper; the number itself is never shown.
  const stockLeft = availableStock(product, choice);
  const missing = missingChoices(product, choice);
  const can = optionAvailability(product, choice);

  /*
   * Clamped at render rather than in a state effect.
   *
   * Switching from a combination with 10 left to one with 2 leaves `quantity`
   * at whatever the stepper was pushed to, and the stepper's own `max` only
   * gates the + button. Deriving the effective quantity here means the cart
   * line, the inline checkout and the stepper all read the same clamped number
   * on the very render the selection changed, with no hook ordering to get
   * wrong above the early returns.
   */
  const qty = Math.min(quantity, Math.max(1, stockLeft), MAX_QTY_PER_LINE);

  const buildVariants = (): VariantSelection[] =>
    product.variants
      .filter((group) => variantPicks[group.name_fr])
      .map((group) => ({
        name_fr: group.name_fr,
        name_ar: group.name_ar,
        value: variantPicks[group.name_fr],
      }));

  const checkoutLines: CheckoutLine[] = [
    {
      productId: product.id,
      name,
      price: Number(product.price),
      quantity: qty,
      color: colorLabel,
      size,
      variants: buildVariants(),
      offers: product.quantity_offers,
    },
  ];

  const handleAddToCart = () => {
    addItem({
      productId: product.id,
      slug: product.slug,
      nameFr: product.name_fr,
      nameAr: product.name_ar,
      price: Number(product.price),
      image: images[0]?.url ?? null,
      quantity: qty,
      color: colorLabel,
      size,
      variants: buildVariants(),
      offers: product.quantity_offers,
      maxStock: stockLeft,
    });

    // An event handler, not an effect — no StrictMode double-invoke concern.
    pixel.track("add_to_cart", {
      content_ids: [product.id],
      content_name: name,
      content_type: "product",
      value: Number(product.price) * qty,
      currency: "DZD",
    });

    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid gap-10 lg:grid-cols-2">
        <Gallery
          images={galleryImages}
          activeIndex={activeImage}
          onActiveChange={setActiveImage}
        />

        <div className="space-y-6">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {off !== null && (
                <Badge tone="brand">
                  <Discount value={off} />
                </Badge>
              )}
              {/* In stock / out of stock, and nothing finer. The old "N left"
                  badge is deliberately gone — see VariantPickers. */}
              <Badge tone={soldOut ? "danger" : "success"}>
                {soldOut ? t("outOfStock") : t("inStock")}
              </Badge>
            </div>

            <h1 className="font-display text-3xl font-bold uppercase leading-tight tracking-tight text-ink sm:text-4xl">
              {name}
            </h1>

            <div className="mt-4 flex flex-wrap items-baseline gap-3">
              <Price value={product.price} className="font-display text-3xl font-bold text-brand" />
              {product.compare_at_price && product.compare_at_price > product.price && (
                <Price
                  value={product.compare_at_price}
                  className="text-base text-muted line-through"
                />
              )}
            </div>
          </div>

          {product.quantity_offers.length > 0 && (
            <div className="space-y-2 rounded-xl border border-brand/40 bg-brand/5 p-4">
              <p className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wide text-brand">
                <Tag size={15} />
                {t("specialOffers")}
              </p>
              <ul className="space-y-1 text-sm text-ink">
                {product.quantity_offers.map((offer, index) => (
                  <li key={index}>
                    {offer.type === "free"
                      ? t("offerBuyGet", { buy: offer.buy, get: offer.get })
                      : t("offerBundle", {
                          qty: offer.qty,
                          price: formatPrice(offer.price),
                        })}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <ColorPicker
            colors={colors}
            isAvailable={can.color}
            selectedHex={colorHex}
            onSelect={(hex, label) => {
              setColorHex(hex);
              setColorLabel(label);
              // Under a grid the chosen size may not exist in the new colour;
              // keeping it would arm the add button with a pairing the server
              // rejects.
              setSize((current) => sizeAfterColorChange(product, hex, current));
              const color = colors.find((entry) => entry.hex === hex);
              if (color?.image_url) {
                const index = galleryImages.findIndex(
                  (entry) => entry.url === color.image_url,
                );
                if (index >= 0) setActiveImage(index);
              }
            }}
          />

          <SizePicker
            sizes={product.sizes}
            isAvailable={can.size}
            selected={size}
            onSelect={setSize}
          />

          <CustomVariantPicker
            groups={product.variants}
            isAvailable={can.custom}
            selections={variantPicks}
            onSelect={(groupName, value, imageUrl) => {
              setVariantPicks((current) => ({ ...current, [groupName]: value }));
              // Same behaviour colours already had: a value with its own photo
              // jumps the gallery to it.
              if (imageUrl) {
                const index = galleryImages.findIndex((entry) => entry.url === imageUrl);
                if (index >= 0) setActiveImage(index);
              }
            }}
          />

          {!soldOut && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <QuantityStepper value={qty} onChange={setQuantity} max={stockLeft} />
                <Button
                  onClick={handleAddToCart}
                  size="lg"
                  className="flex-1"
                  // place_order() rejects a missing choice outright, so blocking
                  // here is what keeps that from becoming a mystery error after
                  // the customer has typed their phone number.
                  disabled={missing.length > 0 || stockLeft <= 0}
                >
                  {added ? <Check size={16} /> : <ShoppingCart size={16} />}
                  {added ? t("addedToCart") : t("addToCart")}
                </Button>
              </div>
              {missing.length > 0 && (
                <p className="text-xs text-muted">
                  {t("chooseOptionsFirst", {
                    options: missing
                      .map((entry) =>
                        entry.kind === "color"
                          ? t("chooseColor")
                          : entry.kind === "size"
                            ? t("chooseSize")
                            : entry.group
                              ? pick(lang, entry.group, "name")
                              : "",
                      )
                      .join(", "),
                  })}
                </p>
              )}
            </div>
          )}

          {description && (
            <div>
              <p className="eyebrow mb-2">{t("productDescription")}</p>
              <p className="whitespace-pre-line text-sm leading-relaxed text-muted">
                {description}
              </p>
            </div>
          )}

          {details.length > 0 && (
            <div>
              <p className="eyebrow mb-2">{t("productDetails")}</p>
              <ul className="space-y-1.5">
                {details.map((detail, index) => (
                  <li key={index} className="flex gap-2 text-sm text-muted">
                    <Check size={15} className="mt-0.5 shrink-0 text-brand" />
                    {detail}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Product video. preload="none" — the page renders one <video> per
          breakpoint, so preload="metadata" would fetch bytes twice on every
          product view even when nobody presses play. */}
      {product.video_url && (
        <section className="mt-14">
          <SectionHeading title={t("watchVideo")} />
          <video
            src={product.video_url}
            controls
            preload="none"
            poster={images[0]?.url}
            className="w-full rounded-xl border border-line bg-black"
          />
        </section>
      )}

      {/* Inline "buy now" — bypasses the cart entirely. */}
      {!soldOut && (
        <section className="mt-16 scroll-mt-24" id="commander">
          <div className="mx-auto max-w-2xl rounded-2xl border border-line bg-panel p-6 sm:p-8">
            <SectionHeading title={t("buyNow")} subtitle={t("checkoutSubtitle")} align="center" />
            <LazyCheckoutForm
              lines={checkoutLines}
              compact
              submitLabel={t("placeOrder")}
              onSuccess={(orderNumber) => navigate(`/commande/${orderNumber}`)}
            />
          </div>
        </section>
      )}

      {(related ?? []).length > 0 && (
        <section className="mt-20">
          <SectionHeading title={t("relatedProducts")} />
          <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
            {(related ?? []).map((entry) => (
              <ProductCard key={entry.id} product={entry} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
