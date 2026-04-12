import * as path from "path";
import * as fs from "fs";
import { marked } from "marked";
import { WIKI_LINK_PATTERN, MARKDOWN_EXTENSIONS } from "../shared/linkPatterns";

// Register wiki-link tokenizer so marked.lexer() recognizes [[wiki-links]].
// Only the tokenizer is needed — no renderer, no KaTeX, no mermaid.
marked.use({
  extensions: [{
    name: "wikiLink",
    level: "inline" as const,
    start(src: string) { return src.indexOf("[["); },
    tokenizer(src: string) {
      const match = WIKI_LINK_PATTERN.exec(src);
      if (match) {
        return {
          type: "wikiLink",
          raw: match[0],
          target: match[1].trim(),
          display: (match[2] || match[1]).trim(),
        };
      }
      return undefined;
    },
  }],
});

export interface LinkContext {
  line: number;
  text: string;
}

export interface LinkStatus {
  exists: boolean;
  lastModified: number | null;
}

export interface LinkGraph {
  outgoing: string[];
  incoming: string[];
  outgoingContexts: Record<string, LinkContext[]>;
  incomingContexts: Record<string, LinkContext[]>;
  outgoingStatus: Record<string, LinkStatus>;
}

export interface LinkIndexState {
  forwardLinks: Map<string, Set<string>>;
  backLinks: Map<string, Set<string>>;
  linkContexts: Map<string, Map<string, LinkContext[]>>;
  /** Map from lowercase filename stem to absolute paths (for wiki-link resolution) */
  filenameLookup: Map<string, string[]>;
  /** Allowed project roots for path traversal prevention */
  allowedRoots: Set<string>;
}

export function createLinkIndex(allowedRoots?: Set<string>): LinkIndexState {
  return {
    forwardLinks: new Map(),
    backLinks: new Map(),
    linkContexts: new Map(),
    filenameLookup: new Map(),
    allowedRoots: allowedRoots || new Set(),
  };
}

/**
 * Resolve a wiki-link target to an absolute file path.
 * Prefers files in the same directory, then closest ancestor.
 */
function resolveWikiLink(
  target: string,
  sourceDir: string,
  filenameLookup: Map<string, string[]>
): string | null {
  const stem = target.toLowerCase().replace(/\.md$/i, "");
  const candidates = filenameLookup.get(stem);
  if (!candidates || candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  // Prefer same directory
  const sameDir = candidates.find((c) => path.dirname(c) === sourceDir);
  if (sameDir) return sameDir;

  // Prefer closest ancestor
  let best = candidates[0];
  let bestCommon = 0;
  for (const c of candidates) {
    const common = commonPrefixLength(sourceDir, path.dirname(c));
    if (common > bestCommon) {
      bestCommon = common;
      best = c;
    }
  }
  return best;
}

function commonPrefixLength(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

/** Check if a resolved path falls within any allowed root (canonicalized) */
function isWithinRoots(resolvedPath: string, allowedRoots: Set<string>): boolean {
  // Canonicalize to handle symlinks — fall back to normalize if file doesn't exist yet.
  // Non-existent targets use normalized path, which is safe because the root IS
  // canonicalized (it exists) and prefix comparison still prevents traversal.
  // NOTE: Symlinked project roots are supported (roots are canonicalized via
  // realpathSync in addAllowedRoot). Links to not-yet-created files inside
  // symlinked roots will still pass the boundary check correctly.
  let canonical: string;
  try {
    canonical = fs.realpathSync(resolvedPath);
  } catch {
    canonical = path.normalize(resolvedPath);
  }
  for (const root of allowedRoots) {
    let canonicalRoot: string;
    try {
      canonicalRoot = fs.realpathSync(root);
    } catch {
      canonicalRoot = path.normalize(root);
    }
    if (canonical === canonicalRoot) return true;
    const prefix = canonicalRoot.endsWith(path.sep) ? canonicalRoot : canonicalRoot + path.sep;
    if (canonical.startsWith(prefix)) return true;
  }
  return false;
}

/**
 * Extract links from markdown content. Returns resolved absolute target paths.
 * Paths outside allowedRoots are filtered out to prevent path traversal.
 */
export function extractLinksFromContent(
  content: string,
  filePath: string,
  filenameLookup: Map<string, string[]>,
  allowedRoots?: Set<string>
): { target: string; context: LinkContext }[] {
  const results: { target: string; context: LinkContext }[] = [];
  const sourceDir = path.dirname(filePath);
  const lines = content.split("\n");

  let tokens;
  try {
    tokens = marked.lexer(content);
  } catch {
    return results;
  }

  // Walk tokens recursively to find links and wiki-links
  function walkTokens(tokenList: any[], lineOffset: number) {
    for (const token of tokenList) {
      if (token.type === "link") {
        const href: string = token.href || "";
        // Skip external, mailto, anchor-only links
        if (/^(https?:|mailto:|#)/.test(href)) continue;
        // Strip fragment
        const base = href.split("#")[0];
        if (!base) continue;
        // Resolve relative path
        let resolved = path.resolve(sourceDir, base);
        // Add .md if no extension
        if (!path.extname(resolved)) resolved += ".md";
        if (!MARKDOWN_EXTENSIONS.test(resolved)) continue;
        resolved = path.normalize(resolved);

        // Filter out paths that escape allowed project roots
        if (allowedRoots && !isWithinRoots(resolved, allowedRoots)) continue;

        const line = findLineNumber(content, token.raw, lineOffset);
        results.push({
          target: resolved,
          context: { line, text: lines[line - 1] || "" },
        });
      } else if (token.type === "wikiLink") {
        const target = token.target as string;
        const resolved = resolveWikiLink(target, sourceDir, filenameLookup);
        if (resolved) {
          const line = findLineNumber(content, token.raw, lineOffset);
          results.push({
            target: path.normalize(resolved),
            context: { line, text: lines[line - 1] || "" },
          });
        }
      }

      // Recurse into child tokens (paragraphs, list items, etc.)
      if (token.tokens) walkTokens(token.tokens, lineOffset);
      if (token.items) {
        for (const item of token.items) {
          if (item.tokens) walkTokens(item.tokens, lineOffset);
        }
      }
    }
  }

  walkTokens(tokens, 0);
  return results;
}

function findLineNumber(content: string, raw: string, _offset: number): number {
  const idx = content.indexOf(raw);
  if (idx === -1) return 1;
  let line = 1;
  for (let i = 0; i < idx; i++) {
    if (content[i] === "\n") line++;
  }
  return line;
}

/**
 * Build the filename lookup from all markdown files.
 */
function buildFilenameLookup(allFiles: string[]): Map<string, string[]> {
  const lookup = new Map<string, string[]>();
  for (const file of allFiles) {
    const stem = path.basename(file, path.extname(file)).toLowerCase();
    const list = lookup.get(stem) || [];
    list.push(file);
    lookup.set(stem, list);
  }
  return lookup;
}

/**
 * Build the full link index from all markdown files in all roots.
 */
export function buildLinkIndex(
  rootPaths: string[],
  collectMarkdownFiles: (dir: string) => string[],
  allowedRoots?: Set<string>
): LinkIndexState {
  const roots = allowedRoots || new Set(rootPaths);
  const state = createLinkIndex(roots);
  const allFiles: string[] = [];
  for (const root of rootPaths) {
    allFiles.push(...collectMarkdownFiles(root));
  }
  state.filenameLookup = buildFilenameLookup(allFiles);

  for (const file of allFiles) {
    let content: string;
    try {
      content = fs.readFileSync(file, "utf-8");
    } catch {
      continue;
    }
    indexFileContent(state, file, content);
  }

  return state;
}

function indexFileContent(state: LinkIndexState, filePath: string, content: string): void {
  const links = extractLinksFromContent(content, filePath, state.filenameLookup, state.allowedRoots);

  const targets = new Set<string>();
  const contexts = new Map<string, LinkContext[]>();

  for (const { target, context } of links) {
    targets.add(target);
    const list = contexts.get(target) || [];
    list.push(context);
    contexts.set(target, list);
  }

  state.forwardLinks.set(filePath, targets);
  state.linkContexts.set(filePath, contexts);

  // Update backlinks
  for (const target of targets) {
    let back = state.backLinks.get(target);
    if (!back) {
      back = new Set();
      state.backLinks.set(target, back);
    }
    back.add(filePath);
  }
}

/** Add a file path to the filename lookup */
function addToFilenameLookup(lookup: Map<string, string[]>, filePath: string): void {
  const stem = path.basename(filePath, path.extname(filePath)).toLowerCase();
  const list = lookup.get(stem) || [];
  if (!list.includes(filePath)) list.push(filePath);
  lookup.set(stem, list);
}

/** Remove a file path from the filename lookup */
function removeFromFilenameLookup(lookup: Map<string, string[]>, filePath: string): void {
  const stem = path.basename(filePath, path.extname(filePath)).toLowerCase();
  const list = lookup.get(stem);
  if (!list) return;
  const idx = list.indexOf(filePath);
  if (idx !== -1) list.splice(idx, 1);
  if (list.length === 0) lookup.delete(stem);
}

/**
 * Incrementally update the index for a single changed file.
 * Returns the set of files whose link graph was affected.
 */
export function updateLinkIndexForFile(
  state: LinkIndexState,
  filePath: string,
  newContent: string
): Set<string> {
  const affected = new Set<string>();
  affected.add(filePath);

  // Remove old forward links and backlinks
  const oldTargets = state.forwardLinks.get(filePath);
  if (oldTargets) {
    for (const target of oldTargets) {
      affected.add(target);
      const back = state.backLinks.get(target);
      if (back) {
        back.delete(filePath);
        if (back.size === 0) state.backLinks.delete(target);
      }
    }
  }
  state.forwardLinks.delete(filePath);
  state.linkContexts.delete(filePath);

  // Ensure file is in the filename lookup
  addToFilenameLookup(state.filenameLookup, filePath);

  // Re-index with new content
  indexFileContent(state, filePath, newContent);

  // Mark new targets as affected
  const newTargets = state.forwardLinks.get(filePath);
  if (newTargets) {
    for (const target of newTargets) affected.add(target);
  }

  return affected;
}

/**
 * Remove all entries for a file from the index.
 */
export function removeFileFromIndex(state: LinkIndexState, filePath: string): Set<string> {
  const affected = new Set<string>();
  affected.add(filePath);

  // Remove from filename lookup
  removeFromFilenameLookup(state.filenameLookup, filePath);

  const oldTargets = state.forwardLinks.get(filePath);
  if (oldTargets) {
    for (const target of oldTargets) {
      affected.add(target);
      const back = state.backLinks.get(target);
      if (back) {
        back.delete(filePath);
        if (back.size === 0) state.backLinks.delete(target);
      }
    }
  }
  state.forwardLinks.delete(filePath);
  state.linkContexts.delete(filePath);

  // Also remove from backlinks where this file is a target
  const backers = state.backLinks.get(filePath);
  if (backers) {
    for (const backer of backers) affected.add(backer);
    state.backLinks.delete(filePath);
  }

  return affected;
}

/**
 * Query the link graph for a single file.
 */
export function getLinkGraph(state: LinkIndexState, filePath: string): LinkGraph {
  const outgoing = Array.from(state.forwardLinks.get(filePath) || []);
  const incoming = Array.from(state.backLinks.get(filePath) || []);

  const outgoingContexts: Record<string, LinkContext[]> = {};
  const fileContexts = state.linkContexts.get(filePath);
  if (fileContexts) {
    for (const [target, ctxs] of fileContexts) {
      outgoingContexts[target] = ctxs;
    }
  }

  const incomingContexts: Record<string, LinkContext[]> = {};
  for (const source of incoming) {
    const sourceContexts = state.linkContexts.get(source);
    if (sourceContexts) {
      const ctxs = sourceContexts.get(filePath);
      if (ctxs) incomingContexts[source] = ctxs;
    }
  }

  // Check existence and modification time for each outgoing link
  // Only stat paths within allowed roots (path traversal prevention)
  const outgoingStatus: Record<string, LinkStatus> = {};
  for (const target of outgoing) {
    if (state.allowedRoots.size > 0 && !isWithinRoots(target, state.allowedRoots)) {
      outgoingStatus[target] = { exists: false, lastModified: null };
      continue;
    }
    try {
      const stat = fs.statSync(target);
      outgoingStatus[target] = { exists: true, lastModified: stat.mtimeMs };
    } catch {
      outgoingStatus[target] = { exists: false, lastModified: null };
    }
  }

  return { outgoing, incoming, outgoingContexts, incomingContexts, outgoingStatus };
}

/**
 * BFS walk to find all files connected within N hops.
 */
export function getConnectedPaths(
  state: LinkIndexState,
  filePath: string,
  hops: number
): string[] {
  const visited = new Set<string>();
  let frontier = [filePath];

  for (let depth = 0; depth <= hops; depth++) {
    const next: string[] = [];
    for (const current of frontier) {
      if (visited.has(current)) continue;
      visited.add(current);
      const forward = state.forwardLinks.get(current);
      if (forward) for (const t of forward) next.push(t);
      const backward = state.backLinks.get(current);
      if (backward) for (const s of backward) next.push(s);
    }
    frontier = next;
  }

  return Array.from(visited);
}
