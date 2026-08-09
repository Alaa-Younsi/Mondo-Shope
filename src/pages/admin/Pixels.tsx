import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { AdminPage, Panel } from "@/components/admin/AdminPage";
import { ConfirmModal } from "@/components/admin/ConfirmModal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/Form";
import { EmptyState, LoadingBlock, Spinner } from "@/components/ui/Feedback";
import { Modal } from "@/components/ui/Modal";
import { Num } from "@/components/ui/Price";
import { useLanguage } from "@/i18n/LanguageProvider";
import {
  useAllPixelsAdmin,
  useDeletePixel,
  useSavePixel,
  type PixelInput,
} from "@/hooks/useMetaPixels";
import type { MetaPixel, PixelEventKey, PixelScope } from "@/types/db";
import type { TranslationKey } from "@/i18n/translations";

const EVENT_KEYS: PixelEventKey[] = [
  "page_view",
  "view_content",
  "add_to_cart",
  "initiate_checkout",
  "purchase",
  "lead",
  "search",
];

const EVENT_LABEL: Record<PixelEventKey, TranslationKey> = {
  page_view: "pxEventPageView",
  view_content: "pxEventViewContent",
  add_to_cart: "pxEventAddToCart",
  initiate_checkout: "pxEventInitiateCheckout",
  purchase: "pxEventPurchase",
  lead: "pxEventLead",
  search: "pxEventSearch",
};

const SCOPE_LABEL: Record<PixelScope, TranslationKey> = {
  all: "pxScopeAll",
  paths: "pxScopePaths",
  products: "pxScopeProducts",
  landing: "pxScopeLanding",
};

const SCOPE_HINT: Record<PixelScope, TranslationKey | null> = {
  all: null,
  paths: "pxMatchHintPaths",
  products: "pxMatchHintProducts",
  landing: "pxMatchHintLanding",
};

type Draft = PixelInput & { matchText: string };

const EMPTY: Draft = {
  id: undefined,
  label: "",
  pixel_id: "",
  active: true,
  scope: "all",
  match_values: [],
  matchText: "",
  events: {
    page_view: true,
    view_content: true,
    add_to_cart: true,
    initiate_checkout: true,
    purchase: true,
    lead: true,
    search: true,
  },
  test_event_code: null,
  currency: "DZD",
  sort_order: 0,
  notes: null,
};

export default function AdminPixels() {
  const { t } = useLanguage();
  const { data, isLoading } = useAllPixelsAdmin();
  const savePixel = useSavePixel();
  const deletePixel = useDeletePixel();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [pendingDelete, setPendingDelete] = useState<MetaPixel | null>(null);
  const [idError, setIdError] = useState(false);

  const onSave = async () => {
    if (!draft) return;

    // Anything but 10–20 digits is almost always a paste of the whole base-code
    // snippet, which silently tracks nothing — the client would find out from
    // an empty Events Manager a week into a campaign.
    if (!/^\d{10,20}$/.test(draft.pixel_id.trim())) {
      setIdError(true);
      return;
    }
    setIdError(false);

    const { matchText, ...rest } = draft;
    await savePixel.mutateAsync({
      ...rest,
      pixel_id: draft.pixel_id.trim(),
      match_values:
        draft.scope === "all"
          ? []
          : matchText
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean),
    });
    setDraft(null);
  };

  if (isLoading) return <LoadingBlock label={t("loading")} />;

  return (
    <AdminPage
      title={t("pxTitle")}
      subtitle={t("pxSubtitle")}
      action={
        <Button size="sm" onClick={() => setDraft(EMPTY)}>
          <Plus size={15} />
          {t("pxNew")}
        </Button>
      }
    >
      {(data ?? []).length === 0 ? (
        <EmptyState title={t("pxNone")} />
      ) : (
        <div className="space-y-3">
          {(data ?? []).map((pixel) => (
            <Panel key={pixel.id} className={pixel.active ? "" : "opacity-55"}>
              <div className="flex flex-wrap items-start gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-ink">{pixel.label}</p>
                    <Badge tone={pixel.active ? "success" : "neutral"}>
                      {pixel.active ? t("active") : t("inactive")}
                    </Badge>
                    <Badge tone="neutral">{t(SCOPE_LABEL[pixel.scope])}</Badge>
                    {pixel.scope !== "all" && (
                      <Badge tone="neutral">
                        <Num value={pixel.match_values.length} /> {t("pxTargets")}
                      </Badge>
                    )}
                  </div>
                  <p dir="ltr" className="mt-1 font-mono text-xs text-muted">
                    {pixel.pixel_id}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {EVENT_KEYS.filter((key) => pixel.events?.[key] !== false).map((key) => (
                      <span
                        key={key}
                        className="rounded border border-line px-1.5 py-0.5 font-mono text-[10px] text-muted"
                      >
                        {t(EVENT_LABEL[key])}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      setDraft({
                        id: pixel.id,
                        label: pixel.label,
                        pixel_id: pixel.pixel_id,
                        active: pixel.active,
                        scope: pixel.scope,
                        match_values: pixel.match_values,
                        matchText: pixel.match_values.join("\n"),
                        events: pixel.events,
                        test_event_code: pixel.test_event_code,
                        currency: pixel.currency,
                        sort_order: pixel.sort_order,
                        notes: pixel.notes,
                      })
                    }
                    aria-label={t("edit")}
                    className="rounded-lg p-2 text-muted transition-colors hover:text-brand"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(pixel)}
                    aria-label={t("delete")}
                    className="rounded-lg p-2 text-muted transition-colors hover:text-danger"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}

      <Modal
        open={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.id ? t("edit") : t("pxNew")}
        className="sm:max-w-2xl"
        footer={
          <div className="space-y-2">
            {savePixel.isError && (
              <p className="rounded-lg border border-danger/40 bg-danger/10 p-2.5 text-xs text-danger">
                {t("adminSaveError")}
              </p>
            )}
            <div className="flex gap-2">
              <Button onClick={() => void onSave()} disabled={savePixel.isPending} fullWidth>
                {savePixel.isPending && <Spinner />}
                {t("save")}
              </Button>
              <Button variant="ghost" onClick={() => setDraft(null)} fullWidth>
                {t("cancel")}
              </Button>
            </div>
          </div>
        }
      >
        {draft && (
          <div className="space-y-4">
            <Field label={t("pxLabel")} hint={t("pxLabelHint")} required>
              <Input
                value={draft.label}
                onChange={(event) => setDraft({ ...draft, label: event.target.value })}
              />
            </Field>

            <Field
              label={t("pxPixelId")}
              hint={t("pxPixelIdHint")}
              error={idError ? t("pxPixelIdInvalid") : undefined}
              required
            >
              <Input
                dir="ltr"
                inputMode="numeric"
                value={draft.pixel_id}
                onChange={(event) => setDraft({ ...draft, pixel_id: event.target.value })}
              />
            </Field>

            <Field label={t("pxScope")}>
              <Select
                value={draft.scope}
                onChange={(event) =>
                  setDraft({ ...draft, scope: event.target.value as PixelScope })
                }
              >
                {(Object.keys(SCOPE_LABEL) as PixelScope[]).map((scope) => (
                  <option key={scope} value={scope}>
                    {t(SCOPE_LABEL[scope])}
                  </option>
                ))}
              </Select>
            </Field>

            {/* Hidden entirely when the scope is "all" — there is nothing to
                match against. One value per line is far easier on a phone than
                a chip editor. */}
            {draft.scope !== "all" && (
              <Field
                label={t("pxMatchValues")}
                hint={SCOPE_HINT[draft.scope] ? t(SCOPE_HINT[draft.scope]!) : undefined}
              >
                <Textarea
                  dir="ltr"
                  rows={4}
                  value={draft.matchText}
                  onChange={(event) => setDraft({ ...draft, matchText: event.target.value })}
                />
              </Field>
            )}

            <Field label={t("pxEvents")}>
              <div className="grid gap-2 sm:grid-cols-2">
                {EVENT_KEYS.map((key) => (
                  <Checkbox
                    key={key}
                    id={`px-${key}`}
                    label={t(EVENT_LABEL[key])}
                    checked={draft.events?.[key] !== false}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        events: { ...draft.events, [key]: event.target.checked },
                      })
                    }
                  />
                ))}
              </div>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("pxTestCode")}>
                <Input
                  dir="ltr"
                  value={draft.test_event_code ?? ""}
                  onChange={(event) =>
                    setDraft({ ...draft, test_event_code: event.target.value || null })
                  }
                />
              </Field>
              <Field label={t("pxSortOrder")}>
                <Input
                  type="number"
                  dir="ltr"
                  value={draft.sort_order}
                  onChange={(event) =>
                    setDraft({ ...draft, sort_order: Number(event.target.value) })
                  }
                />
              </Field>
            </div>

            <Field label={t("pxNotes")}>
              <Textarea
                rows={2}
                value={draft.notes ?? ""}
                onChange={(event) => setDraft({ ...draft, notes: event.target.value || null })}
              />
            </Field>

            <Checkbox
              id="px-active"
              label={t("pxActive")}
              checked={draft.active}
              onChange={(event) => setDraft({ ...draft, active: event.target.checked })}
            />
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={!!pendingDelete}
        busy={deletePixel.isPending}
        onClose={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (!pendingDelete) return;
          await deletePixel.mutateAsync(pendingDelete.id);
          setPendingDelete(null);
        }}
        title={t("adminConfirmDelete")}
        text={pendingDelete?.label}
      />
    </AdminPage>
  );
}
