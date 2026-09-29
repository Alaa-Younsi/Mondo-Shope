import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, MapPin, Phone, StickyNote } from "lucide-react";
import { AdminPage, Panel } from "@/components/admin/AdminPage";
import { useAdminToast } from "@/components/admin/AdminToastProvider";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState, LoadingBlock } from "@/components/ui/Feedback";
import { Price } from "@/components/ui/Price";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useOrder } from "@/hooks/useOrders";
import { supabase } from "@/lib/supabase";
import { invalidateOrders, invalidateProducts } from "@/lib/queryCache";
import { formatDateTime } from "@/lib/format";
import { cn, pick } from "@/lib/utils";
import { ORDER_STATUSES, STATUS_TONE, statusLabelKey } from "./orderStatus";
import type { OrderStatus } from "@/types/db";

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const { t, lang } = useLanguage();
  const toast = useAdminToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: order, isLoading } = useOrder(id);
  const [updating, setUpdating] = useState(false);

  const setStatus = async (status: OrderStatus) => {
    if (!order || status === order.status) return;
    setUpdating(true);
    const { error } = await supabase.from("orders").update({ status }).eq("id", order.id);
    setUpdating(false);

    if (error) {
      toast.error(
        error.message.includes("ERR_ORDER_CANCELLED")
          ? t("ordCancelledLocked")
          : t("adminSaveError"),
      );
      return;
    }

    toast.success(t("adminSaved"));
    invalidateOrders(queryClient);
    // Cancelling fires the restock trigger, so stock changed too.
    if (status === "cancelled") invalidateProducts(queryClient);
  };

  if (isLoading) return <LoadingBlock label={t("loading")} />;
  if (!order) {
    return (
      <AdminPage title={t("ordDetail")}>
        <EmptyState title={t("adminLoadError")} />
      </AdminPage>
    );
  }

  const cancelled = order.status === "cancelled";

  return (
    <AdminPage
      title={order.order_number}
      subtitle={formatDateTime(order.created_at, lang)}
      action={
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/commandes")}>
          <ArrowLeft size={15} className="rtl:rotate-180" />
          {t("back")}
        </Button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Panel title={t("ordItems")}>
            <ul className="space-y-4">
              {(order.order_items ?? []).map((item) => {
                const name = lang === "ar" && item.name_ar ? item.name_ar : item.name_fr;
                const options = [
                  item.color,
                  item.size,
                  ...(item.variants ?? []).map(
                    (variant) => `${pick(lang, variant, "name")}: ${variant.value}`,
                  ),
                ].filter(Boolean);

                return (
                  <li key={item.id} className="flex gap-3">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-line bg-panel-2">
                      {item.image_url && (
                        <img
                          src={item.image_url}
                          alt=""
                          width={64}
                          height={64}
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink">{name}</p>
                      {options.length > 0 && (
                        <p className="text-xs text-muted">{options.join(" · ")}</p>
                      )}
                      <p className="font-mono text-xs text-muted">
                        <span dir="ltr">
                          ×{item.quantity} — <Price value={item.price} />
                        </span>
                      </p>
                    </div>
                    <Price value={item.price * item.quantity} className="text-sm" />
                  </li>
                );
              })}
            </ul>

            <div className="mt-5 space-y-1.5 border-t border-line pt-4 font-mono text-xs">
              <div className="flex justify-between text-muted">
                <span>{t("subtotal")}</span>
                <Price value={order.subtotal} />
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-brand">
                  <span>{t("discount")}</span>
                  <Price value={order.discount} prefix="-" />
                </div>
              )}
              <div className="flex justify-between text-muted">
                <span>{t("shipping")}</span>
                <Price value={order.shipping} />
              </div>
              <div className="flex justify-between pt-2 text-base font-semibold text-ink">
                <span>{t("total")}</span>
                <Price value={order.total} />
              </div>
            </div>
          </Panel>

          <Panel title={t("ordChangeStatus")}>
            <div className="flex flex-wrap gap-2">
              {ORDER_STATUSES.map((status) => (
                <button
                  key={status}
                  type="button"
                  // Cancelling already put the units back on sale; reopening
                  // the order would sell them twice. The database refuses the
                  // transition too (0014) — this just says so up front.
                  disabled={updating || cancelled}
                  onClick={() => void setStatus(status)}
                  className={cn(
                    "rounded-lg border px-4 py-2.5 text-sm transition-colors disabled:opacity-50",
                    order.status === status
                      ? "border-brand bg-brand/10 text-brand"
                      : "border-line text-muted hover:border-muted hover:text-ink",
                  )}
                >
                  {t(statusLabelKey(status))}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted">
              {cancelled ? t("ordCancelledLocked") : t("ordRestockNote")}
            </p>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title={t("ordCustomer")}>
            <div className="space-y-3 text-sm">
              <p className="font-medium text-ink">{order.customer_name}</p>
              <a
                href={`tel:${order.customer_phone}`}
                dir="ltr"
                className="flex items-center gap-2 font-mono text-muted transition-colors hover:text-brand"
              >
                <Phone size={14} className="shrink-0" />
                {order.customer_phone}
              </a>
              <p className="flex items-start gap-2 text-muted">
                <MapPin size={14} className="mt-0.5 shrink-0" />
                <span>
                  {order.city}, {order.wilaya}
                  {order.address && <span className="block">{order.address}</span>}
                  <span className="block text-xs">
                    {order.delivery_type === "office"
                      ? t("deliveryOffice")
                      : t("deliveryHome")}
                  </span>
                </span>
              </p>
              {order.notes && (
                <p className="flex items-start gap-2 text-muted">
                  <StickyNote size={14} className="mt-0.5 shrink-0" />
                  {order.notes}
                </p>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <Badge tone={STATUS_TONE[order.status]}>{t(statusLabelKey(order.status))}</Badge>
                <Badge tone="neutral">{order.language.toUpperCase()}</Badge>
                <Badge tone="neutral">
                  {t("ordSource")}: {order.source || t("ordSourceSite")}
                </Badge>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </AdminPage>
  );
}
