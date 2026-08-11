import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import {
  LandingBlockView,
  type LandingSelection,
} from "@/components/landing/LandingBlocks";
import type { GalleryImage } from "@/components/product/Gallery";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState, LoadingBlock } from "@/components/ui/Feedback";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useLandingPage } from "@/hooks/useLandingPages";
import { useSeo } from "@/hooks/useSeo";
import { usePixel } from "@/components/MetaPixelProvider";
import { hexToRgbTriplet } from "@/lib/landing";
import { cn, pick } from "@/lib/utils";
import type { ProductColor } from "@/types/db";

const WIDTHS = {
  narrow: "max-w-2xl",
  normal: "max-w-4xl",
  wide: "max-w-6xl",
} as const;

export default function LandingPageView() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const pixel = usePixel();

  // Admin-only draft preview; RLS decides whether it resolves to anything.
  const preview = searchParams.get("preview") === "1";
  const { data: page, isLoading } = useLandingPage(slug, preview);
  const product = page?.product ?? null;

  const [selection, setSelection] = useState<LandingSelection>({
    quantity: 1,
    colorHex: null,
    colorLabel: null,
    size: null,
    variantPicks: {},
    activeImage: 0,
  });

  const galleryImages = useMemo<GalleryImage[]>(() => {
    if (!product) return [];
    const base = (product.product_images ?? []).map((image) => ({
      key: image.id,
      url: image.url,
      alt: image.alt,
    }));
    const seen = new Set(base.map((entry) => entry.url));
    const colorImages = (product.colors ?? [])
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
  }, [product, lang]);

  // Register the landing slug plus any pixels this page force-enables, so a
  // campaign can fire a pixel no scope rule would have matched.
  useEffect(() => {
    if (!page) return;
    pixel.setContext({
      landingSlug: page.slug,
      extraPixelIds: page.pixel_ids ?? [],
    });
  }, [page, pixel]);

  // Lead reports genuine interest in the campaign, keyed so it fires once.
  const leadFired = useRef<string | null>(null);
  const reportLead = () => {
    if (!page || leadFired.current === page.slug) return;
    leadFired.current = page.slug;
    pixel.track("lead", { content_name: page.slug });
  };

  const seoTitle =
    (lang === "ar" ? page?.seo.title_ar : page?.seo.title_fr) ||
    (lang === "ar" ? page?.title_ar : page?.title_fr) ||
    t("brandName");

  const seoDescription =
    (lang === "ar" ? page?.seo.description_ar : page?.seo.description_fr) || undefined;

  useSeo({
    title: seoTitle,
    description: seoDescription,
    image: page?.seo.og_image ?? galleryImages[0]?.url ?? null,
    // A preview URL must never be the one Google indexes for this campaign.
    noIndex: preview,
  });

  if (isLoading) return <LoadingBlock label={t("loading")} />;

  if (!page) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24">
        <EmptyState
          title={t("lpUnavailable")}
          action={
            <ButtonLink to="/shop" variant="outline" size="sm">
              {t("continueShopping")}
            </ButtonLink>
          }
        />
      </div>
    );
  }

  const accent = hexToRgbTriplet(page.theme.accent);
  const radius = page.theme.radius === "sharp" ? "rounded-none" : "rounded-xl";

  return (
    <div
      // Per-page accent overrides the site token for this subtree only, so the
      // rest of the app keeps the brand colour.
      style={accent ? ({ "--c-brand": accent } as React.CSSProperties) : undefined}
      // The page's own background choice, independent of the visitor's theme.
      // data-theme re-tokens this subtree (see index.css), so bg-bg / text-ink /
      // border-line inside every block follow the campaign's choice rather than
      // the site's. Hardcoding a hex here instead is what previously left light
      // pages drawing the dark theme's near-white ink on a near-white ground.
      className={cn("flex min-h-dvh flex-col bg-bg text-ink")}
      data-theme={page.theme.background}
    >
      {preview && (
        <p className="sticky top-0 z-50 bg-warning px-4 py-2 text-center font-mono text-[11px] uppercase tracking-wider text-black">
          {t("lpPreviewBanner")}
        </p>
      )}

      {page.show_header && <Header />}

      <main
        className={cn("mx-auto w-full flex-1 px-4 sm:px-6", WIDTHS[page.theme.width])}
        onPointerDown={reportLead}
      >
        {page.blocks
          .filter((block) => block.visible)
          .map((block) => (
            <LandingBlockView
              key={block.id}
              block={block}
              product={product}
              slug={page.slug}
              selection={selection}
              onSelectionChange={(patch) =>
                setSelection((current) => ({ ...current, ...patch }))
              }
              galleryImages={galleryImages}
              radius={radius}
              onOrderPlaced={(orderNumber) => navigate(`/commande/${orderNumber}`)}
            />
          ))}
      </main>

      {page.show_footer && <Footer />}
    </div>
  );
}
