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

/** Props for the hidden input. Keep it off-screen, not `display:none` — some
 *  bots skip hidden inputs but fill positioned ones. */
export const honeypotFieldProps = {
  tabIndex: -1,
  autoComplete: "off",
  "aria-hidden": true,
  className:
    "absolute -left-[9999px] top-0 h-px w-px overflow-hidden opacity-0 pointer-events-none",
} as const;
