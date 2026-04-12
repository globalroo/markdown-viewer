import { describe, it, expect } from "vitest";
import { extractLinksFromContent } from "../../src/main/linkIndex";

describe("extractLinksFromContent", () => {
  const filenameLookup = new Map<string, string[]>();

  it("extracts standard markdown links", () => {
    const content = "See [guide](./guide.md) for details.";
    const results = extractLinksFromContent(content, "/project/readme.md", filenameLookup);
    expect(results.length).toBe(1);
    expect(results[0].target).toContain("guide.md");
  });

  it("skips external http links", () => {
    const content = "Visit [site](https://example.com) and [other](http://foo.com).";
    const results = extractLinksFromContent(content, "/project/readme.md", filenameLookup);
    expect(results.length).toBe(0);
  });

  it("skips mailto links", () => {
    const content = "Email [me](mailto:a@b.com).";
    const results = extractLinksFromContent(content, "/project/readme.md", filenameLookup);
    expect(results.length).toBe(0);
  });

  it("skips anchor-only links", () => {
    const content = "Jump to [section](#heading).";
    const results = extractLinksFromContent(content, "/project/readme.md", filenameLookup);
    expect(results.length).toBe(0);
  });

  it("strips fragment from link before resolving", () => {
    const content = "See [guide](./guide.md#section).";
    const results = extractLinksFromContent(content, "/project/readme.md", filenameLookup);
    expect(results.length).toBe(1);
    expect(results[0].target).not.toContain("#");
  });

  it("adds .md extension when missing", () => {
    const content = "See [guide](./guide) for details.";
    const results = extractLinksFromContent(content, "/project/readme.md", filenameLookup);
    expect(results.length).toBe(1);
    expect(results[0].target).toMatch(/guide\.md$/);
  });

  it("resolves relative paths with ../", () => {
    const content = "See [parent](../other.md).";
    const results = extractLinksFromContent(content, "/project/docs/readme.md", filenameLookup);
    expect(results.length).toBe(1);
    expect(results[0].target).toContain("/project/other.md");
  });

  it("ignores links inside code blocks", () => {
    const content = "```\n[not a link](./foo.md)\n```";
    const results = extractLinksFromContent(content, "/project/readme.md", filenameLookup);
    expect(results.length).toBe(0);
  });

  it("extracts wiki-links when lookup has matches", () => {
    const lookup = new Map<string, string[]>();
    lookup.set("guide", ["/project/guide.md"]);
    const content = "Check [[guide]] for info.";
    const results = extractLinksFromContent(content, "/project/readme.md", lookup);
    expect(results.length).toBe(1);
    expect(results[0].target).toContain("guide.md");
  });

  it("extracts wiki-links with display text", () => {
    const lookup = new Map<string, string[]>();
    lookup.set("guide", ["/project/guide.md"]);
    const content = "Check [[guide|the guide]] for info.";
    const results = extractLinksFromContent(content, "/project/readme.md", lookup);
    expect(results.length).toBe(1);
  });

  it("skips non-markdown file links", () => {
    const content = "See [image](./photo.png).";
    const results = extractLinksFromContent(content, "/project/readme.md", filenameLookup);
    expect(results.length).toBe(0);
  });

  // SECURITY: Path traversal prevention
  it("filters out links that escape allowed roots", () => {
    const roots = new Set(["/project"]);
    const content = "See [secret](../../etc/passwd.md).";
    const results = extractLinksFromContent(content, "/project/docs/readme.md", filenameLookup, roots);
    expect(results.length).toBe(0);
  });

  it("allows links within allowed roots", () => {
    const roots = new Set(["/project"]);
    const content = "See [guide](./guide.md).";
    const results = extractLinksFromContent(content, "/project/readme.md", filenameLookup, roots);
    expect(results.length).toBe(1);
  });

  it("filters deep traversal attempts", () => {
    const roots = new Set(["/project"]);
    const content = "See [x](../../../../etc/hosts.md).";
    const results = extractLinksFromContent(content, "/project/docs/sub/readme.md", filenameLookup, roots);
    expect(results.length).toBe(0);
  });

  it("reports correct line numbers for duplicate identical links", () => {
    const content = "See [guide](./guide.md) here.\n\nAnd [guide](./guide.md) again.\n";
    const results = extractLinksFromContent(content, "/project/readme.md", filenameLookup);
    expect(results.length).toBe(2);
    expect(results[0].context.line).toBe(1);
    expect(results[1].context.line).toBe(3);
  });

  it("provides context with line numbers", () => {
    const content = "Line 1\n\nSee [guide](./guide.md) here.\n\nLine 4";
    const results = extractLinksFromContent(content, "/project/readme.md", filenameLookup);
    expect(results.length).toBe(1);
    expect(results[0].context.line).toBe(3);
    expect(results[0].context.text).toContain("guide");
  });

  // Edge cases (Issue 18)

  it("setext-style headings do not create false links", () => {
    const content = "My Heading\n==========\n\nSome text.\n\nAnother Heading\n---------------\n";
    const results = extractLinksFromContent(content, "/project/readme.md", filenameLookup);
    expect(results.length).toBe(0);
  });

  it("handles links with special characters in path", () => {
    const content = "See [notes](./my%20notes.md) and [report](./2024-Q1%20(final).md).";
    const results = extractLinksFromContent(content, "/project/readme.md", filenameLookup);
    expect(results.length).toBe(2);
  });

  it("does not extract links with unencoded spaces in path (invalid markdown)", () => {
    // Markdown parsers don't treat bare spaces in URLs as valid link targets
    const content = 'See [doc](./my doc.md).';
    const results = extractLinksFromContent(content, "/project/readme.md", filenameLookup);
    expect(results.length).toBe(0);
  });

  it("handles links with parentheses in path", () => {
    const content = "See [report](./report%20(draft).md).";
    const results = extractLinksFromContent(content, "/project/readme.md", filenameLookup);
    expect(results.length).toBe(1);
  });
});

describe("Generation token pattern (back-to-back async rebuild)", () => {
  // This tests the pattern used in main.ts rebuildLinkIndex():
  // When two async builds overlap, only the latest generation's result is kept.

  it("only the latest generation wins when two async builds overlap", async () => {
    let buildGen = 0;
    let currentIndex: string | null = null;

    // Simulate two overlapping async builds, mirroring rebuildLinkIndex()
    async function simulateBuild(label: string, delayMs: number): Promise<string> {
      // Simulate async work
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return label;
    }

    // First build starts (slow)
    const gen1 = ++buildGen;
    const build1 = simulateBuild("stale-build-1", 50).then((result) => {
      if (gen1 === buildGen) {
        currentIndex = result;
      }
    });

    // Second build starts immediately after (fast) — bumps the gen counter
    const gen2 = ++buildGen;
    const build2 = simulateBuild("fresh-build-2", 10).then((result) => {
      if (gen2 === buildGen) {
        currentIndex = result;
      }
    });

    // Wait for both to complete
    await Promise.all([build1, build2]);

    // Only the second (latest) build should have been accepted
    expect(currentIndex).toBe("fresh-build-2");
    expect(buildGen).toBe(2);
  });

  it("first build is discarded even if it finishes after second", async () => {
    let buildGen = 0;
    let currentIndex: string | null = "initial";

    async function simulateBuild(label: string, delayMs: number): Promise<string> {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return label;
    }

    // First build (very slow — finishes last)
    const gen1 = ++buildGen;
    const build1 = simulateBuild("slow-build", 80).then((result) => {
      if (gen1 === buildGen) {
        currentIndex = result;
      }
    });

    // Second build (fast — finishes first)
    const gen2 = ++buildGen;
    const build2 = simulateBuild("fast-build", 5).then((result) => {
      if (gen2 === buildGen) {
        currentIndex = result;
      }
    });

    // Third build (medium — the current latest)
    const gen3 = ++buildGen;
    const build3 = simulateBuild("latest-build", 20).then((result) => {
      if (gen3 === buildGen) {
        currentIndex = result;
      }
    });

    await Promise.all([build1, build2, build3]);

    // Only the third (latest gen) should be retained
    expect(currentIndex).toBe("latest-build");
    expect(buildGen).toBe(3);
  });
});
