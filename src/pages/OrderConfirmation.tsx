import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, Phone } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState, LoadingBlock } from "@/components/ui/Feedback";
import { Price } from "@/components/ui/Price";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useGuestOrder } from "@/hooks/useOrders";
import { useSeo } from "@/hooks/useSeo";
import { usePixel } from "@/components/MetaPixelProvider";
import { pick } from "@/lib/utils";

export default function OrderConfirmation() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const { t, lang } = useLanguage();
  const pixel = usePixel();

  // Goes through get_order_by_number(): `orders` has no anon SELECT policy.
  const { data: order, isLoading } = useGuestOrder(orderNumber);

  useSeo({ title: `${t("orderConfirmedTitle")} | ${t("brandName")}`, noIndex: true });

  // Purchase fires from here, reading the AUTHORITATIVE total back from the
  // database rather than a client-computed estimate.
  const purchaseFired = useRef<string | null>(null);
  useEffect(() => {
    if (!order || purchaseFired.current === order.order_number) return;
    purchaseFired.current = order.order_number;
    pixel.track(
      "purchase",
      {
        value: Number(order.total),
        currency: "DZD",
        num_items: order.items.reduce((sum, item) => sum + item.quantity, 0),
      },
      // Meta's dedup key, so a server-side copy of this conversion collapses
      // into one.
      order.order_number,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.order_number]);

  if (isLoading) return <LoadingBlock label={t("loading")} />;

  if (!order) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24">
        <EmptyState
          title={t("orderNotFound")}
          text={t("orderNotFoundHint")}
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
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <div className="text-center">
        <CheckCircle2 size={52} className="mx-auto text-success" />
        <h1 className="mt-5 font-display text-3xl font-bold uppercase tracking-tight text-ink">
          {t("orderConfirmedTitle")}
        </h1>
        <p className="mt-3 text-sm text-muted">{t("orderConfirmedSubtitle")}</p>

        <div className="mt-6 inline-flex flex-col items-center rounded-xl border border-brand/40 bg-brand/5 px-6 py-4">
          <span className="eyebrow">{t("orderNumber")}</span>
          <span dir="ltr" className="mt-1 font-mono text-xl font-semibold text-brand">
            {order.order_number}
          </span>
        </div>
      </div>

      <div className="mt-10 rounded-2xl border border-line bg-panel p-6">
        <p className="eyebrow mb-4">{t("orderRecap")}</p>

        <ul className="space-y-4">
          {order.items.map((item, index) => {
            const name = lang === "ar" && item.name_ar ? item.name_ar : item.name_fr;
            const options = [
              item.color,
              item.size,
              ...(item.variants ?? []).map(
                (variant) => `${pick(lang, variant, "name")}: ${variant.value}`,
              ),
            ].filter(Boolean);

            return (
              <li key={index} className="flex gap-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-line bg-panel-2">
                  {item.image_url && (
                    <img
                      src={item.image_url}
                      alt={name}
                      width={56}
                      height={56}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink">{name}</p>
                  {options.length > 0 && (
                    <p className="truncate text-xs text-muted">{options.join(" · ")}</p>
                  )}
                  <p className="font-mono text-xs text-muted">
                    <span dir="ltr">×{item.quantity}</span>
                  </p>
                </div>
                <Price value={item.price * item.quantity} className="text-sm text-muted" />
              </li>
            );
          })}
        </ul>

        <div className="mt-6 space-y-1.5 border-t border-line pt-4 font-mono text-xs">
          <div className="flex items-center justify-between text-muted">
            <span>{t("subtotal")}</span>
            <Price value={order.subtotal} />
          </div>
          {order.discount > 0 && (
            <div className="flex items-center justify-between text-brand">
              <span>{t("discount")}</span>
              <Price value={order.discount} prefix="-" />
            </div>
          )}
          <div className="flex items-center justify-between text-muted">
            <span>{t("shipping")}</span>
            {order.shipping === 0 ? (
              <span className="text-success">{t("free")}</span>
            ) : (
              <Price value={order.shipping} />
            )}
          </div>
          <div className="flex items-center justify-between pt-2 text-base font-semibold text-ink">
            <span>{t("total")}</span>
            <Price value={order.total} />
          </div>
        </div>

        <div className="mt-6 border-t border-line pt-4 text-sm">
          <p className="text-muted">
            <span className="text-ink">{t("deliverTo")}:</span> {order.customer_name} —{" "}
            {order.city}, {order.wilaya} (
            {order.delivery_type === "office" ? t("deliveryOffice") : t("deliveryHome")})
          </p>
          <p className="mt-2 flex items-center gap-2 text-xs text-muted">
            <Phone size={14} className="shrink-0 text-brand" />
            {t("weWillCall")}
          </p>
        </div>
      </div>

      <div className="mt-8 text-center">
        <ButtonLink to="/shop" variant="outline">
          {t("continueShopping")}
        </ButtonLink>
      </div>
    </div>
  );
}
