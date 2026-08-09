import { ButtonLink } from "@/components/ui/Button";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useSeo } from "@/hooks/useSeo";

export default function NotFound() {
  const { t } = useLanguage();
  useSeo({ title: `${t("notFoundTitle")} | ${t("brandName")}`, noIndex: true });

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-32 text-center">
      <span dir="ltr" className="font-display text-7xl font-bold text-brand/30">
        404
      </span>
      <h1 className="mt-4 font-display text-2xl font-bold uppercase tracking-tight text-ink">
        {t("notFoundTitle")}
      </h1>
      <p className="mt-3 text-sm text-muted">{t("notFoundText")}</p>
      <ButtonLink to="/" className="mt-8">
        {t("backHome")}
      </ButtonLink>
    </div>
  );
}
