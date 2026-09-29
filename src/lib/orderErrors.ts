import type { TranslationKey } from "@/i18n/translations";

/**
 * Maps a place_order() exception message to a translation key.
 *
 * The one CheckoutForm (cart checkout, product buy-now and the landing-page
 * order form) goes through this helper: a customer needs to know whether the
 * cart was empty, the stock ran out, or their wilaya is not served — one
 * generic string for all three is not actionable.
 */
export function orderErrorKey(error: unknown): TranslationKey {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : typeof error === "object" && error !== null && "message" in error
          ? String((error as { message: unknown }).message)
          : "";

  if (message.includes("ERR_CART_EMPTY")) return "errCartEmpty";
  if (message.includes("ERR_PRODUCT_UNAVAILABLE")) return "errProductUnavailable";
  /*
   * Per-option failures, checked before ERR_STOCK. They are reachable from a
   * cart saved in localStorage BEFORE the product gained sizes — the line has
   * no size, the server now requires one, and the customer cannot fix that
   * from the cart. The message has to say "open the product again", not
   * "something went wrong".
   */
  if (message.includes("ERR_OPTION_REQUIRED")) return "errOptionRequired";
  /*
   * The colour and the size both exist, but that PAIRING is not offered — a
   * cart line saved before the admin retired the combination from the stock
   * grid, or a hand-crafted request. Distinct from ERR_OPTION_UNAVAILABLE
   * because the fix is different: re-pick, rather than "that option is gone".
   */
  if (message.includes("ERR_COMBO_UNAVAILABLE")) return "errComboUnavailable";
  if (message.includes("ERR_OPTION_UNAVAILABLE")) return "errOptionUnavailable";
  if (message.includes("ERR_OPTION_STOCK")) return "errOptionStock";
  if (message.includes("ERR_STOCK")) return "errStock";
  if (message.includes("ERR_WILAYA_DISABLED")) return "errWilayaDisabled";
  if (message.includes("ERR_RATE_LIMIT")) return "errRateLimit";
  // Raised by the order_items quantity trigger (0014) — the server-side half of
  // MAX_QTY_PER_LINE, reachable only by a request that bypassed the stepper.
  if (message.includes("ERR_QTY_LIMIT")) return "errQtyLimit";
  if (message.includes("ERR_INVALID_INPUT")) return "errInvalidInput";
  return "genericError";
}
