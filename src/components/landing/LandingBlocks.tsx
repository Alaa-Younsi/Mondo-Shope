import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Star } from "lucide-react";
import { Gallery, type GalleryImage } from "@/components/product/Gallery";
import { CheckoutForm, type CheckoutLine } from "@/components/checkout/CheckoutForm";
import {
  ColorPicker,
  CustomVariantPicker,
  QuantityStepper,
  SizePicker,
} from "@/components/product/VariantPickers";
import { Price } from "@/components/ui/Price";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useReviews } from "@/hooks/useReviews";
import { resolveIcon } from "@/lib/icons";
import { BLOCK_ANCHOR } from "@/lib/landing";
import { formatPrice } from "@/lib/format";
import { cn, discountPercent, pick } from "@/lib/utils";
import type { LandingBlock, CtaTarget } from "@/types/landing";
import type { Product, ProductColor, VariantSelection } from "@/types/db";

/** The picks the order form submits. Owned by the page, shared by the blocks. */
export interface LandingSelection {
  quantity: number;
  colorHex: string | null;
  colorLabel: string | null;
  size: string | null;
  variantPicks: Record<string, string>;
  activeImage: number;
}

interface BlockProps {
  block: LandingBlock;
  product: Product | null;
  slug: string;
  selection: LandingSelection;
  onSelectionChange: (patch: Partial<LandingSelection>) => void;
  galleryImages: GalleryImage[];
  onOrderPlaced: (orderNumber: string) => void;
  radius: string;
}

function scrollToTarget(target: CtaTarget) {
  const id = BLOCK_ANCHOR[target];
  if (!id) return;
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function CtaButton({
  label,
  target,
  radius,
}: {
  label: string;
  target: CtaTarget;
  radius: string;
}) {
  if (!label.trim()) return null;
  return (
    <button
      type="button"
      onClick={() => scrollToTarget(target)}
      className={cn(
        "fx-sweep inline-flex h-13 items-center justify-center border border-brand bg-brand px-8 text-base font-semibold uppercase tracking-wide text-brand-ink transition-shadow hover:shadow-glow",
        radius,
      )}
    >
      {label}
    </button>
  );
}

function Section({
  children,
  className,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("scroll-mt-6 py-12 sm:py-16", className)}>
      {children}
    </section>
  );
}

function Heading({ text }: { text: string }) {
  if (!text.trim()) return null;
  return (
    <h2 className="mb-8 text-center font-display text-2xl font-bold uppercase tracking-tight text-ink sm:text-3xl">
      {text}
    </h2>
  );
}

/* -------------------------------------------------------------------------- */

export function LandingBlockView({
  block,
  product,
  slug,
  selection,
  onSelectionChange,
  galleryImages,
  onOrderPlaced,
  radius,
}: BlockProps) {
  const { t, lang } = useLanguage();
  const { data: storeReviews } = useReviews(true);

  switch (block.type) {
    case "hero": {
      const data = block.data;
      return (
        <Section id={BLOCK_ANCHOR.top} className="relative overflow-hidden text-center">
          {data.image_url && (
            <div className="mx-auto mb-8 max-w-lg">
              <img
                src={data.image_url}
                alt=""
                width={900}
                height={900}
                loading="eager"
                decoding="async"
                className={cn("w-full object-cover", radius)}
              />
            </div>
          )}
          {pick(lang, data, "eyebrow") && (
            <p className="eyebrow mb-4">{pick(lang, data, "eyebrow")}</p>
          )}
          <h1 className="mx-auto max-w-3xl font-display text-3xl font-bold uppercase leading-tight tracking-tight text-ink sm:text-5xl">
            {pick(lang, data, "title")}
          </h1>
          {pick(lang, data, "subtitle") && (
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted">
              {pick(lang, data, "subtitle")}
            </p>
          )}
          <div className="mt-8">
            <CtaButton
              label={pick(lang, data, "cta_label")}
              target={data.cta_target}
              radius={radius}
            />
          </div>
        </Section>
      );
    }

    case "trust": {
      const data = block.data;
      return (
        <Section className="py-8">
          <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3">
            {data.items.map((item, index) => {
              const Icon = resolveIcon(item.icon);
              return (
                <div
                  key={index}
                  className="flex items-center justify-center gap-2.5 bg-panel px-4 py-5 text-center"
                >
                  <Icon size={18} className="shrink-0 text-brand" />
                  <span className="text-sm text-ink">{pick(lang, item, "label")}</span>
                </div>
              );
            })}
          </div>
        </Section>
      );
    }

    case "bullets": {
      const data = block.data;
      return (
        <Section>
          <Heading text={pick(lang, data, "title")} />
          <ul className="mx-auto max-w-2xl space-y-3">
            {data.items.map((item, index) => (
              <li
                key={index}
                className={cn(
                  "flex gap-3 border border-line bg-panel p-4 text-sm leading-relaxed text-ink",
                  radius,
                )}
              >
                <Check size={18} className="mt-0.5 shrink-0 text-brand" />
                {pick(lang, item, "text")}
              </li>
            ))}
          </ul>
        </Section>
      );
    }

    case "features": {
      const data = block.data;
      return (
        <Section>
          <Heading text={pick(lang, data, "title")} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((item, index) => {
              const Icon = resolveIcon(item.icon);
              return (
                <div
                  key={index}
                  className={cn("border border-line bg-panel p-6", radius)}
                >
                  <Icon size={22} className="text-brand" />
                  <p className="mt-3 font-display text-base font-semibold uppercase tracking-wide text-ink">
                    {pick(lang, item, "title")}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {pick(lang, item, "text")}
                  </p>
                </div>
              );
            })}
          </div>
        </Section>
      );
    }

    case "gallery": {
      const data = block.data;
      const images: GalleryImage[] =
        data.images.length > 0
          ? data.images.map((image, index) => ({
              key: `${block.id}-${index}`,
              url: image.url,
              alt: image.alt,
            }))
          : galleryImages;

      return (
        <Section id={BLOCK_ANCHOR.gallery}>
          <Heading text={pick(lang, data, "title")} />
          <div className="mx-auto max-w-xl">
            <Gallery
              images={images}
              activeIndex={selection.activeImage}
              onActiveChange={(activeImage) => onSelectionChange({ activeImage })}
            />
          </div>
        </Section>
      );
    }

    case "video": {
      const data = block.data;
      const url = data.url || product?.video_url;
      if (!url) return null;
      return (
        <Section>
          <Heading text={pick(lang, data, "title")} />
          <video
            src={url}
            controls
            // Bytes move only on an actual play.
            preload="none"
            poster={data.poster_url ?? galleryImages[0]?.url}
            className={cn("mx-auto w-full max-w-3xl border border-line bg-black", radius)}
          />
        </Section>
      );
    }

    case "text": {
      const data = block.data;
      return (
        <Section>
          <Heading text={pick(lang, data, "title")} />
          <div
            className={cn(
              "mx-auto max-w-2xl whitespace-pre-line text-sm leading-relaxed text-muted",
              data.align === "center" && "text-center",
            )}
          >
            {pick(lang, data, "body")}
          </div>
        </Section>
      );
    }

    case "offer": {
      const data = block.data;
      if (!product) return null;
      const off = discountPercent(product.price, product.compare_at_price);

      return (
        <Section id={BLOCK_ANCHOR.offer}>
          <Heading text={pick(lang, data, "title")} />
          <div
            className={cn(
              "mx-auto max-w-md border border-brand/40 bg-brand/5 p-8 text-center",
              radius,
            )}
          >
            <div className="flex flex-wrap items-baseline justify-center gap-3">
              <Price value={product.price} className="font-display text-4xl font-bold text-brand" />
              {data.show_compare_at &&
                product.compare_at_price &&
                product.compare_at_price > product.price && (
                  <Price
                    value={product.compare_at_price}
                    className="text-lg text-muted line-through"
                  />
                )}
            </div>

            {off !== null && (
              <p className="mt-2 font-mono text-xs uppercase tracking-widest text-brand">
                -{off}%
              </p>
            )}

            {product.quantity_offers.length > 0 && (
              <ul className="mt-5 space-y-1.5 text-sm text-ink">
                {product.quantity_offers.map((offer, index) => (
                  <li key={index}>
                    {offer.type === "free"
                      ? t("offerBuyGet", { buy: offer.buy, get: offer.get })
                      : t("offerBundle", { qty: offer.qty, price: formatPrice(offer.price) })}
                  </li>
                ))}
              </ul>
            )}

            {pick(lang, data, "note") && (
              <p className="mt-4 text-xs leading-relaxed text-muted">
                {pick(lang, data, "note")}
              </p>
            )}

            <div className="mt-7">
              <CtaButton
                label={pick(lang, data, "cta_label")}
                target={data.cta_target}
                radius={radius}
              />
            </div>
          </div>
        </Section>
      );
    }

    case "reviews": {
      const data = block.data;
      const entries =
        data.source === "store"
          ? (storeReviews ?? []).map((review) => ({
              name: review.client_name,
              stars: review.stars,
              text: review.review_text,
              image_url: review.image_url,
            }))
          : data.items.map((item) => ({
              name: item.name,
              stars: item.stars,
              text: pick(lang, item, "text"),
              image_url: item.image_url,
            }));

      if (entries.length === 0) return null;

      return (
        <Section>
          <Heading text={pick(lang, data, "title")} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {entries.slice(0, 9).map((entry, index) => (
              <figure key={index} className={cn("border border-line bg-panel p-5", radius)}>
                <div className="mb-3 flex gap-0.5 text-brand" dir="ltr">
                  {Array.from({ length: 5 }, (_, star) => (
                    <Star
                      key={star}
                      size={13}
                      fill={star < entry.stars ? "currentColor" : "none"}
                      className={star < entry.stars ? "" : "text-line"}
                    />
                  ))}
                </div>
                <blockquote className="text-sm leading-relaxed text-muted">
                  {entry.text}
                </blockquote>
                <figcaption className="mt-4 flex items-center gap-3">
                  {entry.image_url && (
                    <img
                      src={entry.image_url}
                      alt=""
                      width={32}
                      height={32}
                      loading="lazy"
                      decoding="async"
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  )}
                  <span className="text-sm font-medium text-ink">{entry.name}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </Section>
      );
    }

    case "faq": {
      const data = block.data;
      return (
        <Section>
          <Heading text={pick(lang, data, "title") || t("lpFaqTitle")} />
          <div className="mx-auto max-w-2xl space-y-2">
            {data.items.map((item, index) => (
              <details
                key={index}
                className={cn("group border border-line bg-panel p-4", radius)}
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-ink">
                  {pick(lang, item, "q")}
                  <ChevronDown
                    size={16}
                    className="shrink-0 text-muted transition-transform group-open:rotate-180"
                  />
                </summary>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted">
                  {pick(lang, item, "a")}
                </p>
              </details>
            ))}
          </div>
        </Section>
      );
    }

    case "countdown":
      return <CountdownBlock block={block} radius={radius} />;

    case "cta": {
      const data = block.data;
      return (
        <Section className="text-center">
          <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-ink sm:text-3xl">
            {pick(lang, data, "title")}
          </h2>
          {pick(lang, data, "subtitle") && (
            <p className="mx-auto mt-3 max-w-lg text-sm text-muted">
              {pick(lang, data, "subtitle")}
            </p>
          )}
          <div className="mt-7">
            <CtaButton
              label={pick(lang, data, "label")}
              target={data.target}
              radius={radius}
            />
          </div>
        </Section>
      );
    }

    case "order_form": {
      const data = block.data;
      if (!product) return null;

      const soldOut = product.stock <= 0;

      const variants: VariantSelection[] = product.variants
        .filter((group) => selection.variantPicks[group.name_fr])
        .map((group) => ({
          name_fr: group.name_fr,
          name_ar: group.name_ar,
          value: selection.variantPicks[group.name_fr],
        }));

      const lines: CheckoutLine[] = [
        {
          productId: product.id,
          name: pick(lang, product, "name"),
          price: Number(product.price),
          quantity: selection.quantity,
          color: selection.colorLabel,
          size: selection.size,
          variants,
          offers: product.quantity_offers,
        },
      ];

      return (
        <Section id={BLOCK_ANCHOR.order_form}>
          <div className={cn("mx-auto max-w-xl border border-line bg-panel p-6 sm:p-8", radius)}>
            <h2 className="mb-2 text-center font-display text-2xl font-bold uppercase tracking-tight text-ink">
              {pick(lang, data, "title") || t("lpOrderNow")}
            </h2>
            {pick(lang, data, "note") && (
              <p className="mb-6 text-center text-sm text-muted">{pick(lang, data, "note")}</p>
            )}

            {soldOut ? (
              <p className="rounded-lg border border-danger/40 bg-danger/10 p-4 text-center text-sm text-danger">
                {t("outOfStock")}
              </p>
            ) : (
              <div className="space-y-5">
                <ColorPicker
                  colors={product.colors}
                  selectedHex={selection.colorHex}
                  onSelect={(hex, label) => {
                    const color = product.colors.find(
                      (entry: ProductColor) => entry.hex === hex,
                    );
                    const index = color?.image_url
                      ? galleryImages.findIndex((entry) => entry.url === color.image_url)
                      : -1;
                    onSelectionChange({
                      colorHex: hex,
                      colorLabel: label,
                      ...(index >= 0 ? { activeImage: index } : {}),
                    });
                  }}
                />

                <SizePicker
                  sizes={product.sizes}
                  selected={selection.size}
                  onSelect={(size) => onSelectionChange({ size })}
                />

                <CustomVariantPicker
                  groups={product.variants}
                  selections={selection.variantPicks}
                  onSelect={(groupName, value) =>
                    onSelectionChange({
                      variantPicks: { ...selection.variantPicks, [groupName]: value },
                    })
                  }
                />

                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted">
                    {t("quantity")}
                  </span>
                  <QuantityStepper
                    value={selection.quantity}
                    onChange={(quantity) => onSelectionChange({ quantity })}
                    max={product.stock}
                  />
                </div>

                <CheckoutForm
                  lines={lines}
                  compact
                  source={`lp:${slug}`}
                  askAddress={data.ask_address}
                  askNotes={data.ask_notes}
                  submitLabel={t("lpOrderNow")}
                  onSuccess={onOrderPlaced}
                />
              </div>
            )}
          </div>
        </Section>
      );
    }

    case "spacer": {
      const heights = { sm: "h-6", md: "h-14", lg: "h-24" };
      return <div className={heights[block.data.size] ?? heights.md} />;
    }

    default:
      // Unknown block types are ignored, never rendered as an error.
      return null;
  }
}

/* -------------------------------------------------------------------------- */

function CountdownBlock({ block, radius }: { block: LandingBlock; radius: string }) {
  const { t, lang } = useLanguage();
  const data = block.type === "countdown" ? block.data : null;
  const endsAt = data?.ends_at ?? null;

  const target = useMemo(() => (endsAt ? new Date(endsAt).getTime() : null), [endsAt]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!target) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [target]);

  if (!data || !target || Number.isNaN(target)) return null;

  const remaining = Math.max(0, target - now);
  const expired = remaining <= 0;

  const seconds = Math.floor(remaining / 1000);
  const parts = [
    { value: Math.floor(seconds / 86400), label: t("lpDays") },
    { value: Math.floor((seconds % 86400) / 3600), label: t("lpHours") },
    { value: Math.floor((seconds % 3600) / 60), label: t("lpMinutes") },
    { value: seconds % 60, label: t("lpSeconds") },
  ];

  return (
    <Section className="text-center">
      <Heading text={pick(lang, data, "title")} />

      {expired ? (
        <p className="text-sm text-muted">{t("lpExpired")}</p>
      ) : (
        <div dir="ltr" className="flex justify-center gap-3">
          {parts.map((part) => (
            <div
              key={part.label}
              className={cn("min-w-16 border border-line bg-panel px-3 py-4", radius)}
            >
              <p className="font-display text-2xl font-bold tabular-nums text-brand">
                {String(part.value).padStart(2, "0")}
              </p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted">
                {part.label}
              </p>
            </div>
          ))}
        </div>
      )}

      {pick(lang, data, "note") && (
        <p className="mt-5 text-xs text-muted">{pick(lang, data, "note")}</p>
      )}
    </Section>
  );
}
