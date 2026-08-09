import { Link } from "react-router-dom";
import { Facebook, Instagram, Mail, Music2, Phone } from "lucide-react";
import { Wordmark } from "./Wordmark";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useCategories } from "@/hooks/useCatalog";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { pick } from "@/lib/utils";

export function Footer() {
  const { t, lang } = useLanguage();
  const { data: settings } = useStoreSettings();
  const { data: categories } = useCategories();

  const socials = [
    { href: settings?.facebook_url, icon: Facebook, label: "Facebook" },
    { href: settings?.instagram_url, icon: Instagram, label: "Instagram" },
    { href: settings?.tiktok_url, icon: Music2, label: "TikTok" },
  ].filter((entry): entry is { href: string; icon: typeof Facebook; label: string } =>
    Boolean(entry.href),
  );

  return (
    <footer className="mt-24 border-t border-line bg-bg shadow-[0_-1px_20px_rgb(var(--c-brand)/0.05)]">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-3 lg:px-8">
        <div className="space-y-4">
          <Wordmark />
          <p className="max-w-xs font-mono text-xs leading-relaxed text-muted">
            {t("brandTagline")}
          </p>
          {socials.length > 0 && (
            <div className="flex items-center gap-3">
              {socials.map(({ href, icon: Icon, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={label}
                  className="flex h-9 w-9 items-center justify-center border border-line text-muted transition-colors hover:border-brand hover:text-brand"
                >
                  <Icon size={15} />
                </a>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="mb-4 font-display text-sm font-bold uppercase tracking-widest text-ink">
            {t("navCategories")}
          </h3>
          <ul className="space-y-2">
            {(categories ?? []).slice(0, 6).map((category) => (
              <li key={category.id}>
                <Link
                  to={`/shop?categorie=${encodeURIComponent(category.slug)}`}
                  className="font-mono text-xs text-muted transition-colors hover:text-brand"
                >
                  {pick(lang, category, "name")}
                </Link>
              </li>
            ))}
            <li>
              <Link
                to="/shop"
                className="font-mono text-xs text-muted transition-colors hover:text-brand"
              >
                {t("viewAll")}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="mb-4 font-display text-sm font-bold uppercase tracking-widest text-ink">
            {t("navContact")}
          </h3>
          <ul className="space-y-3 font-mono text-xs text-muted">
            {settings?.store_phone && (
              <li>
                <a
                  href={`tel:${settings.store_phone}`}
                  dir="ltr"
                  className="inline-flex items-center gap-2 transition-colors hover:text-brand"
                >
                  <Phone size={14} />
                  {settings.store_phone}
                </a>
              </li>
            )}
            {settings?.store_email && (
              <li>
                <a
                  href={`mailto:${settings.store_email}`}
                  dir="ltr"
                  className="inline-flex items-center gap-2 transition-colors hover:text-brand"
                >
                  <Mail size={14} />
                  {settings.store_email}
                </a>
              </li>
            )}
            <li className="pt-1 leading-relaxed">{t("codNotice")}</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-center font-mono text-[11px] uppercase tracking-widest text-muted sm:flex-row sm:justify-between sm:px-6 sm:text-start lg:px-8">
          <span>
            © <span dir="ltr">{new Date().getFullYear()}</span> {t("brandName")}
          </span>
          <Link to="/admin" className="transition-colors hover:text-brand">
            {t("adminTitle")}
          </Link>
        </div>
      </div>
    </footer>
  );
}
