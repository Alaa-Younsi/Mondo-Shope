import type { OrderStatus } from "@/types/db";
import type { TranslationKey } from "@/i18n/translations";

export const ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
];

const LABELS: Record<OrderStatus, TranslationKey> = {
  pending: "ordStatusPending",
  confirmed: "ordStatusConfirmed",
  shipped: "ordStatusShipped",
  delivered: "ordStatusDelivered",
  cancelled: "ordStatusCancelled",
};

export function statusLabelKey(status: OrderStatus): TranslationKey {
  return LABELS[status];
}

export const STATUS_TONE: Record<
  OrderStatus,
  "brand" | "neutral" | "success" | "danger" | "warning" | "info"
> = {
  pending: "warning",
  confirmed: "info",
  shipped: "brand",
  delivered: "success",
  cancelled: "danger",
};
