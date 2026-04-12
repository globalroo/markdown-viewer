/**
 * Shared DOMPurify configuration used by both MarkdownPreview and CollapsiblePreview.
 * Centralised here to prevent drift between the two sanitisation call-sites.
 */
export const SANITIZE_CONFIG = {
  ADD_TAGS: [
    "input",
    "annotation",
    "semantics",
    "math",
    "mrow",
    "mi",
    "mo",
    "mn",
    "msup",
    "msub",
    "mfrac",
    "mtext",
    "mspace",
    "mover",
    "munder",
  ],
  ADD_ATTR: [
    "checked",
    "disabled",
    "type",
    "data-mermaid",
    "data-wiki-target",
    "aria-hidden",
    "style",
    "xmlns",
    "encoding",
  ],
  ADD_URI_SAFE_ATTR: ["src"],
  ALLOWED_URI_REGEXP:
    /^(?:(?:https?|local-img|data|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
};
