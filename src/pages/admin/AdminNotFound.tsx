import { AdminPage } from "@/components/admin/AdminPage";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Feedback";
import { useLanguage } from "@/i18n/LanguageProvider";

export default function AdminNotFound() {
  const { t } = useLanguage();
  return (
    <AdminPage title={t("notFoundTitle")}>
      <EmptyState
        title={t("notFoundTitle")}
        text={t("notFoundText")}
        action={
          <ButtonLink to="/admin" variant="outline" size="sm">
            {t("navDashboard")}
          </ButtonLink>
        }
      />
    </AdminPage>
  );
}
