import { describe, it, expect } from "vitest";
import { buildSectionModel, diffHeadingIds } from "../../src/renderer/utils/sectionModel";

describe("buildSectionModel", () => {
  it("handles empty document", () => {
    const model = buildSectionModel("", "test.md");
    expect(model.sections).toHaveLength(0);
    expect(model.flatHeadings).toHaveLength(0);
    expect(model.preamble).toHaveLength(0);
  });

  it("handles document with no headings", () => {
    const model = buildSectionModel("Hello world\n\nSome paragraph text.", "test.md");
    expect(model.sections).toHaveLength(0);
    expect(model.flatHeadings).toHaveLength(0);
    expect(model.preamble.length).toBeGreaterThan(0);
  });

  it("handles single heading", () => {
    const model = buildSectionModel("# Title\n\nBody text.", "test.md");
    expect(model.sections).toHaveLength(1);
    expect(model.flatHeadings).toHaveLength(1);
    expect(model.flatHeadings[0].text).toBe("Title");
    expect(model.flatHeadings[0].level).toBe(1);
    expect(model.preamble).toHaveLength(0);
  });

  it("handles preamble before first heading", () => {
    const model = buildSectionModel("Preamble text\n\n# Title\n\nBody.", "test.md");
    expect(model.preamble.length).toBeGreaterThan(0);
    expect(model.sections).toHaveLength(1);
    expect(model.flatHeadings[0].text).toBe("Title");
  });

  it("handles multiple same-level headings as siblings", () => {
    const md = "# First\n\nA\n\n# Second\n\nB\n\n# Third\n\nC";
    const model = buildSectionModel(md, "test.md");
    expect(model.sections).toHaveLength(3);
    expect(model.sections[0].heading.text).toBe("First");
    expect(model.sections[1].heading.text).toBe("Second");
    expect(model.sections[2].heading.text).toBe("Third");
    // None should be nested as children of another
    expect(model.sections[0].children).toHaveLength(0);
    expect(model.sections[1].children).toHaveLength(0);
    expect(model.sections[2].children).toHaveLength(0);
  });

  it("handles h1 > h2 nesting correctly", () => {
    const md = "# Parent\n\n## Child A\n\nA text\n\n## Child B\n\nB text";
    const model = buildSectionModel(md, "test.md");
    expect(model.sections).toHaveLength(1);
    expect(model.sections[0].heading.text).toBe("Parent");
    expect(model.sections[0].children).toHaveLength(2);
    expect(model.sections[0].children[0].heading.text).toBe("Child A");
    expect(model.sections[0].children[1].heading.text).toBe("Child B");
  });

  it("handles h1 > h2 > h3 deep nesting", () => {
    const md = "# Top\n\n## Mid\n\n### Deep\n\nContent";
    const model = buildSectionModel(md, "test.md");
    expect(model.sections).toHaveLength(1);
    expect(model.sections[0].children).toHaveLength(1);
    expect(model.sections[0].children[0].children).toHaveLength(1);
    expect(model.sections[0].children[0].children[0].heading.text).toBe("Deep");
  });

  it("handles mixed levels: h1, h1, h2, h2, h3", () => {
    const md = "# A\n\n# B\n\n## B1\n\n## B2\n\n### B2a";
    const model = buildSectionModel(md, "test.md");
    expect(model.sections).toHaveLength(2);
    expect(model.sections[0].heading.text).toBe("A");
    expect(model.sections[0].children).toHaveLength(0);
    expect(model.sections[1].heading.text).toBe("B");
    expect(model.sections[1].children).toHaveLength(2);
    expect(model.sections[1].children[0].heading.text).toBe("B1");
    expect(model.sections[1].children[1].heading.text).toBe("B2");
    expect(model.sections[1].children[1].children).toHaveLength(1);
    expect(model.sections[1].children[1].children[0].heading.text).toBe("B2a");
  });

  it("handles skipped levels (h1 > h3)", () => {
    const md = "# Title\n\n### Skipped to h3\n\nContent";
    const model = buildSectionModel(md, "test.md");
    expect(model.sections).toHaveLength(1);
    // h3 is deeper than h1, so it becomes a child
    expect(model.sections[0].children).toHaveLength(1);
    expect(model.sections[0].children[0].heading.text).toBe("Skipped to h3");
  });

  it("handles duplicate heading text", () => {
    const md = "## Setup\n\nA\n\n## Setup\n\nB";
    const model = buildSectionModel(md, "test.md");
    expect(model.sections).toHaveLength(2);
    // Both have "Setup" text but different IDs due to positional index
    expect(model.flatHeadings[0].text).toBe("Setup");
    expect(model.flatHeadings[1].text).toBe("Setup");
    expect(model.flatHeadings[0].id).not.toBe(model.flatHeadings[1].id);
  });

  it("stamps _canonicalId on heading tokens", () => {
    const md = "# Title\n\n## Sub";
    const model = buildSectionModel(md, "test.md");
    const headingTokens = model.annotatedTokens.filter(
      (t: any) => t.type === "heading"
    );
    expect(headingTokens).toHaveLength(2);
    expect((headingTokens[0] as any)._canonicalId).toBe(model.flatHeadings[0].id);
    expect((headingTokens[1] as any)._canonicalId).toBe(model.flatHeadings[1].id);
  });

  it("generates stable IDs with format slug-L{level}-{index}", () => {
    const md = "# Hello World\n\n## Sub Section";
    const model = buildSectionModel(md, "test.md");
    expect(model.flatHeadings[0].id).toBe("hello-world-L1-0");
    expect(model.flatHeadings[1].id).toBe("sub-section-L2-1");
  });

  it("counts raw lines correctly", () => {
    const md = "# Title\n\nLine 1\nLine 2\nLine 3\n\nAnother paragraph.";
    const model = buildSectionModel(md, "test.md");
    expect(model.sections[0].rawLineCount).toBeGreaterThan(0);
  });
});

describe("diffHeadingIds", () => {
  it("maps identical headings", () => {
    const prev = [
      { id: "a-L1-0", text: "A", level: 1, positionalIndex: 0 },
      { id: "b-L2-1", text: "B", level: 2, positionalIndex: 1 },
    ];
    const next = [
      { id: "a-L1-0", text: "A", level: 1, positionalIndex: 0 },
      { id: "b-L2-1", text: "B", level: 2, positionalIndex: 1 },
    ];
    const mapping = diffHeadingIds(prev, next);
    expect(mapping.get("a-L1-0")).toBe("a-L1-0");
    expect(mapping.get("b-L2-1")).toBe("b-L2-1");
  });

  it("maps surviving headings when one is inserted", () => {
    const prev = [
      { id: "a-L1-0", text: "A", level: 1, positionalIndex: 0 },
      { id: "b-L1-1", text: "B", level: 1, positionalIndex: 1 },
    ];
    const next = [
      { id: "a-L1-0", text: "A", level: 1, positionalIndex: 0 },
      { id: "new-L1-1", text: "New", level: 1, positionalIndex: 1 },
      { id: "b-L1-2", text: "B", level: 1, positionalIndex: 2 },
    ];
    const mapping = diffHeadingIds(prev, next);
    expect(mapping.get("a-L1-0")).toBe("a-L1-0");
    expect(mapping.get("b-L1-1")).toBe("b-L1-2");
    expect(mapping.size).toBe(2);
  });

  it("maps surviving headings when one is removed", () => {
    const prev = [
      { id: "a-L1-0", text: "A", level: 1, positionalIndex: 0 },
      { id: "b-L1-1", text: "B", level: 1, positionalIndex: 1 },
      { id: "c-L1-2", text: "C", level: 1, positionalIndex: 2 },
    ];
    const next = [
      { id: "a-L1-0", text: "A", level: 1, positionalIndex: 0 },
      { id: "c-L1-1", text: "C", level: 1, positionalIndex: 1 },
    ];
    const mapping = diffHeadingIds(prev, next);
    expect(mapping.get("a-L1-0")).toBe("a-L1-0");
    expect(mapping.get("c-L1-2")).toBe("c-L1-1");
    expect(mapping.size).toBe(2);
  });

  it("returns empty map for completely different headings", () => {
    const prev = [{ id: "a-L1-0", text: "A", level: 1, positionalIndex: 0 }];
    const next = [{ id: "b-L1-0", text: "B", level: 1, positionalIndex: 0 }];
    const mapping = diffHeadingIds(prev, next);
    expect(mapping.size).toBe(0);
  });
});
