import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { AdminPage, Panel } from "@/components/admin/AdminPage";
import { useAdminToast } from "@/components/admin/AdminToastProvider";
import { BlockEditor } from "@/components/admin/landing/BlockEditor";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/Form";
import { ErrorState, LoadingBlock, Spinner } from "@/components/ui/Feedback";
import { useLanguage } from "@/i18n/LanguageProvider";
import { useAdminLandingPage } from "@/hooks/useLandingPages";
import { useAllPixelsAdmin } from "@/hooks/useMetaPixels";
import { supabase } from "@/lib/supabase";
import { invalidateLandingPages } from "@/lib/queryCache";
import {
  BLOCK_LABEL,
  BLOCK_TYPES,
  DEFAULT_SEO,
  DEFAULT_THEME,
  createBlock,
  defaultBlocks,
} from "@/lib/landing";
import { cn, slugify } from "@/lib/utils";
import type { LandingBlock, LandingBlockType, LandingPage } from "@/types/landing";
import type { Product } from "@/types/db";

/**
 * Editable columns only. Same rule as the product form: never spread a row
 * loaded with select("*") into the write — PostgREST rejects the entire update
 * when the body names a generated column, and the edit becomes a silent no-op.
 */
type LandingFormState = Omit<LandingPage, "id" | "created_at" | "updated_at">;

const EMPTY: LandingFormState = {
  slug: "",
  product_id: null,
  status: "draft",
  title_fr: "",
  title_ar: "",
  theme: DEFAULT_THEME,
  blocks: defaultBlocks(),
  seo: DEFAULT_SEO,
  pixel_ids: [],
  show_header: false,
  show_footer: false,
};

function toFormState(row: LandingPage): LandingFormState {
  return {
    slug: row.slug,
    product_id: row.product_id,
    status: row.status,
    title_fr: row.title_fr,
    title_ar: row.title_ar,
    theme: row.theme,
    blocks: row.blocks,
    seo: row.seo,
    pixel_ids: row.pixel_ids,
    show_header: row.show_header,
    show_footer: row.show_footer,
  };
}

export default function LandingPageForm() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === "new";
  const { t } = useLanguage();
  const toast = useAdminToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: loaded, isLoading, isError } = useAdminLandingPage(id);
  const { data: pixels } = useAllPixelsAdmin();

  const { data: products } = useQuery({
    queryKey: ["admin-products-lite"],
    queryFn: async (): Promise<Array<Pick<Product, "id" | "name_fr" | "name_ar" | "status">>> => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name_fr, name_ar, status")
        .order("name_fr");
      if (error) throw error;
      return (data ?? []) as Array<Pick<Product, "id" | "name_fr" | "name_ar" | "status">>;
    },
  });

  const [form, setForm] = useState<LandingFormState>(EMPTY);
  const [openBlock, setOpenBlock] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [slugError, setSlugError] = useState<"required" | "taken" | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isNew) return;
    if (isError) {
      setLoadFailed(true);
      return;
    }
    if (isLoading) return;
    // A failed load must block the form rather than leaving it on blank
    // defaults the next Save would write over the real page.
    if (!loaded) {
      setLoadFailed(true);
      return;
    }
    setForm(toFormState(loaded));
  }, [isNew, isError, isLoading, loaded]);

  const patch = (values: Partial<LandingFormState>) =>
    setForm((current) => ({ ...current, ...values }));

  const setBlocks = (blocks: LandingBlock[]) => patch({ blocks });

  const moveBlock = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= form.blocks.length) return;
    const next = [...form.blocks];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    setBlocks(next);
  };

  const addBlock = (type: LandingBlockType) => {
    const block = createBlock(type);
    setBlocks([...form.blocks, block]);
    setOpenBlock(block.id);
    setAddOpen(false);
  };

  const onSave = async () => {
    const slug = slugify(form.slug || form.title_fr || form.title_ar);
    if (!slug) {
      setSlugError("required");
      return;
    }
    setSlugError(null);
    setSaving(true);

    try {
      // `slug` is unique and is the public URL, so a collision is a real
      // conflict the owner must resolve — not something to silently suffix.
      let existing = supabase.from("landing_pages").select("id").eq("slug", slug).limit(1);
      if (!isNew) existing = existing.neq("id", id!);
      const { data: clash, error: clashError } = await existing;
      if (clashError) {
        toast.error(t("adminSaveError"));
        return;
      }
      if (clash && clash.length > 0) {
        setSlugError("taken");
        return;
      }

      const payload: LandingFormState = { ...form, slug };

      if (isNew) {
        const { data, error } = await supabase
          .from("landing_pages")
          .insert(payload)
          .select("id")
          .single();
        if (error) {
          toast.error(t("adminSaveError"));
          return;
        }
        toast.success(t("adminSaved"));
        invalidateLandingPages(queryClient);
        navigate(`/admin/pages/${(data as { id: string }).id}`, { replace: true });
        return;
      }

      const { error } = await supabase.from("landing_pages").update(payload).eq("id", id!);
      if (error) {
        toast.error(t("adminSaveError"));
        return;
      }

      toast.success(t("adminSaved"));
      invalidateLandingPages(queryClient);
      queryClient.invalidateQueries({ queryKey: ["admin-landing-page", id] });
    } finally {
      setSaving(false);
    }
  };

  if (!isNew && isLoading) return <LoadingBlock label={t("loading")} />;

  if (loadFailed) {
    return (
      <AdminPage title={t("lpEdit")}>
        <ErrorState title={t("adminLoadError")} />
      </AdminPage>
    );
  }

  return (
    <AdminPage
      title={isNew ? t("lpNew") : t("lpEdit")}
      subtitle={form.slug ? `/lp/${slugify(form.slug)}` : undefined}
      action={
        <>
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin/pages")}>
            <ArrowLeft size={15} className="rtl:rotate-180" />
            {t("back")}
          </Button>
          {!isNew && form.status === "published" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`/lp/${form.slug}`, "_blank", "noopener")}
            >
              <Eye size={15} />
              {t("preview")}
            </Button>
          )}
          <Button size="sm" onClick={() => void onSave()} disabled={saving}>
            {saving ? <Spinner /> : <Save size={15} />}
            {saving ? t("saving") : t("save")}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <Panel title={t("lpTitle")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("lpTitleFr")} required>
              <Input
                value={form.title_fr}
                onChange={(event) => patch({ title_fr: event.target.value })}
              />
            </Field>
            <Field label={t("lpTitleAr")}>
              <Input
                dir="rtl"
                value={form.title_ar}
                onChange={(event) => patch({ title_ar: event.target.value })}
              />
            </Field>
            <Field
              label={t("lpSlug")}
              hint={t("lpSlugHint")}
              required
              error={
                slugError === "taken"
                  ? t("lpSlugTaken")
                  : slugError === "required"
                    ? t("lpSlugRequired")
                    : undefined
              }
            >
              <Input
                dir="ltr"
                value={form.slug}
                onChange={(event) => patch({ slug: event.target.value })}
              />
            </Field>
            <Field label={t("lpStatus")}>
              <Select
                value={form.status}
                onChange={(event) =>
                  patch({ status: event.target.value as LandingFormState["status"] })
                }
              >
                <option value="draft">{t("draft")}</option>
                <option value="published">{t("published")}</option>
              </Select>
            </Field>
            <Field label={t("lpProduct")} hint={t("lpProductHint")} className="sm:col-span-2">
              <Select
                value={form.product_id ?? ""}
                onChange={(event) => patch({ product_id: event.target.value || null })}
              >
                <option value="">{t("lpNoProduct")}</option>
                {(products ?? []).map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name_fr || product.name_ar}
                    {product.status === "draft" ? ` — ${t("draft")}` : ""}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Panel>

        {/* Blocks ------------------------------------------------------- */}
        <Panel
          title={t("lpBlocks")}
          action={
            <Button size="sm" variant="secondary" onClick={() => setAddOpen((open) => !open)}>
              <Plus size={14} />
              {t("lpAddBlock")}
            </Button>
          }
        >
          {addOpen && (
            <div className="mb-4 grid gap-2 rounded-lg border border-line bg-panel-2 p-3 sm:grid-cols-3 lg:grid-cols-4">
              {BLOCK_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => addBlock(type)}
                  className="rounded-lg border border-line px-3 py-2.5 text-start text-sm text-muted transition-colors hover:border-brand hover:text-brand"
                >
                  {t(BLOCK_LABEL[type])}
                </button>
              ))}
            </div>
          )}

          {form.blocks.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">{t("lpNoBlocks")}</p>
          ) : (
            <div className="space-y-2">
              {form.blocks.map((block, index) => (
                <div
                  key={block.id}
                  className={cn(
                    "rounded-lg border border-line bg-panel-2",
                    !block.visible && "opacity-55",
                  )}
                >
                  <div className="flex items-center gap-2 p-3">
                    <span className="font-mono text-[11px] text-muted">{index + 1}</span>
                    <button
                      type="button"
                      onClick={() => setOpenBlock(openBlock === block.id ? null : block.id)}
                      className="min-w-0 flex-1 text-start text-sm font-medium text-ink hover:text-brand"
                    >
                      {t(BLOCK_LABEL[block.type])}
                      {!block.visible && (
                        <Badge tone="neutral" className="ms-2">
                          {t("lpBlockHidden")}
                        </Badge>
                      )}
                    </button>

                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => moveBlock(index, -1)}
                        disabled={index === 0}
                        aria-label={t("lpMoveUp")}
                        className="rounded p-2 text-muted transition-colors hover:text-ink disabled:opacity-30"
                      >
                        <ChevronUp size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveBlock(index, 1)}
                        disabled={index === form.blocks.length - 1}
                        aria-label={t("lpMoveDown")}
                        className="rounded p-2 text-muted transition-colors hover:text-ink disabled:opacity-30"
                      >
                        <ChevronDown size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setBlocks(
                            form.blocks.map((entry) =>
                              entry.id === block.id
                                ? { ...entry, visible: !entry.visible }
                                : entry,
                            ),
                          )
                        }
                        aria-label={t("lpToggleVisible")}
                        className="rounded p-2 text-muted transition-colors hover:text-ink"
                      >
                        {block.visible ? <Eye size={15} /> : <EyeOff size={15} />}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setBlocks(form.blocks.filter((entry) => entry.id !== block.id))
                        }
                        aria-label={t("lpRemoveBlock")}
                        className="rounded p-2 text-muted transition-colors hover:text-danger"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {openBlock === block.id && (
                    <div className="border-t border-line p-4">
                      <BlockEditor
                        block={block}
                        onChange={(next) =>
                          setBlocks(
                            form.blocks.map((entry) => (entry.id === next.id ? next : entry)),
                          )
                        }
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* Appearance --------------------------------------------------- */}
        <Panel title={t("lpAppearance")}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label={t("lpAccent")} hint={t("lpAccentHint")}>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={form.theme.accent ?? "#faa642"}
                  onChange={(event) =>
                    patch({ theme: { ...form.theme, accent: event.target.value } })
                  }
                  className="h-11 w-14 shrink-0 cursor-pointer rounded-lg border border-line bg-panel-2 p-1"
                />
                <Button
                  variant="ghost"
                  onClick={() => patch({ theme: { ...form.theme, accent: null } })}
                >
                  {t("none")}
                </Button>
              </div>
            </Field>

            <Field label={t("lpBackground")}>
              <Select
                value={form.theme.background}
                onChange={(event) =>
                  patch({
                    theme: {
                      ...form.theme,
                      background: event.target.value as "dark" | "light",
                    },
                  })
                }
              >
                <option value="dark">{t("lpBackgroundDark")}</option>
                <option value="light">{t("lpBackgroundLight")}</option>
              </Select>
            </Field>

            <Field label={t("lpWidth")}>
              <Select
                value={form.theme.width}
                onChange={(event) =>
                  patch({
                    theme: {
                      ...form.theme,
                      width: event.target.value as "narrow" | "normal" | "wide",
                    },
                  })
                }
              >
                <option value="narrow">{t("lpWidthNarrow")}</option>
                <option value="normal">{t("lpWidthNormal")}</option>
                <option value="wide">{t("lpWidthWide")}</option>
              </Select>
            </Field>

            <Field label={t("lpRadius")}>
              <Select
                value={form.theme.radius}
                onChange={(event) =>
                  patch({
                    theme: {
                      ...form.theme,
                      radius: event.target.value as "sharp" | "soft",
                    },
                  })
                }
              >
                <option value="soft">{t("lpRadiusSoft")}</option>
                <option value="sharp">{t("lpRadiusSharp")}</option>
              </Select>
            </Field>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Checkbox
              id="lp-header"
              label={t("lpShowHeader")}
              checked={form.show_header}
              onChange={(event) => patch({ show_header: event.target.checked })}
            />
            <Checkbox
              id="lp-footer"
              label={t("lpShowFooter")}
              checked={form.show_footer}
              onChange={(event) => patch({ show_footer: event.target.checked })}
            />
          </div>
        </Panel>

        {/* SEO ---------------------------------------------------------- */}
        <Panel title={t("lpSeo")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("lpSeoTitleFr")}>
              <Input
                value={form.seo.title_fr ?? ""}
                onChange={(event) =>
                  patch({ seo: { ...form.seo, title_fr: event.target.value } })
                }
              />
            </Field>
            <Field label={t("lpSeoTitleAr")}>
              <Input
                dir="rtl"
                value={form.seo.title_ar ?? ""}
                onChange={(event) =>
                  patch({ seo: { ...form.seo, title_ar: event.target.value } })
                }
              />
            </Field>
            <Field label={t("lpSeoDescFr")}>
              <Textarea
                rows={2}
                value={form.seo.description_fr ?? ""}
                onChange={(event) =>
                  patch({ seo: { ...form.seo, description_fr: event.target.value } })
                }
              />
            </Field>
            <Field label={t("lpSeoDescAr")}>
              <Textarea
                rows={2}
                dir="rtl"
                value={form.seo.description_ar ?? ""}
                onChange={(event) =>
                  patch({ seo: { ...form.seo, description_ar: event.target.value } })
                }
              />
            </Field>
          </div>
          <div className="mt-4">
            <ImageUploader
              label={t("lpSeoImage")}
              prefix="landing/"
              value={form.seo.og_image ?? null}
              onChange={(og_image) => patch({ seo: { ...form.seo, og_image } })}
            />
          </div>
        </Panel>

        {/* Extra pixels ------------------------------------------------- */}
        <Panel title={t("lpPixels")}>
          <p className="mb-3 text-xs text-muted">{t("lpPixelsHint")}</p>
          {(pixels ?? []).length === 0 ? (
            <p className="text-sm text-muted">{t("pxNone")}</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {(pixels ?? []).map((pixel) => (
                <Checkbox
                  key={pixel.id}
                  id={`lp-px-${pixel.id}`}
                  label={pixel.label}
                  description={pixel.pixel_id}
                  checked={form.pixel_ids.includes(pixel.id)}
                  onChange={(event) =>
                    patch({
                      pixel_ids: event.target.checked
                        ? [...form.pixel_ids, pixel.id]
                        : form.pixel_ids.filter((entry) => entry !== pixel.id),
                    })
                  }
                />
              ))}
            </div>
          )}
        </Panel>
      </div>
    </AdminPage>
  );
}
