import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/** Storefront route changes should land at the top of the new page. */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);

  return null;
}
