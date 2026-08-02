// Helpers for working with <img> URLs inside the rich content HTML. Regex-based
// so they run identically in any environment (no DOM needed). The editor emits
// simple <img src="..."> tags, so a permissive src matcher is sufficient.

const IMG_SRC_RE = /<img\b[^>]*?\bsrc\s*=\s*(["'])(.*?)\1/gi;

/** Collect every image src referenced in an HTML string. */
export function extractImageUrls(html: string): string[] {
  const urls: string[] = [];
  for (const match of html.matchAll(IMG_SRC_RE)) {
    if (match[2]) urls.push(match[2]);
  }
  return urls;
}

/**
 * Rewrite each <img src> via `map`. Returns the HTML unchanged for any URL the
 * mapper returns as-is. Used to swap remote URLs for offline blob URLs.
 */
export function rewriteImageUrls(
  html: string,
  map: (url: string) => string
): string {
  return html.replace(
    IMG_SRC_RE,
    (full, quote: string, url: string) => {
      const next = map(url);
      return next === url ? full : full.replace(url, next);
    }
  );
}
