import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { BadgeCheck, ChevronRight, Phone, ShieldCheck, Star, Truck } from "lucide-react";
import { HeroArt } from "@/components/effects/HeroArt";
import { HeroSlider } from "@/components/effects/HeroSlider";
import { ButtonLink } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/Badge";
import { ProductCard } from "@/components/product/ProductCard";
import { ProductCardSkeleton } from "@/components/ui/Feedback";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useCategories, useFeaturedProducts } from "@/hooks/useCatalog";
import { useReviews } from "@/hooks/useReviews";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { usePrefersReducedMotion } from "@/hooks/useMediaFlags";
import { useSeo, SITE_URL } from "@/hooks/useSeo";
import { pick } from "@/lib/utils";
import type { HeroSlide, Product } from "@/types/db";

const TRUST = [
  { icon: ShieldCheck, title: "trustCod", text: "trustCodText" },
  { icon: Truck, title: "trustDelivery", text: "trustDeliveryText" },
  { icon: BadgeCheck, title: "trustQuality", text: "trustQualityText" },
  { icon: Phone, title: "trustSupport", text: "trustSupportText" },
] as const;

const STEPS = [
  { title: "howStep1Title", text: "howStep1Text" },
  { title: "howStep2Title", text: "howStep2Text" },
  { title: "howStep3Title", text: "howStep3Text" },
] as const;

const RISE = { initial: { opacity: 0, y: 30 }, animate: { opacity: 1, y: 0 } };

/**
 * Counts up to `target` the first time it scrolls into view. Static under
 * prefers-reduced-motion — handled by the caller, which passes `animate`.
 */
function StatCounter({
  target,
  label,
  animate,
}: {
  target: number;
  label: string;
  animate: boolean;
}) {
  const [value, setValue] = useState(animate ? 0 : target);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!animate) {
      setValue(target);
      return;
    }
    const node = ref.current;
    if (!node) return;

    let timer: number | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || timer !== undefined) return;
        const step = Math.max(1, Math.ceil(target / 40));
        let current = 0;
        timer = window.setInterval(() => {
          current += step;
          if (current >= target) {
            setValue(target);
            window.clearInterval(timer);
          } else {
            setValue(current);
          }
        }, 30);
      },
      { threshold: 0.5 },
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
      if (timer !== undefined) window.clearInterval(timer);
    };
  }, [target, animate]);

  return (
    <div ref={ref} className="text-center">
      <div dir="ltr" className="font-mono text-2xl font-bold text-brand">
        {value}
      </div>
      <div className="mt-1 font-mono text-xs uppercase tracking-widest text-muted">
        {label}
      </div>
    </div>
  );
}

/** A repeating band of copy, doubled so the -50% translate loops seamlessly. */
function Marquee({
  text,
  reverse,
  className,
}: {
  text: string;
  reverse?: boolean;
  className: string;
}) {
  return (
    <div className={className}>
      <div className="marquee-container">
        <div className={reverse ? "marquee-track-reverse" : "marquee-track"}>
          {Array.from({ length: 8 }, (_, index) => (
            <span key={index} className="px-6 uppercase">
              {text} •
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Falls back to the featured products' own photos so the hero is never an empty
 * frame on a store that has not filled the slider in admin yet.
 */
function fallbackSlides(products: Product[]): HeroSlide[] {
  return products
    .flatMap((product) => {
      const image = product.product_images?.[0]?.url;
      if (!image) return [];
      return [
        {
          id: product.id,
          image_url: image,
          title_fr: product.name_fr,
          title_ar: product.name_ar,
          subtitle_fr: null,
          subtitle_ar: null,
          link_url: `/produit/${product.slug}`,
        },
      ];
    })
    .slice(0, 5);
}

export default function Landing() {
  const { t, lang } = useLanguage();
  const { data: featured, isLoading: featuredLoading } = useFeaturedProducts(8);
  const { data: categories } = useCategories();
  const { data: reviews } = useReviews(true);
  const { data: settings } = useStoreSettings();
  const reducedMotion = usePrefersReducedMotion();

  useSeo({
    title: `${t("heroTitle")} | ${t("brandName")}`,
    description: t("heroSubtitle"),
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Store",
      name: t("brandName"),
      url: `${SITE_URL}/`,
      areaServed: "Algérie",
      paymentAccepted: "Cash on delivery",
    },
  });

  const adminSlides = settings?.hero_slides ?? [];
  const slides = adminSlides.length > 0 ? adminSlides : fallbackSlides(featured ?? []);

  const categoryCount = (categories ?? []).length;
  const reviewCount = (reviews ?? []).length;

  return (
    <>
      {/* Hero ------------------------------------------------------------- */}
      <section className="relative overflow-hidden border-b border-line">
        <HeroArt />

        <div className="relative z-10 mx-auto flex max-w-7xl flex-col items-center gap-10 px-4 py-16 sm:px-6 lg:flex-row lg:gap-12 lg:px-8 lg:py-24">
          <motion.div
            initial="initial"
            animate="animate"
            transition={{ staggerChildren: 0.15 }}
            className="w-full lg:w-1/2"
          >
            <motion.p
              variants={RISE}
              transition={{ duration: 0.6 }}
              className="mb-4 font-mono text-sm uppercase tracking-[0.3em] text-muted"
            >
              {t("heroEyebrow")}
            </motion.p>

            <motion.h1
              variants={RISE}
              transition={{ duration: 0.6 }}
              data-text={t("heroTitle")}
              className="glitch-text mb-2 font-display font-black uppercase leading-none text-ink"
              style={{ fontSize: "clamp(38px, 5.5vw, 76px)" }}
            >
              {t("heroTitle")}
            </motion.h1>

            <motion.p
              variants={RISE}
              transition={{ duration: 0.6 }}
              className="mb-8 mt-6 max-w-md font-mono text-base leading-relaxed text-muted"
            >
              {t("heroSubtitle")}
            </motion.p>

            <motion.div
              variants={RISE}
              transition={{ duration: 0.6 }}
              className="mb-10 flex flex-col gap-4 sm:flex-row"
            >
              <ButtonLink to="/shop" size="lg">
                {t("heroCta")}
                <ChevronRight size={16} className="rtl:rotate-180" />
              </ButtonLink>
              <ButtonLink to="/shop" variant="secondary" size="lg">
                {t("heroCtaSecondary")}
              </ButtonLink>
            </motion.div>

            <motion.div
              variants={RISE}
              transition={{ duration: 0.6 }}
              className="flex gap-8"
            >
              <StatCounter
                target={58}
                label={t("statWilayas")}
                animate={!reducedMotion}
              />
              {categoryCount > 0 && (
                <StatCounter
                  target={categoryCount}
                  label={t("statCategories")}
                  animate={!reducedMotion}
                />
              )}
              {reviewCount > 0 && (
                <StatCounter
                  target={reviewCount}
                  label={t("statReviews")}
                  animate={!reducedMotion}
                />
              )}
            </motion.div>
          </motion.div>

          <div className="w-full lg:w-1/2">
            {slides.length > 0 ? (
              <HeroSlider slides={slides} />
            ) : (
              // Nothing to show yet — a framed placeholder keeps the split
              // layout from collapsing into a half-empty hero.
              <div
                aria-hidden
                className="fx-ticks relative border border-line bg-panel"
                style={{ height: "clamp(340px, 55vh, 560px)" }}
              >
                <div className="fx-grid h-full w-full opacity-30" />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Trust row -------------------------------------------------------- */}
      <section className="border-b border-line bg-panel">
        <div className="mx-auto grid max-w-7xl gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
          {TRUST.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex gap-4 bg-panel p-6">
              <Icon size={22} className="mt-0.5 shrink-0 text-brand" />
              <div className="min-w-0">
                <p className="font-display text-sm font-bold uppercase tracking-widest text-ink">
                  {t(title)}
                </p>
                <p className="mt-1 font-mono text-xs leading-relaxed text-muted">{t(text)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Categories ------------------------------------------------------- */}
      {categoryCount > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <SectionHeading
            title={t("categoriesTitle")}
            subtitle={t("categoriesSubtitle")}
            align="center"
          />
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
            {(categories ?? []).map((category, index) => (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: Math.min(index, 5) * 0.1 }}
              >
                <Link
                  to={`/shop?categorie=${encodeURIComponent(category.slug)}`}
                  className="group relative block h-full overflow-hidden border border-line bg-panel p-8 transition-all hover:border-brand hover:shadow-accent"
                >
                  {category.image_url && (
                    <img
                      src={category.image_url}
                      alt=""
                      width={400}
                      height={400}
                      loading="lazy"
                      decoding="async"
                      className="absolute inset-0 h-full w-full object-cover opacity-20 transition-transform duration-500 group-hover:scale-105"
                    />
                  )}
                  <div className="relative flex min-h-24 flex-col justify-end">
                    <h3 className="font-display text-xl font-bold uppercase tracking-widest text-ink transition-colors group-hover:text-brand">
                      {pick(lang, category, "name")}
                    </h3>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Featured --------------------------------------------------------- */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <SectionHeading
          title={t("featuredTitle")}
          subtitle={t("featuredSubtitle")}
          action={
            <Link
              to="/shop"
              className="font-mono text-xs uppercase tracking-widest text-brand transition-colors hover:text-ink"
            >
              {t("viewAll")} →
            </Link>
          }
        />

        <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
          {featuredLoading
            ? Array.from({ length: 4 }, (_, index) => <ProductCardSkeleton key={index} />)
            : (featured ?? []).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
        </div>
      </section>

      {/* Marquee bands ---------------------------------------------------- */}
      <Marquee
        text={t("marqueeMain")}
        className="bg-brand py-4 font-display text-2xl font-black text-brand-ink"
      />
      <Marquee
        text={t("marqueeSub")}
        reverse
        className="bg-panel py-3 font-display text-xl font-bold text-brand"
      />

      {/* How it works ----------------------------------------------------- */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <SectionHeading title={t("howTitle")} align="center" />
        <div className="grid gap-6 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="fx-ticks relative border border-line bg-panel p-8"
            >
              <span
                dir="ltr"
                className="font-mono text-4xl font-bold leading-none text-brand/30"
              >
                0{index + 1}
              </span>
              <p className="mt-4 font-display text-xl font-bold uppercase tracking-widest text-ink">
                {t(step.title)}
              </p>
              <p className="mt-2 font-mono text-xs leading-relaxed text-muted">
                {t(step.text)}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Reviews ---------------------------------------------------------- */}
      {reviewCount > 0 && (
        <section className="accent-grid-bg relative overflow-hidden border-t border-line">
          <div className="relative z-10 mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
            <SectionHeading
              title={t("reviewsTitle")}
              subtitle={t("reviewsSubtitle")}
              align="center"
            />
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {(reviews ?? []).slice(0, 6).map((review) => (
                <figure key={review.id} className="border border-line bg-panel p-6">
                  <div className="mb-3 flex gap-0.5 text-brand" dir="ltr">
                    {Array.from({ length: 5 }, (_, index) => (
                      <Star
                        key={index}
                        size={14}
                        fill={index < review.stars ? "currentColor" : "none"}
                        className={index < review.stars ? "" : "text-line"}
                      />
                    ))}
                  </div>
                  <blockquote className="font-mono text-xs leading-relaxed text-muted">
                    {review.review_text}
                  </blockquote>
                  <figcaption className="mt-4 flex items-center gap-3">
                    {review.image_url && (
                      <img
                        src={review.image_url}
                        alt=""
                        width={36}
                        height={36}
                        loading="lazy"
                        decoding="async"
                        className="h-9 w-9 rounded-full object-cover"
                      />
                    )}
                    <span className="font-display text-sm font-bold uppercase tracking-wide text-ink">
                      {review.client_name}
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
