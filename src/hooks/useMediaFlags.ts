import { useEffect, useState } from "react";

interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: string;
}

/**
 * Gates decorative work off phones, slow connections and data-saver mode.
 * Those visitors get the plain layout — never a broken one.
 */
export function useMediaFlags() {
  const [flags, setFlags] = useState(() => readFlags());

  useEffect(() => {
    const onResize = () => setFlags(readFlags());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return flags;
}

function readFlags() {
  if (typeof window === "undefined") {
    return { isMobile: false, saveData: false, reducedMotion: false, heavyOk: true };
  }

  const connection = (navigator as Navigator & { connection?: NetworkInformation })
    .connection;
  const saveData = !!connection?.saveData;
  const slow =
    connection?.effectiveType === "2g" || connection?.effectiveType === "slow-2g";
  const isMobile = window.matchMedia("(max-width: 768px)").matches;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return {
    isMobile,
    saveData,
    reducedMotion,
    heavyOk: !isMobile && !saveData && !slow && !reducedMotion,
  };
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
