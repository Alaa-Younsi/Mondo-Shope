import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AdminPage } from "@/components/admin/AdminPage";
import { useAdminToast } from "@/components/admin/AdminToastProvider";
import { Input, Toggle } from "@/components/ui/Form";
import { LoadingBlock } from "@/components/ui/Feedback";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useDeliveryPrices } from "@/hooks/useStoreSettings";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type { DeliveryPrice } from "@/types/db";

export default function AdminDeliveryPrices() {
  const { t } = useLanguage();
  const toast = useAdminToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useDeliveryPrices(false);

  const [search, setSearch] = useState("");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["delivery-prices"] });
  };

  /**
   * The price cells are uncontrolled (defaultValue + onBlur), so a rejected
   * write would otherwise leave the typed number sitting on screen looking
   * saved. `revert` puts the stored value back.
   */
  const savePrice = async (
    row: DeliveryPrice,
    field: "home_price" | "office_price",
    raw: string,
    revert: () => void,
  ) => {
    const value = Math.max(0, Number(raw) || 0);
    if (value === Number(row[field])) return;

    const { error } = await supabase
      .from("delivery_prices")
      .update({ [field]: value })
      .eq("id", row.id);

    if (error) {
      toast.error(t("adminSaveError"));
      revert();
      return;
    }
    invalidate();
  };

  const setActive = async (row: DeliveryPrice, active: boolean) => {
    const { error } = await supabase
      .from("delivery_prices")
      .update({ active })
      .eq("id", row.id);

    if (error) {
      toast.error(t("adminSaveError"));
      return;
    }
    invalidate();
  };

  if (isLoading) return <LoadingBlock label={t("loading")} />;

  const rows = (data ?? []).filter((row) =>
    row.wilaya.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <AdminPage title={t("delTitle")} subtitle={t("delSubtitle")}>
      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={t("delSearchPlaceholder")}
        className="mb-4"
      />

      {/* min-w inside the scroll container: on a phone the browser otherwise
          crushes the price cells until the digits clip. */}
      <div className="overflow-x-auto rounded-xl border border-line bg-panel">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-line font-mono text-[11px] uppercase tracking-wider text-muted">
              <th className="whitespace-nowrap px-4 py-3 text-start">{t("delWilaya")}</th>
              <th className="w-32 whitespace-nowrap px-4 py-3 text-start">{t("delHome")}</th>
              <th className="w-32 whitespace-nowrap px-4 py-3 text-start">{t("delOffice")}</th>
              <th className="w-24 whitespace-nowrap px-4 py-3 text-end">{t("delActive")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className={cn(
                  "border-b border-line/60 last:border-0",
                  !row.active && "opacity-45",
                )}
              >
                <td className="whitespace-nowrap px-4 py-2.5 font-medium text-ink">
                  {row.wilaya}
                </td>
                <td className="px-4 py-2.5">
                  {/* Size the CELL, not the input: cn() is a plain join, so a
                      w-* class passed into a w-full control does not win. */}
                  <div className="w-24">
                    <Input
                      type="number"
                      min={0}
                      dir="ltr"
                      defaultValue={row.home_price}
                      onBlur={(event) => {
                        const input = event.currentTarget;
                        void savePrice(row, "home_price", input.value, () => {
                          input.value = String(row.home_price);
                        });
                      }}
                    />
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <div className="w-24">
                    <Input
                      type="number"
                      min={0}
                      dir="ltr"
                      defaultValue={row.office_price}
                      onBlur={(event) => {
                        const input = event.currentTarget;
                        void savePrice(row, "office_price", input.value, () => {
                          input.value = String(row.office_price);
                        });
                      }}
                    />
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end">
                    <Toggle
                      checked={row.active}
                      label={row.wilaya}
                      onChange={(next) => void setActive(row, next)}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminPage>
  );
}
