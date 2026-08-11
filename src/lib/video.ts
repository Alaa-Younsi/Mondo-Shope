/**
 * What the client will actually paste into a landing page's video field.
 *
 * The block used to render `<video src={url}>` unconditionally, which plays a
 * direct .mp4 and shows a dead black rectangle for a YouTube link — the single
 * most likely thing a store owner pastes. This resolves the URL into how it has
 * to be embedded.
 *
 * SECURITY: the returned embed URL is rebuilt from a matched id, never from the
 * input string. That is what keeps a `javascript:` or `data:` URL from reaching
 * an <iframe src>. Anything unrecognised returns null and the block renders
 * nothing rather than guessing.
 */

export type ResolvedVideo =
  | { kind: "file"; src: string }
  | { kind: "embed"; src: string; title: string };

/** Bare YouTube ids are 11 chars, but the charset is what actually matters. */
const YOUTUBE_ID = /^[A-Za-z0-9_-]{6,20}$/;
const VIMEO_ID = /^[0-9]{6,12}$/;

function youtubeId(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, "");

  if (host === "youtu.be") {
    const id = url.pathname.slice(1);
    return YOUTUBE_ID.test(id) ? id : null;
  }

  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    const watch = url.searchParams.get("v");
    if (watch && YOUTUBE_ID.test(watch)) return watch;

    // /embed/<id>, /shorts/<id>, /live/<id>
    const match = /^\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{6,20})/.exec(url.pathname);
    if (match) return match[1];
  }

  return null;
}

function vimeoId(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, "");
  if (host !== "vimeo.com" && host !== "player.vimeo.com") return null;
  const match = /(?:^|\/)([0-9]{6,12})(?:$|\/|\?)/.exec(url.pathname);
  return match && VIMEO_ID.test(match[1]) ? match[1] : null;
}

export function resolveVideo(raw: string | null | undefined): ResolvedVideo | null {
  const value = (raw ?? "").trim();
  if (!value) return null;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  // Anything else (javascript:, data:, blob:, file:) is rejected outright.
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const yt = youtubeId(url);
  if (yt) {
    // nocookie: no YouTube tracking cookie until the visitor actually plays.
    return {
      kind: "embed",
      src: `https://www.youtube-nocookie.com/embed/${yt}?rel=0`,
      title: "YouTube",
    };
  }

  const vimeo = vimeoId(url);
  if (vimeo) {
    return { kind: "embed", src: `https://player.vimeo.com/video/${vimeo}`, title: "Vimeo" };
  }

  // Everything else is treated as a direct file — an uploaded .mp4 in Supabase
  // storage, or any other host serving a playable file.
  return { kind: "file", src: url.toString() };
}
