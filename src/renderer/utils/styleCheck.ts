/**
 * Lightweight style-check engine inspired by iA Writer's Style Check
 * and Marked 2's readability scores.
 *
 * No external NLP dependencies — just pattern matching.
 */

export interface StyleIssue {
  start: number;
  end: number;
  text: string;
  type: "filler" | "passive" | "cliche";
  suggestion?: string;
}

// ---------------------------------------------------------------------------
// Filler words
// ---------------------------------------------------------------------------

const FILLER_WORDS = [
  "very",
  "really",
  "quite",
  "basically",
  "actually",
  "literally",
  "just",
  "simply",
  "totally",
  "completely",
  "absolutely",
  "definitely",
  "certainly",
  "obviously",
  "clearly",
];

// Build a single regex that matches any filler word at a word boundary.
// Case-insensitive.
const fillerPattern = new RegExp(
  `\\b(${FILLER_WORDS.join("|")})\\b`,
  "gi"
);

// ---------------------------------------------------------------------------
// Passive voice (simplified detection)
// ---------------------------------------------------------------------------

// Common past participles — a pragmatic subset, not exhaustive.
const PAST_PARTICIPLES = [
  "accepted",
  "achieved",
  "added",
  "affected",
  "agreed",
  "allowed",
  "applied",
  "asked",
  "assumed",
  "avoided",
  "based",
  "been",
  "believed",
  "broken",
  "built",
  "called",
  "caused",
  "changed",
  "chosen",
  "claimed",
  "closed",
  "completed",
  "concerned",
  "considered",
  "controlled",
  "covered",
  "created",
  "damaged",
  "decided",
  "defined",
  "delivered",
  "described",
  "designed",
  "destroyed",
  "determined",
  "developed",
  "discovered",
  "discussed",
  "done",
  "driven",
  "eaten",
  "enabled",
  "established",
  "estimated",
  "examined",
  "expected",
  "explained",
  "expressed",
  "faced",
  "felt",
  "fixed",
  "followed",
  "forced",
  "forgotten",
  "formed",
  "found",
  "frozen",
  "given",
  "gone",
  "grown",
  "handled",
  "heard",
  "held",
  "hidden",
  "hit",
  "identified",
  "implemented",
  "improved",
  "included",
  "increased",
  "influenced",
  "informed",
  "inspired",
  "introduced",
  "involved",
  "kept",
  "killed",
  "known",
  "led",
  "left",
  "lost",
  "made",
  "managed",
  "measured",
  "met",
  "moved",
  "needed",
  "noted",
  "observed",
  "obtained",
  "offered",
  "opened",
  "organized",
  "owned",
  "paid",
  "performed",
  "placed",
  "planned",
  "played",
  "prepared",
  "presented",
  "produced",
  "proposed",
  "protected",
  "provided",
  "published",
  "put",
  "raised",
  "reached",
  "received",
  "recognized",
  "recommended",
  "reduced",
  "released",
  "removed",
  "replaced",
  "reported",
  "represented",
  "required",
  "resolved",
  "reviewed",
  "run",
  "said",
  "seen",
  "selected",
  "sent",
  "set",
  "shared",
  "shown",
  "sold",
  "solved",
  "spent",
  "spoken",
  "started",
  "stolen",
  "stopped",
  "stored",
  "studied",
  "supported",
  "taken",
  "taught",
  "tested",
  "thought",
  "told",
  "torn",
  "treated",
  "turned",
  "understood",
  "updated",
  "used",
  "viewed",
  "wanted",
  "warned",
  "wasted",
  "watched",
  "won",
  "worn",
  "written",
];

const pastParticipleAlternation = PAST_PARTICIPLES.join("|");

// Match: "was/were/is/are/am/be/been/being/get/gets/got/gotten + (adverb)? + past participle"
const passivePattern = new RegExp(
  `\\b(was|were|is|are|am|be|been|being|get|gets|got|gotten)\\s+(?:\\w+ly\\s+)?(?:${pastParticipleAlternation})\\b`,
  "gi"
);

// ---------------------------------------------------------------------------
// Cliches
// ---------------------------------------------------------------------------

const CLICHES: { phrase: string; suggestion?: string }[] = [
  { phrase: "at the end of the day", suggestion: "ultimately" },
  { phrase: "it goes without saying", suggestion: "omit or state directly" },
  { phrase: "needless to say", suggestion: "omit" },
  { phrase: "in terms of", suggestion: "regarding" },
  { phrase: "in order to", suggestion: "to" },
  { phrase: "due to the fact", suggestion: "because" },
  { phrase: "at this point in time", suggestion: "now" },
  { phrase: "each and every", suggestion: "each or every" },
  { phrase: "first and foremost", suggestion: "first" },
  { phrase: "few and far between", suggestion: "rare" },
  { phrase: "last but not least", suggestion: "finally" },
  { phrase: "as a matter of fact", suggestion: "in fact" },
  { phrase: "by and large", suggestion: "generally" },
  { phrase: "when all is said and done", suggestion: "ultimately" },
  { phrase: "on the other hand", suggestion: "however" },
  { phrase: "the fact of the matter", suggestion: "omit or state directly" },
  { phrase: "all things considered", suggestion: "overall" },
];

// Build a single regex for all cliches (escaped)
const clichePattern = new RegExp(
  CLICHES.map((c) => c.phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
  "gi"
);

// Build a lookup map for quick suggestion retrieval
const clicheSuggestionMap = new Map(
  CLICHES.map((c) => [c.phrase.toLowerCase(), c.suggestion])
);

// ---------------------------------------------------------------------------
// Analyse function
// ---------------------------------------------------------------------------

/**
 * Strip code blocks, inline code, HTML tags, and frontmatter so we only
 * analyse prose. Returns cleaned text.
 */
function stripNonProse(text: string): string {
  let cleaned = text;
  // Remove YAML frontmatter
  cleaned = cleaned.replace(/^---[\s\S]*?---/m, (m) => " ".repeat(m.length));
  // Remove fenced code blocks (``` or ~~~)
  cleaned = cleaned.replace(/(`{3,}|~{3,})[\s\S]*?\1/g, (m) => " ".repeat(m.length));
  // Remove inline code
  cleaned = cleaned.replace(/`[^`]+`/g, (m) => " ".repeat(m.length));
  // Remove HTML tags
  cleaned = cleaned.replace(/<[^>]+>/g, (m) => " ".repeat(m.length));
  // Remove link URLs but keep display text: [text](url) -> text
  cleaned = cleaned.replace(/\[([^\]]*)\]\([^)]*\)/g, (m, text) => {
    const before = " ".repeat(1); // the [
    const after = " ".repeat(m.length - text.length - 1);
    return before + text + after;
  });
  // Remove image syntax
  cleaned = cleaned.replace(/!\[([^\]]*)\]\([^)]*\)/g, (m) => " ".repeat(m.length));
  return cleaned;
}

export function analyzeText(text: string): StyleIssue[] {
  if (!text || text.length === 0) return [];

  const cleaned = stripNonProse(text);
  const issues: StyleIssue[] = [];

  // Filler words
  fillerPattern.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = fillerPattern.exec(cleaned)) !== null) {
    issues.push({
      start: match.index,
      end: match.index + match[0].length,
      text: match[0],
      type: "filler",
      suggestion: `Consider removing "${match[0]}"`,
    });
  }

  // Passive voice
  passivePattern.lastIndex = 0;
  while ((match = passivePattern.exec(cleaned)) !== null) {
    issues.push({
      start: match.index,
      end: match.index + match[0].length,
      text: match[0],
      type: "passive",
      suggestion: "Consider using active voice",
    });
  }

  // Cliches
  clichePattern.lastIndex = 0;
  while ((match = clichePattern.exec(cleaned)) !== null) {
    const replacement = clicheSuggestionMap.get(match[0].toLowerCase());
    issues.push({
      start: match.index,
      end: match.index + match[0].length,
      text: match[0],
      type: "cliche",
      suggestion: replacement ? `Try: "${replacement}"` : "Consider rephrasing",
    });
  }

  // Sort by position
  issues.sort((a, b) => a.start - b.start);

  return issues;
}

// ---------------------------------------------------------------------------
// Readability — Flesch-Kincaid Grade Level
// ---------------------------------------------------------------------------

/**
 * Count syllables in an English word (approximation).
 */
function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length <= 2) return 1;

  // Remove trailing silent e
  const working = w.replace(/e$/, "");
  // Count vowel groups
  const vowelGroups = working.match(/[aeiouy]+/g);
  const count = vowelGroups ? vowelGroups.length : 1;
  return Math.max(1, count);
}

/**
 * Split text into sentences (simple heuristic).
 */
function countSentences(text: string): number {
  const matches = text.match(/[.!?]+(\s|$)/g);
  return matches ? matches.length : Math.max(1, 1);
}

export interface ReadabilityStats {
  gradeLevel: number;
  readingEase: number;
  label: string;
}

/**
 * Compute Flesch-Kincaid readability metrics for the given prose text.
 * Returns grade level, reading ease score, and a human-friendly label.
 */
export function computeReadability(text: string): ReadabilityStats {
  const cleaned = stripNonProse(text);
  const words = cleaned.trim().split(/\s+/).filter((w) => w.length > 0);
  const wordCount = words.length;

  if (wordCount === 0) {
    return { gradeLevel: 0, readingEase: 100, label: "N/A" };
  }

  const sentenceCount = countSentences(cleaned);
  const syllableCount = words.reduce((sum, w) => sum + countSyllables(w), 0);

  // Flesch-Kincaid Grade Level
  const gradeLevel =
    0.39 * (wordCount / sentenceCount) +
    11.8 * (syllableCount / wordCount) -
    15.59;

  // Flesch Reading Ease
  const readingEase =
    206.835 -
    1.015 * (wordCount / sentenceCount) -
    84.6 * (syllableCount / wordCount);

  // Human label
  let label: string;
  const ease = Math.round(readingEase);
  if (ease >= 90) label = "Very Easy";
  else if (ease >= 80) label = "Easy";
  else if (ease >= 70) label = "Fairly Easy";
  else if (ease >= 60) label = "Standard";
  else if (ease >= 50) label = "Fairly Difficult";
  else if (ease >= 30) label = "Difficult";
  else label = "Very Difficult";

  return {
    gradeLevel: Math.max(0, Math.round(gradeLevel * 10) / 10),
    readingEase: Math.max(0, Math.min(100, Math.round(readingEase * 10) / 10)),
    label,
  };
}
