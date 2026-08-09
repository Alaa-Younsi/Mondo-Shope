import { useCallback, useRef } from "react";

/**
 * Cheap bot deterrent for the checkout forms: a hidden field real users never
 * fill, plus a minimum time-to-submit (scripted form-fillers submit instantly).
 *
 * This only deters unsophisticated bots driving the actual HTML form. It does
 * nothing against a bot calling the place_order REST endpoint directly — that
 * is what the server-side validation and the per-phone rate limit in
 * 0003_functions.sql are for. Both layers ship together.
 */
export function useHoneypot(minMs = 1500) {
  const mountedAt = useRef(Date.now());

  const isSpam = useCallback(
    (honeypotValue: string | undefined | null) =>
      !!honeypotValue || Date.now() - mountedAt.current < minMs,
    [minMs],
  );

  return { isSpam };
}

/**
 * Wrapper for the honeypot input. It MUST be rendered — the input alone blanks
 * every Arabic page that carries a checkout form.
 *
 * The input is parked at -9999px, and an absolutely positioned element is only
 * clipped by an ancestor's `overflow` when that ancestor is its containing
 * block — i.e. is itself positioned. The form is not, so the input escapes to
 * the initial containing block and adds ~10 000px of overflow to the LEFT of
 * the viewport. In LTR that overflow is unreachable by spec and nothing shows
 * for it. Under `dir="rtl"` leftward IS the scrollable direction, so the
 * document became 11 255px wide and opened parked in the empty margin: a
 * perfectly blank page with a fully rendered DOM behind it.
 *
 * `relative` makes this div the containing block and `overflow-hidden` then
 * genuinely clips the input, while `h-0 w-0` keeps it out of the layout. The
 * input stays a real, off-screen, non-`display:none` field, which is what makes
 * the honeypot work at all.
 */
export const honeypotWrapperProps = {
  "aria-hidden": true,
  className: "relative h-0 w-0 overflow-hidden",
} as const;

/** Props for the hidden input. Keep it off-screen, not `display:none` — some
 *  bots skip hidden inputs but fill positioned ones. Render inside a
 *  {@link honeypotWrapperProps} div. */
export const honeypotFieldProps = {
  tabIndex: -1,
  autoComplete: "off",
  "aria-hidden": true,
  className:
    "absolute -left-[9999px] top-0 h-px w-px overflow-hidden opacity-0 pointer-events-none",
} as const;
