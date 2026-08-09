import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Form";
import { Price } from "@/components/ui/Price";
import { Spinner } from "@/components/ui/Feedback";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useHoneypot, honeypotFieldProps } from "@/hooks/useHoneypot";
import { useDeliveryPrices, useStoreSettings, resolveShipping } from "@/hooks/useStoreSettings";
import { usePixel } from "@/components/MetaPixelProvider";
import { supabase } from "@/lib/supabase";
import { orderErrorKey } from "@/lib/orderErrors";
import { lineTotal } from "@/lib/offers";
import { cn } from "@/lib/utils";
import type { QuantityOffer, VariantSelection } from "@/types/db";
import type { TranslationKey } from "@/i18n/translations";

/** One line being ordered. Prices here are DISPLAY ONLY — the server reprices. */
export interface CheckoutLine {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  color: string | null;
  size: string | null;
  variants: VariantSelection[];
  offers: QuantityOffer[];
}

interface CheckoutFormProps {
  lines: CheckoutLine[];
  /** Written to orders.source for attribution (e.g. a landing page slug). */
  source?: string;
  askAddress?: boolean;
  askNotes?: boolean;
  /**
   * `true` on the dedicated /checkout route: the customer navigated there from
   * the cart, so mounting already signals checkout intent.
   * `false` for embedded forms — those are visible the instant the product or
   * landing page loads, and firing on mount would count every page view as
   * checkout intent.
   */
  fireCheckoutOnMount?: boolean;
  submitLabel?: string;
  onSuccess: (orderNumber: string) => void;
  className?: string;
  compact?: boolean;
}

const PHONE_RE = /^0[5-7][0-9]{8}$/;

export function CheckoutForm({
  lines,
  source,
  askAddress = false,
  askNotes = false,
  fireCheckoutOnMount = false,
  submitLabel,
  onSuccess,
  className,
  compact = false,
}: CheckoutFormProps) {
  const { t, lang, dir } = useLanguage();
  const pixel = usePixel();
  const { isSpam } = useHoneypot();
  const { data: settings } = useStoreSettings();
  // UX only — place_order() independently rejects a disabled wilaya. Without
  // this filter the customer fills the whole form before being refused.
  const { data: wilayas } = useDeliveryPrices(true);

  const [serverError, setServerError] = useState<TranslationKey | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(2, t("vNameRequired")).max(80, t("vNameRequired")),
        phone: z
          .string()
          .trim()
          .transform((value) => value.replace(/[\s.-]/g, ""))
          .refine((value) => PHONE_RE.test(value), t("vPhoneRequired")),
        wilaya: z.string().min(1, t("vWilayaRequired")),
        city: z.string().trim().min(1, t("vCityRequired")).max(80, t("vCityRequired")),
        address: z.string().max(240).optional(),
        notes: z.string().max(500).optional(),
        delivery_type: z.enum(["home", "office"]),
        // Honeypot — real users never fill this.
        company: z.string().optional(),
      }),
    [t],
  );

  type FormValues = z.input<typeof schema>;

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { delivery_type: "home", wilaya: "", name: "", phone: "", city: "" },
  });

  const selectedWilaya = watch("wilaya");
  const deliveryType = watch("delivery_type");

  const goods = lines.reduce(
    (sum, line) => sum + lineTotal(line.price, line.quantity, line.offers),
    0,
  );
  const rawSubtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const discount = rawSubtotal - goods;

  const wilayaRow = wilayas?.find((row) => row.wilaya === selectedWilaya);
  const wilayaFee = wilayaRow
    ? deliveryType === "office"
      ? wilayaRow.office_price
      : wilayaRow.home_price
    : null;

  // ONE shared rule with the server. When these drifted apart, customers were
  // shown a total several hundred DA above what they were actually charged.
  const shipping = resolveShipping(wilayaFee, goods, settings);
  const total = goods + shipping.amount;

  // --- pixel: InitiateCheckout ---------------------------------------------
  const checkoutFired = useRef(false);

  useEffect(() => {
    if (!fireCheckoutOnMount || checkoutFired.current || lines.length === 0) return;
    checkoutFired.current = true;
    pixel.track("initiate_checkout", {
      content_ids: lines.map((line) => line.productId),
      num_items: lines.reduce((sum, line) => sum + line.quantity, 0),
      value: goods,
      currency: "DZD",
    });
    // `pixel.track` gets a new identity whenever the matched pixel set widens,
    // so this must not depend on it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fireCheckoutOnMount, lines.length]);

  const handleFormFocus = () => {
    if (fireCheckoutOnMount || checkoutFired.current || lines.length === 0) return;
    checkoutFired.current = true;
    pixel.track("initiate_checkout", {
      content_ids: lines.map((line) => line.productId),
      num_items: lines.reduce((sum, line) => sum + line.quantity, 0),
      value: goods,
      currency: "DZD",
    });
  };

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);

    if (isSpam(values.company)) return; // silent: never tell a bot why
    if (lines.length === 0) {
      setServerError("errCartEmpty");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc("place_order", {
        items: lines.map((line) => ({
          product_id: line.productId,
          quantity: line.quantity,
          color: line.color,
          size: line.size,
          variants: line.variants,
        })),
        customer: {
          name: values.name,
          phone: String(values.phone).replace(/[\s.-]/g, ""),
          wilaya: values.wilaya,
          city: values.city,
          address: askAddress ? values.address : null,
          notes: askNotes ? values.notes : null,
          delivery_type: values.delivery_type,
          language: lang,
          source: source ?? null,
        },
      });

      if (error) {
        setServerError(orderErrorKey(error));
        return;
      }

      onSuccess(String(data));
    } catch (error) {
      setServerError(orderErrorKey(error));
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <form onSubmit={onSubmit} onFocus={handleFormFocus} className={cn("space-y-4", className)} noValidate>
      {/* Honeypot */}
      <input {...register("company")} {...honeypotFieldProps} />

      <div className={cn("grid gap-4", !compact && "sm:grid-cols-2")}>
        <Field label={t("fullName")} required error={errors.name?.message} htmlFor="co-name">
          <Input
            id="co-name"
            autoComplete="name"
            placeholder={t("fullNamePlaceholder")}
            {...register("name")}
          />
        </Field>

        <Field label={t("phone")} required error={errors.phone?.message} htmlFor="co-phone">
          <Input
            id="co-phone"
            type="tel"
            inputMode="tel"
            dir="ltr"
            autoComplete="tel"
            placeholder={t("phonePlaceholder")}
            {...register("phone")}
          />
        </Field>

        <Field label={t("wilaya")} required error={errors.wilaya?.message} htmlFor="co-wilaya">
          <Select id="co-wilaya" {...register("wilaya")}>
            <option value="">{t("selectWilaya")}</option>
            {(wilayas ?? []).map((row) => (
              <option key={row.id} value={row.wilaya}>
                {row.wilaya}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t("city")} required error={errors.city?.message} htmlFor="co-city">
          <Input
            id="co-city"
            autoComplete="address-level2"
            placeholder={t("cityPlaceholder")}
            {...register("city")}
          />
        </Field>
      </div>

      {askAddress && (
        <Field label={t("address")} htmlFor="co-address">
          <Input id="co-address" placeholder={t("addressPlaceholder")} {...register("address")} />
        </Field>
      )}

      <Field label={t("deliveryType")}>
        <div className="grid grid-cols-2 gap-2">
          {(["home", "office"] as const).map((option) => (
            <label
              key={option}
              className={cn(
                "flex cursor-pointer items-center justify-center rounded-lg border px-3 py-3 text-center text-sm transition-colors",
                deliveryType === option
                  ? "border-brand bg-brand/10 text-brand"
                  : "border-line text-muted hover:border-muted hover:text-ink",
              )}
            >
              <input type="radio" value={option} className="sr-only" {...register("delivery_type")} />
              {option === "home" ? t("deliveryHome") : t("deliveryOffice")}
            </label>
          ))}
        </div>
      </Field>

      {askNotes && (
        <Field label={t("notes")} htmlFor="co-notes">
          <Textarea id="co-notes" rows={2} placeholder={t("notesPlaceholder")} {...register("notes")} />
        </Field>
      )}

      <div className="space-y-1.5 rounded-lg border border-line bg-panel-2 p-4 font-mono text-xs">
        <div className="flex items-center justify-between text-muted">
          <span>{t("subtotal")}</span>
          <Price value={rawSubtotal} />
        </div>
        {discount > 0 && (
          <div className="flex items-center justify-between text-brand">
            <span>{t("discount")}</span>
            <Price value={discount} prefix="-" />
          </div>
        )}
        <div className="flex items-center justify-between text-muted">
          <span>{t("shipping")}</span>
          {/* "not chosen yet" and "free" must never collapse into the same dash */}
          {!shipping.known ? (
            <span>{t("shippingNotSet")}</span>
          ) : shipping.isFree ? (
            <span className="text-success">{t("free")}</span>
          ) : (
            <Price value={shipping.amount} />
          )}
        </div>
        <div className="flex items-center justify-between border-t border-line pt-2 text-sm font-semibold text-ink">
          <span>{t("total")}</span>
          <Price value={total} />
        </div>
      </div>

      {serverError && (
        <p
          className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger"
          role="alert"
        >
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          {t(serverError)}
        </p>
      )}

      <Button type="submit" size="lg" fullWidth disabled={submitting}>
        {submitting ? (
          <>
            <Spinner />
            {t("placingOrder")}
          </>
        ) : (
          (submitLabel ?? t("placeOrder"))
        )}
      </Button>

      <p className={cn("text-center text-xs text-muted", dir === "rtl" && "leading-relaxed")}>
        {t("codNotice")}
      </p>
    </form>
  );
}
