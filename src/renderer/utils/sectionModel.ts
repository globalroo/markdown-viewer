import { marked, type Token, type TokensList, type Tokens } from "marked";

export interface SectionHeading {
  id: string;
  text: string;
  level: number;
  positionalIndex: number;
}

export interface Section {
  heading: SectionHeading;
  tokens: Token[];
  rawLineCount: number;
  children: Section[];
}

export interface SectionModel {
  sourceFile: string;
  preamble: Token[];
  sections: Section[];
  flatHeadings: SectionHeading[];
  annotatedTokens: TokensList;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]*>/g, "")
    .replace(/&[^;]+;/g, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function countLines(tokens: Token[]): number {
  let count = 0;
  for (const token of tokens) {
    if (token.raw) {
      count += token.raw.split("\n").length - 1;
    }
  }
  // Add 1 because lines = newlines + 1 for non-empty content
  return tokens.length > 0 ? count + 1 : 0;
}

function getPlainText(token: Tokens.Heading): string {
  return (token.text || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
}

/**
 * Builds a section model from markdown content.
 * Stamps _canonicalId on each heading token for the renderer to consume.
 * Returns annotatedTokens (the full token list with IDs stamped) so the
 * renderer can pass them to marked.parser() for standard-mode rendering.
 */
export function buildSectionModel(content: string, sourceFile: string): SectionModel {
  const tokens = marked.lexer(content) as TokensList;
  const flatHeadings: SectionHeading[] = [];
  let positionalIndex = 0;

  // Pass 1: stamp canonical IDs on heading tokens
  for (const token of tokens) {
    if (token.type === "heading") {
      const heading = token as Tokens.Heading;
      const text = getPlainText(heading);
      const id = `${slugify(text)}-L${heading.depth}-${positionalIndex}`;
      (token as any)._canonicalId = id;
      flatHeadings.push({
        id,
        text,
        level: heading.depth,
        positionalIndex,
      });
      positionalIndex++;
    }
  }

  // Pass 2: split tokens into sections by heading boundaries
  // Each heading starts a new section; its tokens are everything until the next heading
  const preamble: Token[] = [];

  interface FlatSection {
    heading: SectionHeading;
    tokens: Token[];
    level: number;
  }

  const flatSections: FlatSection[] = [];
  let currentTokens: Token[] = preamble;
  let headingIdx = 0;

  for (const token of tokens) {
    if (token.type === "heading") {
      const heading = flatHeadings[headingIdx];
      const sectionTokens: Token[] = [];
      currentTokens = sectionTokens;
      flatSections.push({
        heading,
        tokens: sectionTokens,
        level: heading.level,
      });
      headingIdx++;
    } else {
      currentTokens.push(token);
    }
  }

  // Pass 3: nest sections into a tree based on heading levels
  function nestSections(
    flat: FlatSection[],
    startIdx: number,
    parentLevel: number
  ): { sections: Section[]; nextIdx: number } {
    const sections: Section[] = [];
    let i = startIdx;

    while (i < flat.length) {
      const entry = flat[i];
      // Stop when we hit a heading at or above the parent level
      if (entry.level <= parentLevel) {
        break;
      }

      // Collect children (headings deeper than this entry)
      const { sections: children, nextIdx } = nestSections(flat, i + 1, entry.level);

      sections.push({
        heading: entry.heading,
        tokens: entry.tokens,
        rawLineCount: countLines(entry.tokens),
        children,
      });

      i = nextIdx;
    }

    return { sections, nextIdx: i };
  }

  const { sections } = nestSections(flatSections, 0, 0);

  return {
    sourceFile,
    preamble,
    sections,
    flatHeadings,
    annotatedTokens: tokens,
  };
}

/**
 * Diffs two heading lists and maps old IDs to new IDs by LCS matching on text+level.
 * Used to transfer fold state when the document's heading structure changes.
 */
export function diffHeadingIds(
  prev: SectionHeading[],
  next: SectionHeading[]
): Map<string, string> {
  const mapping = new Map<string, string>();

  const m = prev.length;
  const n = next.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (prev[i - 1].text === next[j - 1].text && prev[i - 1].level === next[j - 1].level) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (prev[i - 1].text === next[j - 1].text && prev[i - 1].level === next[j - 1].level) {
      mapping.set(prev[i - 1].id, next[j - 1].id);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return mapping;
}

/**
 * Renders a subset of tokens to HTML via marked.parser().
 * Preserves the links property from the parent TokensList.
 */
export function renderSectionHtml(tokens: Token[], parentLinks?: Record<string, any>): string {
  const tokensList = tokens.slice() as TokensList;
  tokensList.links = parentLinks || {};
  return marked.parser(tokensList);
}
