/**
 * Resolve a potentially relative image src to a local-img:// protocol URL.
 *
 * Returns the original src unchanged if it is external (http(s), data, or
 * protocol-relative //). Otherwise decodes any pre-encoded characters,
 * resolves the path against `baseDir`, and re-encodes each segment for the
 * custom local-img:// protocol.
 *
 * Used by both the marked image renderer and the post-DOMPurify HTML
 * rewriter so the logic stays in one place.
 */
export function resolveLocalImageSrc(src: string, baseDir: string): string {
  // External or protocol-relative — leave alone
  if (/^(?:https?:|local-img:|data:|\/\/)/i.test(src)) {
    return src;
  }

  // Decode first to avoid double-encoding pre-encoded URLs (e.g. %20 -> %2520)
  let decoded: string;
  try {
    decoded = decodeURIComponent(src);
  } catch {
    decoded = src;
  }

  const cleanSrc = decoded.replace(/^\.\//, "");
  const isAbsolute = cleanSrc.startsWith("/") || /^[a-zA-Z]:[/\\]/.test(cleanSrc);
  const absolutePath = isAbsolute
    ? cleanSrc.replace(/\\/g, "/")
    : (baseDir + "/" + cleanSrc).replace(/\\/g, "/");
  const urlPath = absolutePath.startsWith("/") ? absolutePath : "/" + absolutePath;
  const encoded = urlPath.split("/").map((s) => encodeURIComponent(s)).join("/");
  return "local-img://" + encoded;
}
