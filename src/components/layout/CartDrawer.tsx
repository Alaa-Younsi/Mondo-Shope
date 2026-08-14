import { useNavigate } from "react-router-dom";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { Button, ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Feedback";
import { Price } from "@/components/ui/Price";
import { useLanguage } from "@/i18n/LanguageProvider";
import { cartGoodsTotal, cartSubtotal, lineIdentity, useCart } from "@/store/cart";
import { MAX_QTY_PER_LINE } from "@/lib/limits";
import { pick } from "@/lib/utils";

export function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, lang, dir } = useLanguage();
  const navigate = useNavigate();
  const items = useCart((state) => state.items);
  const removeItem = useCart((state) => state.removeItem);
  const updateQuantity = useCart((state) => state.updateQuantity);

  const subtotal = cartSubtotal(items);
  const goods = cartGoodsTotal(items);
  const discount = subtotal - goods;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={t("cart")}
      // Physical side, derived from the reading direction.
      side={dir === "rtl" ? "left" : "right"}
      footer={
        items.length > 0 ? (
          <div className="space-y-3">
            <div className="space-y-1.5 font-mono text-xs">
              <div className="flex items-center justify-between text-muted">
                <span>{t("subtotal")}</span>
                <Price value={subtotal} />
              </div>
              {discount > 0 && (
                <div className="flex items-center justify-between text-brand">
                  <span>{t("discount")}</span>
                  <Price value={discount} prefix="-" />
                </div>
              )}
              <div className="flex items-center justify-between pt-1 text-sm font-semibold text-ink">
                <span>{t("total")}</span>
                <Price value={goods} />
              </div>
            </div>
            <p className="text-[11px] leading-relaxed text-muted">{t("codNotice")}</p>
            <Button
              fullWidth
              size="lg"
              onClick={() => {
                onClose();
                navigate("/checkout");
              }}
            >
              {t("cartCheckout")}
            </Button>
          </div>
        ) : null
      }
    >
      {items.length === 0 ? (
        <EmptyState
          title={t("cartEmpty")}
          text={t("cartEmptyHint")}
          icon={<ShoppingBag size={28} />}
          action={
            <ButtonLink to="/shop" variant="outline" size="sm" onClick={onClose}>
              {t("continueShopping")}
            </ButtonLink>
          }
          className="border-none bg-transparent"
        />
      ) : (
        <ul className="space-y-4">
          {items.map((item) => {
            const identity = lineIdentity(item);
            const name = lang === "ar" && item.nameAr ? item.nameAr : item.nameFr;
            const options = [
              item.color,
              item.size,
              ...item.variants.map(
                (variant) =>
                  `${pick(lang, variant, "name")}: ${variant.value}`,
              ),
            ].filter(Boolean);

            return (
              <li key={identity} className="flex gap-3">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-line bg-panel-2">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={name}
                      width={80}
                      height={80}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium text-ink">{name}</p>
                  {options.length > 0 && (
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {options.join(" · ")}
                    </p>
                  )}

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex items-center rounded-lg border border-line">
                      <button
                        type="button"
                        onClick={() => updateQuantity(identity, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                        aria-label="-"
                        className="flex h-9 w-9 items-center justify-center text-muted transition-colors hover:text-ink disabled:opacity-40"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-8 text-center font-mono text-sm" dir="ltr">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(identity, item.quantity + 1)}
                        disabled={item.quantity >= Math.min(item.maxStock, MAX_QTY_PER_LINE)}
                        aria-label="+"
                        className="flex h-9 w-9 items-center justify-center text-muted transition-colors hover:text-ink disabled:opacity-40"
                      >
                        <Plus size={14} />
                      </button>
                    </div>

                    <Price value={item.price * item.quantity} className="text-sm font-semibold" />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => removeItem(identity)}
                  aria-label={t("removeItem")}
                  className="-m-2 h-fit rounded-lg p-2 text-muted transition-colors hover:text-danger"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Drawer>
  );
}
