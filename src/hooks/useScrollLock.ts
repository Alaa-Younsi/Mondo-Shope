import { useEffect } from "react";

/**
 * Body scroll lock for open drawers/modals.
 *
 * Uses `position: fixed` at the current offset, NOT `overflow: hidden`. On iOS
 * Safari `overflow: hidden` does not stop the visual viewport rubber-banding
 * under a touch-drag, which drags the fixed backdrop and drawer out of sync
 * with real screen coordinates — a tap that visually lands on the close button
 * misses it, and nothing can close the panel short of a page reload.
 */
export function useScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked) return;

    const scrollY = window.scrollY;
    const body = document.body;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    };

    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";

    return () => {
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.width = previous.width;
      body.style.overflow = previous.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [locked]);
}
