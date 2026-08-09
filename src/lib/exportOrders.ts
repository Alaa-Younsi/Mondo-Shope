import * as XLSX from "xlsx";
import type { Order } from "@/types/db";
import { formatDateTime } from "./format";

/**
 * Spreadsheet formula injection guard.
 *
 * customer_name, city, address and notes are free-text checkout input. The RPC
 * validates length and shape but does not restrict the character set — a name
 * is allowed to start with `=`, `+`, `-` or `@`. Written verbatim into a cell,
 * a customer named `=cmd|'/c calc'!A1` executes for whoever opens the export:
 * the client's own dispatcher. Prefixing with a quote makes Excel and Sheets
 * render it as literal text, with no visible change to the value.
 *
 * This is a different sink from React's DOM escaping — that protects the
 * browser, not a spreadsheet app opening the file.
 */
function excelSafe(value: string | null | undefined): string {
  const text = value ?? "";
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

const STATUS_LABEL: Record<Order["status"], string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  shipped: "Expédiée",
  delivered: "Livrée",
  cancelled: "Annulée",
};

export function exportOrdersToExcel(orders: Order[]): void {
  const rows = orders.map((order) => ({
    "N° commande": order.order_number,
    Client: excelSafe(order.customer_name),
    Téléphone: excelSafe(order.customer_phone),
    Wilaya: excelSafe(order.wilaya),
    Commune: excelSafe(order.city),
    Adresse: excelSafe(order.address),
    Statut: STATUS_LABEL[order.status],
    Livraison: order.delivery_type === "office" ? "Bureau" : "Domicile",
    "Sous-total": Number(order.subtotal),
    "Frais livraison": Number(order.shipping),
    Remise: Number(order.discount),
    Total: Number(order.total),
    Articles: order.order_items
      ? order.order_items
          .map((item) => `${excelSafe(item.name_fr)} x${item.quantity}`)
          .join(" | ")
      : "",
    Remarques: excelSafe(order.notes),
    Origine: excelSafe(order.source),
    Date: formatDateTime(order.created_at, "fr"),
  }));

  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet["!cols"] = [
    { wch: 18 }, { wch: 22 }, { wch: 14 }, { wch: 16 }, { wch: 16 },
    { wch: 28 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 },
    { wch: 10 }, { wch: 12 }, { wch: 40 }, { wch: 28 }, { wch: 16 },
    { wch: 18 },
  ];

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Commandes");

  const today = new Date();
  const stamp = `${today.getFullYear()}-${`${today.getMonth() + 1}`.padStart(2, "0")}-${`${today.getDate()}`.padStart(2, "0")}`;
  XLSX.writeFile(book, `commandes-${stamp}.xlsx`);
}
