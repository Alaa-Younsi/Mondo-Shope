import { useNavigate } from "react-router-dom";
import { ShoppingBag } from "lucide-react";
import { CheckoutForm, type CheckoutLine } from "@/components/checkout/CheckoutForm";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Feedback";
import { Price } from "@/components/ui/Price";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useSeo } from "@/hooks/useSeo";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { lineIdentity, useCart } from "@/store/cart";
import { formatPrice } from "@/lib/format";
import { pick } from "@/lib/utils";

export default function Checkout() {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const items = useCart((state) => state.items);
  const clear = useCart((state) => state.clear);
  const { data: settings } = useStoreSettings();

  // Checkout is a transactional page, never a search result.
  useSeo({ title: `${t("checkoutTitle")} | ${t("brandName")}`, noIndex: true });

  const lines: CheckoutLine[] = items.map((item) => ({
    productId: item.productId,
    name: lang === "ar" && item.nameAr ? item.nameAr : item.nameFr,
    price: item.price,
    quantity: item.quantity,
    color: item.color,
    size: item.size,
    variants: item.variants,
    offers: item.offers,
  }));

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24">
        <EmptyState
          title={t("cartEmpty")}
          text={t("cartEmptyHint")}
          icon={<ShoppingBag size={28} />}
          action={
            <ButtonLink to="/shop" variant="outline" size="sm">
              {t("continueShopping")}
            </ButtonLink>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <header className="mb-8">
        <p className="eyebrow mb-2">{t("cart")}</p>
        <h1 className="font-display text-3xl font-bold uppercase tracking-tight text-ink">
          {t("checkoutTitle")}
        </h1>
        <p className="mt-2 text-sm text-muted">{t("checkoutSubtitle")}</p>
      </header>

      {settings?.free_ship_threshold != null && (
        <p className="mb-6 rounded-lg border border-brand/40 bg-brand/5 px-4 py-3 text-sm text-brand">
          {t("freeShippingBanner", { amount: formatPrice(settings.free_ship_threshold) })}
        </p>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="rounded-2xl border border-line bg-panel p-5 sm:p-7">
          <CheckoutForm
            lines={lines}
            askAddress={false}
            askNotes
            // A dedicated route the customer navigated to from the cart —
            // mounting already signals genuine checkout intent.
            fireCheckoutOnMount
            onSuccess={(orderNumber) => {
              clear();
              navigate(`/commande/${orderNumber}`);
            }}
          />
        </div>

        <aside className="h-fit rounded-2xl border border-line bg-panel p-5 lg:sticky lg:top-24">
          <p className="eyebrow mb-4">{t("orderSummary")}</p>
          <ul className="space-y-4">
            {items.map((item) => {
              const name = lang === "ar" && item.nameAr ? item.nameAr : item.nameFr;
              const options = [
                item.color,
                item.size,
                ...item.variants.map(
                  (variant) => `${pick(lang, variant, "name")}: ${variant.value}`,
                ),
              ].filter(Boolean);

              return (
                <li key={lineIdentity(item)} className="flex gap-3">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-line bg-panel-2">
                    {item.image && (
                      <img
                        src={item.image}
                        alt={name}
                        width={64}
                        height={64}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                      />
                    )}
                    <span
                      dir="ltr"
                      className="absolute -end-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 font-mono text-[10px] font-semibold text-brand-ink"
                    >
                      {item.quantity}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm text-ink">{name}</p>
                    {options.length > 0 && (
                      <p className="truncate text-xs text-muted">{options.join(" · ")}</p>
                    )}
                  </div>
                  <Price value={item.price * item.quantity} className="text-sm text-muted" />
                </li>
              );
            })}
          </ul>
        </aside>
      </div>
    </div>
  );
}
