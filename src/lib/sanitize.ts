"use client";

// Minimal HTML sanitizer for the admin-authored rich content. The editor only
// emits a known, small set of tags; this strips anything else (notably scripts,
// event handlers, and javascript: URLs) before we render it with
// dangerouslySetInnerHTML. Runs in the browser using the DOM parser.

const ALLOWED_TAGS = new Set([
  "P",
  "BR",
  "B",
  "STRONG",
  "I",
  "EM",
  "U",
  "H2",
  "H3",
  "UL",
  "OL",
  "LI",
  "BLOCKQUOTE",
  "A",
  "IMG",
  "DIV",
  "SPAN",
]);

// Attributes we keep, per tag. Everything else (onclick, style, etc.) is dropped.
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  A: new Set(["href", "target", "rel"]),
  IMG: new Set(["src", "alt"]),
};

function isSafeUrl(url: string): boolean {
  const trimmed = url.trim().toLowerCase();
  // Allow http(s), protocol-relative, root/relative, data:image, and blob URLs.
  return (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("data:image/") ||
    trimmed.startsWith("blob:")
  );
}

function scrub(node: Element) {
  const children = Array.from(node.children);
  for (const child of children) {
    if (!ALLOWED_TAGS.has(child.tagName)) {
      // Unwrap unknown elements: keep their text, drop the tag itself.
      child.replaceWith(...Array.from(child.childNodes));
      continue;
    }

    const allowed = ALLOWED_ATTRS[child.tagName] ?? new Set<string>();
    for (const attr of Array.from(child.attributes)) {
      if (!allowed.has(attr.name.toLowerCase())) {
        child.removeAttribute(attr.name);
      }
    }

    if (
      (child.tagName === "A" && child.getAttribute("href")) ||
      (child.tagName === "IMG" && child.getAttribute("src"))
    ) {
      const urlAttr = child.tagName === "A" ? "href" : "src";
      const url = child.getAttribute(urlAttr) ?? "";
      if (!isSafeUrl(url)) child.removeAttribute(urlAttr);
    }

    if (child.tagName === "A") {
      // Harden external links opened in a new tab.
      child.setAttribute("rel", "noopener noreferrer");
    }

    scrub(child);
  }
}

/** Sanitize an untrusted HTML string. Returns "" outside the browser. */
export function sanitizeHtml(html: string): string {
  if (typeof document === "undefined") return "";
  const doc = document.implementation.createHTMLDocument("");
  doc.body.innerHTML = html;
  scrub(doc.body);
  return doc.body.innerHTML;
}
