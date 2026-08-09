import type { Config } from "tailwindcss";

/**
 * Colors are RGB triplets held in CSS variables and swapped by the
 * `data-theme` attribute on <html> (see src/theme/ThemeProvider.tsx).
 * That is why we do NOT use Tailwind's `dark:` class strategy anywhere:
 * `bg-panel` / `text-ink` / `border-line` are already theme-aware.
 */
const token = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: token("bg"),
        panel: token("panel"),
        "panel-2": token("panel-2"),
        line: token("line"),
        ink: token("ink"),
        muted: token("muted"),
        brand: token("brand"),
        "brand-dim": token("brand-dim"),
        "brand-lite": token("brand-lite"),
        "brand-deep": token("brand-deep"),
        "brand-ink": token("brand-ink"),
        danger: token("danger"),
        success: token("success"),
        warning: token("warning"),
      },
      /**
       * The reference site is built on square corners — every panel, button,
       * card and input is a hard rectangle, and that is most of what makes it
       * read as "technical" rather than "friendly SaaS". Rather than strip
       * `rounded-*` from ~90 files, the scale itself is flattened: existing
       * `rounded-lg` / `rounded-xl` classes keep working and simply render
       * sharp. `rounded-full` is untouched — pills and avatars still need it.
       */
      borderRadius: {
        none: "0px",
        sm: "0px",
        DEFAULT: "0px",
        md: "0px",
        lg: "0px",
        xl: "0px",
        "2xl": "0px",
        "3xl": "0px",
      },
      fontFamily: {
        display: ["Rajdhani", "system-ui", "sans-serif"],
        sans: ["Rajdhani", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "monospace"],
        ar: ["'Noto Kufi Arabic'", "system-ui", "sans-serif"],
      },
      spacing: {
        // Referenced by Button's lg size and the header cart badge; neither is
        // on Tailwind's default scale.
        13: "3.25rem",
        4.5: "1.125rem",
      },
      boxShadow: {
        glow: "0 0 24px -4px rgb(var(--c-brand) / 0.45)",
        "glow-sm": "0 0 12px -2px rgb(var(--c-brand) / 0.4)",
        // The reference site's card/product hover halo.
        accent: "0 0 20px rgb(var(--c-brand) / 0.18)",
        panel: "0 1px 0 0 rgb(var(--c-line) / 1)",
      },
      keyframes: {
        "fade-up": {
          "0%": { transform: "translateY(8px)" },
          "100%": { transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.4s ease-out both",
      },
    },
  },
  plugins: [],
} satisfies Config;
