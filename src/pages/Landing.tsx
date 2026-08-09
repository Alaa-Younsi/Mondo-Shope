import { Link } from "react-router-dom";
import { BadgeCheck, ChevronRight, Phone, ShieldCheck, Star, Truck } from "lucide-react";
import { HeroArt } from "@/components/effects/HeroArt";
import { ButtonLink } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/Badge";
import { ProductCard } from "@/components/product/ProductCard";
import { ProductCardSkeleton } from "@/components/ui/Feedback";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useCategories, useFeaturedProducts } from "@/hooks/useCatalog";
import { useReviews } from "@/hooks/useReviews";
import { useSeo, SITE_URL } from "@/hooks/useSeo";
import { pick } from "@/lib/utils";

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

export default function Landing() {
  const { t, lang } = useLanguage();
  const { data: featured, isLoading: featuredLoading } = useFeaturedProducts(8);
  const { data: categories } = useCategories();
  const { data: reviews } = useReviews(true);

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

  return (
    <>
      {/* Hero ------------------------------------------------------------- */}
      <section className="relative overflow-hidden border-b border-line">
        <HeroArt />
        <div className="relative mx-auto max-w-7xl px-4 py-24 text-center sm:px-6 sm:py-32 lg:px-8">
          <p className="eyebrow mb-5">{t("heroEyebrow")}</p>
          <h1 className="mx-auto max-w-3xl font-display text-4xl font-bold uppercase leading-[1.05] tracking-tight text-ink sm:text-6xl lg:text-7xl">
            {t("heroTitle")}
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
            {t("heroSubtitle")}
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <ButtonLink to="/shop" size="lg">
              {t("heroCta")}
              <ChevronRight size={16} className="rtl:rotate-180" />
            </ButtonLink>
            <ButtonLink to="/shop" variant="outline" size="lg">
              {t("heroCtaSecondary")}
            </ButtonLink>
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
                <p className="font-display text-sm font-semibold uppercase tracking-wide text-ink">
                  {t(title)}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted">{t(text)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Featured --------------------------------------------------------- */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <SectionHeading
          title={t("featuredTitle")}
          subtitle={t("featuredSubtitle")}
          action={
            <ButtonLink to="/shop" variant="outline" size="sm">
              {t("viewAll")}
              <ChevronRight size={14} className="rtl:rotate-180" />
            </ButtonLink>
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

      {/* Categories ------------------------------------------------------- */}
      {(categories ?? []).length > 0 && (
        <section className="border-y border-line bg-panel">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <SectionHeading
              title={t("categoriesTitle")}
              subtitle={t("categoriesSubtitle")}
              align="center"
            />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {(categories ?? []).map((category) => (
                <Link
                  key={category.id}
                  to={`/shop?categorie=${encodeURIComponent(category.slug)}`}
                  className="fx-ticks group relative overflow-hidden rounded-xl border border-line bg-bg p-6 transition-colors hover:border-brand/60"
                >
                  {category.image_url && (
                    <img
                      src={category.image_url}
                      alt=""
                      width={400}
                      height={400}
                      loading="lazy"
                      decoding="async"
                      className="absolute inset-0 h-full w-full object-cover opacity-25 transition-transform duration-500 group-hover:scale-105"
                    />
                  )}
                  <div className="relative flex min-h-24 flex-col justify-end">
                    <p className="font-display text-lg font-semibold uppercase tracking-wide text-ink">
                      {pick(lang, category, "name")}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* How it works ----------------------------------------------------- */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <SectionHeading title={t("howTitle")} align="center" />
        <div className="grid gap-6 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <div key={step.title} className="fx-ticks relative rounded-xl border border-line bg-panel p-7">
              <span
                dir="ltr"
                className="font-display text-4xl font-bold leading-none text-brand/30"
              >
                0{index + 1}
              </span>
              <p className="mt-4 font-display text-lg font-semibold uppercase tracking-wide text-ink">
                {t(step.title)}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted">{t(step.text)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Reviews ---------------------------------------------------------- */}
      {(reviews ?? []).length > 0 && (
        <section className="border-t border-line bg-panel">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <SectionHeading
              title={t("reviewsTitle")}
              subtitle={t("reviewsSubtitle")}
              align="center"
            />
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {(reviews ?? []).slice(0, 6).map((review) => (
                <figure key={review.id} className="rounded-xl border border-line bg-bg p-6">
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
                  <blockquote className="text-sm leading-relaxed text-muted">
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
                    <span className="text-sm font-medium text-ink">{review.client_name}</span>
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
