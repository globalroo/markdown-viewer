import { describe, it, expect } from "vitest";

// Re-implement validation logic from src/main/main.ts for unit testing
// (the main-process function can't be imported in a jsdom environment)
const MARKDOWN_EXTENSIONS = /\.(md|markdown|mdown|mkd|mkdn)$/i;
const RESERVED_WINDOWS_NAMES =
  /^(CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])(\.|$)/i;

function validateFileName(name: string): void {
  if (!name || !name.trim()) throw new Error("Filename cannot be empty");
  if (/[/\\]/.test(name))
    throw new Error("Filename cannot contain path separators");
  if (name.includes("..")) throw new Error("Invalid filename");
  if (name.startsWith("."))
    throw new Error("Filename cannot start with a dot");
  if (/[.\s]$/.test(name))
    throw new Error("Filename cannot end with a dot or space");
  if (RESERVED_WINDOWS_NAMES.test(name))
    throw new Error("Reserved filename");
  if (!MARKDOWN_EXTENSIONS.test(name))
    throw new Error(
      "File must have a markdown extension (.md, .markdown, etc.)"
    );
}

describe("validateFileName", () => {
  describe("valid filenames", () => {
    it.each([
      ["readme.md"],
      ["CHANGELOG.markdown"],
      ["notes.mdown"],
      ["doc.mkd"],
      ["file.mkdn"],
    ])("accepts %s", (name) => {
      expect(() => validateFileName(name)).not.toThrow();
    });

    it("accepts uppercase extension FILE.MD", () => {
      expect(() => validateFileName("FILE.MD")).not.toThrow();
    });

    it("accepts mixed case test.Markdown", () => {
      expect(() => validateFileName("test.Markdown")).not.toThrow();
    });

    it("accepts names with hyphens and underscores", () => {
      expect(() => validateFileName("my-file_v2.md")).not.toThrow();
    });

    it("accepts names with spaces in the middle", () => {
      expect(() => validateFileName("my file.md")).not.toThrow();
    });

    it("accepts single-char names", () => {
      expect(() => validateFileName("a.md")).not.toThrow();
    });

    it("accepts names with numbers", () => {
      expect(() => validateFileName("chapter01.md")).not.toThrow();
    });
  });

  describe("empty and whitespace names", () => {
    it("rejects empty string", () => {
      expect(() => validateFileName("")).toThrow("Filename cannot be empty");
    });

    it("rejects whitespace-only string", () => {
      expect(() => validateFileName("   ")).toThrow(
        "Filename cannot be empty"
      );
    });

    it("rejects tab-only string", () => {
      expect(() => validateFileName("\t")).toThrow(
        "Filename cannot be empty"
      );
    });
  });

  describe("path separator injection", () => {
    it("rejects forward slash traversal", () => {
      expect(() => validateFileName("../../etc/passwd.md")).toThrow(
        "Filename cannot contain path separators"
      );
    });

    it("rejects forward slash in name", () => {
      expect(() => validateFileName("folder/file.md")).toThrow(
        "Filename cannot contain path separators"
      );
    });

    it("rejects backslash in name", () => {
      expect(() => validateFileName("folder\\file.md")).toThrow(
        "Filename cannot contain path separators"
      );
    });
  });

  describe("double dot", () => {
    it("rejects names containing double dot", () => {
      expect(() => validateFileName("file..md")).toThrow("Invalid filename");
    });

    it("rejects double dot at start", () => {
      expect(() => validateFileName("..md")).toThrow();
    });

    it("rejects double dot in middle", () => {
      expect(() => validateFileName("a..b.md")).toThrow("Invalid filename");
    });
  });

  describe("leading dot", () => {
    it("rejects hidden files starting with dot", () => {
      expect(() => validateFileName(".hidden.md")).toThrow(
        "Filename cannot start with a dot"
      );
    });

    it("rejects single dot prefix", () => {
      expect(() => validateFileName(".md")).toThrow(
        "Filename cannot start with a dot"
      );
    });
  });

  describe("trailing dot or space", () => {
    it("rejects trailing dot", () => {
      expect(() => validateFileName("file.md.")).toThrow(
        "Filename cannot end with a dot or space"
      );
    });

    it("rejects trailing space", () => {
      expect(() => validateFileName("file.md ")).toThrow(
        "Filename cannot end with a dot or space"
      );
    });

    it("rejects trailing tab", () => {
      // tab is matched by \s
      expect(() => validateFileName("file.md\t")).toThrow(
        "Filename cannot end with a dot or space"
      );
    });
  });

  describe("reserved Windows names", () => {
    it.each(["CON.md", "PRN.md", "AUX.md", "NUL.md", "COM1.md", "LPT0.md"])(
      "rejects reserved name %s",
      (name) => {
        expect(() => validateFileName(name)).toThrow("Reserved filename");
      }
    );

    it("rejects reserved names case insensitively", () => {
      expect(() => validateFileName("con.md")).toThrow("Reserved filename");
    });

    it("rejects COM0 through COM9", () => {
      for (let i = 0; i <= 9; i++) {
        expect(() => validateFileName(`COM${i}.md`)).toThrow(
          "Reserved filename"
        );
      }
    });

    it("rejects LPT0 through LPT9", () => {
      for (let i = 0; i <= 9; i++) {
        expect(() => validateFileName(`LPT${i}.md`)).toThrow(
          "Reserved filename"
        );
      }
    });

    it("rejects bare reserved name without extension", () => {
      // "CON" with no extension — RESERVED_WINDOWS_NAMES matches (CON)($)
      // but it will also fail the markdown-extension check
      expect(() => validateFileName("CON")).toThrow("Reserved filename");
    });
  });

  describe("non-markdown extensions", () => {
    it.each(["file.txt", "file.js", "file.doc", "file.html", "file.json"])(
      "rejects %s",
      (name) => {
        expect(() => validateFileName(name)).toThrow(
          "File must have a markdown extension"
        );
      }
    );
  });

  describe("no extension", () => {
    it("rejects a name with no extension", () => {
      expect(() => validateFileName("readme")).toThrow(
        "File must have a markdown extension"
      );
    });

    it("rejects a name that looks like markdown but has no dot", () => {
      expect(() => validateFileName("readmemd")).toThrow(
        "File must have a markdown extension"
      );
    });
  });

  describe("MARKDOWN_EXTENSIONS regex", () => {
    it("matches .md", () => {
      expect(MARKDOWN_EXTENSIONS.test("foo.md")).toBe(true);
    });

    it("matches .markdown", () => {
      expect(MARKDOWN_EXTENSIONS.test("foo.markdown")).toBe(true);
    });

    it("matches .mdown", () => {
      expect(MARKDOWN_EXTENSIONS.test("foo.mdown")).toBe(true);
    });

    it("matches .mkd", () => {
      expect(MARKDOWN_EXTENSIONS.test("foo.mkd")).toBe(true);
    });

    it("matches .mkdn", () => {
      expect(MARKDOWN_EXTENSIONS.test("foo.mkdn")).toBe(true);
    });

    it("is case insensitive", () => {
      expect(MARKDOWN_EXTENSIONS.test("foo.MD")).toBe(true);
      expect(MARKDOWN_EXTENSIONS.test("foo.MARKDOWN")).toBe(true);
    });

    it("does not match partial extensions", () => {
      expect(MARKDOWN_EXTENSIONS.test("foo.mdx")).toBe(false);
    });

    it("does not match .mdo or .mkdx", () => {
      expect(MARKDOWN_EXTENSIONS.test("foo.mdo")).toBe(false);
      expect(MARKDOWN_EXTENSIONS.test("foo.mkdx")).toBe(false);
    });
  });
});
