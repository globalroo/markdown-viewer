// Shared between renderer and main process — the only cross-process shared code.
// Both the renderer's marked wiki-link extension and the main-process link index
// import these patterns to ensure identical link recognition.

export const WIKI_LINK_PATTERN = /^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/;
export const MARKDOWN_EXTENSIONS = /\.(md|markdown|mdown|mkd|mkdn)$/i;
