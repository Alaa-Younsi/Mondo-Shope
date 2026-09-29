/**
 * localStorage that never throws.
 *
 * Safari with "Block all cookies", some in-app browsers (Instagram, Facebook)
 * and locked-down WebViews throw on the first `localStorage` access. The theme
 * and language providers read it during their very first render, so an
 * unguarded access there is a blank page for that visitor, not a lost setting.
 */
export function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Preference simply does not persist; the session still works.
  }
}
