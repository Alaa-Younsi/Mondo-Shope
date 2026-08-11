import type { TranslationKey } from "@/i18n/translations";
import type {
  LandingBlock,
  LandingBlockType,
  LandingSeo,
  LandingTheme,
} from "@/types/landing";
import { ICON_REGISTRY } from "./icons";
import { newId } from "./utils";

/** Order of the "add a block" menu — roughly the order a page is usually built. */
export const BLOCK_TYPES: LandingBlockType[] = [
  "hero",
  "bullets",
  "offer",
  "order_form",
  "features",
  "gallery",
  "video",
  "text",
  "reviews",
  "faq",
  "countdown",
  "trust",
  "cta",
  "spacer",
];

export const BLOCK_LABEL: Record<LandingBlockType, TranslationKey> = {
  hero: "blockHero",
  bullets: "blockBullets",
  features: "blockFeatures",
  gallery: "blockGallery",
  video: "blockVideo",
  text: "blockText",
  offer: "blockOffer",
  reviews: "blockReviews",
  faq: "blockFaq",
  countdown: "blockCountdown",
  trust: "blockTrust",
  order_form: "blockOrderForm",
  cta: "blockCta",
  spacer: "blockSpacer",
};

/**
 * Icon names offered in the feature/trust block editors. Every entry must exist
 * in ICON_REGISTRY (src/lib/icons.ts) — the picker is generated from that list
 * so the two can never drift.
 */
export const BLOCK_ICON_CHOICES = Object.keys(ICON_REGISTRY);

export const DEFAULT_THEME: LandingTheme = {
  accent: null,
  background: "dark",
  width: "normal",
  radius: "soft",
};

export const DEFAULT_SEO: LandingSeo = {
  title_fr: "",
  title_ar: "",
  description_fr: "",
  description_ar: "",
  og_image: null,
};

/** A freshly added block, pre-filled so the page never renders visibly empty. */
export function createBlock(type: LandingBlockType): LandingBlock {
  const base = { id: newId(), visible: true };

  switch (type) {
    case "hero":
      return {
        ...base,
        type,
        data: {
          eyebrow_fr: "Paiement à la livraison",
          eyebrow_ar: "الدفع عند الاستلام",
          title_fr: "",
          title_ar: "",
          subtitle_fr: "",
          subtitle_ar: "",
          image_url: null,
          cta_label_fr: "Commander maintenant",
          cta_label_ar: "اطلب الآن",
          cta_target: "order_form",
        },
      };
    case "bullets":
      return {
        ...base,
        type,
        data: { title_fr: "", title_ar: "", items: [{ text_fr: "", text_ar: "" }] },
      };
    case "features":
      return {
        ...base,
        type,
        data: {
          title_fr: "",
          title_ar: "",
          items: [
            { icon: "ShieldCheck", title_fr: "", title_ar: "", text_fr: "", text_ar: "" },
          ],
        },
      };
    case "gallery":
      return { ...base, type, data: { title_fr: "", title_ar: "", images: [] } };
    case "video":
      return {
        ...base,
        type,
        data: { title_fr: "", title_ar: "", url: "", poster_url: null },
      };
    case "text":
      return {
        ...base,
        type,
        data: { title_fr: "", title_ar: "", body_fr: "", body_ar: "", align: "start" },
      };
    case "offer":
      return {
        ...base,
        type,
        data: {
          title_fr: "",
          title_ar: "",
          note_fr: "",
          note_ar: "",
          show_compare_at: true,
          cta_label_fr: "Commander maintenant",
          cta_label_ar: "اطلب الآن",
          cta_target: "order_form",
        },
      };
    case "reviews":
      return {
        ...base,
        type,
        data: { title_fr: "", title_ar: "", source: "store", items: [] },
      };
    case "faq":
      return {
        ...base,
        type,
        data: {
          title_fr: "",
          title_ar: "",
          items: [{ q_fr: "", q_ar: "", a_fr: "", a_ar: "" }],
        },
      };
    case "countdown":
      return {
        ...base,
        type,
        data: { title_fr: "", title_ar: "", ends_at: null, note_fr: "", note_ar: "" },
      };
    case "trust":
      return {
        ...base,
        type,
        data: {
          items: [
            { icon: "ShieldCheck", label_fr: "Paiement à la livraison", label_ar: "الدفع عند الاستلام" },
            { icon: "Truck", label_fr: "Livraison 58 wilayas", label_ar: "التوصيل إلى 58 ولاية" },
            { icon: "BadgeCheck", label_fr: "Produit vérifié", label_ar: "منتج مفحوص" },
          ],
        },
      };
    case "order_form":
      return {
        ...base,
        type,
        data: {
          title_fr: "Commandez maintenant",
          title_ar: "اطلب الآن",
          note_fr: "",
          note_ar: "",
          ask_address: false,
          ask_notes: false,
        },
      };
    case "cta":
      return {
        ...base,
        type,
        data: {
          title_fr: "",
          title_ar: "",
          subtitle_fr: "",
          subtitle_ar: "",
          label_fr: "Commander maintenant",
          label_ar: "اطلب الآن",
          target: "order_form",
        },
      };
    case "spacer":
      return { ...base, type, data: { size: "md" } };
    default: {
      // Exhaustiveness guard: a new block type must be handled above.
      const never: never = type;
      throw new Error(`Unknown block type: ${String(never)}`);
    }
  }
}

/** The blocks a brand-new landing page starts with. */
export function defaultBlocks(): LandingBlock[] {
  return [
    createBlock("hero"),
    createBlock("trust"),
    createBlock("bullets"),
    createBlock("offer"),
    createBlock("order_form"),
    createBlock("reviews"),
    createBlock("faq"),
  ];
}

/**
 * Anchor ids the CTA targets scroll to. Rendered on the matching blocks.
 */
export const BLOCK_ANCHOR: Record<string, string> = {
  order_form: "lp-order",
  offer: "lp-offer",
  gallery: "lp-gallery",
  top: "lp-top",
};

/**
 * Normalise whatever came back from the database. Rows written before a block
 * type existed, or hand-edited jsonb, must never crash the renderer.
 */
export function normalizeBlocks(raw: unknown): LandingBlock[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (entry): entry is LandingBlock =>
        !!entry &&
        typeof entry === "object" &&
        typeof (entry as LandingBlock).type === "string" &&
        !!(entry as LandingBlock).data,
    )
    .map((entry) => ({
      ...entry,
      id: entry.id || newId(),
      visible: entry.visible !== false,
    }));
}

export function normalizeTheme(raw: unknown): LandingTheme {
  const value = (raw ?? {}) as Partial<LandingTheme>;
  return {
    accent: typeof value.accent === "string" && value.accent ? value.accent : null,
    background: value.background === "light" ? "light" : "dark",
    width:
      value.width === "narrow" || value.width === "wide" ? value.width : "normal",
    radius: value.radius === "sharp" ? "sharp" : "soft",
  };
}

export function normalizeSeo(raw: unknown): LandingSeo {
  const value = (raw ?? {}) as LandingSeo;
  return { ...DEFAULT_SEO, ...value };
}

/**
 * `ends_at` is stored as a UTC ISO string, but <input type="datetime-local">
 * speaks the VIEWER's local time. Slicing the ISO string straight into the
 * input (the previous approach) showed UTC as if it were local: in Algeria the
 * client set 20:00, reopened the block to find 19:00, and every re-save walked
 * the deadline back another hour.
 */
export function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** The inverse: a local "YYYY-MM-DDTHH:mm" back to a UTC ISO string. */
export function localInputToIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** "#RRGGBB" → "R G B" for the CSS variable override. Null when unparseable. */
export function hexToRgbTriplet(hex: string | null): string | null {
  if (!hex) return null;
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const int = parseInt(match[1], 16);
  return `${(int >> 16) & 255} ${(int >> 8) & 255} ${int & 255}`;
}
