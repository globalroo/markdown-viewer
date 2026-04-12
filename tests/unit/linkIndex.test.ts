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
});
