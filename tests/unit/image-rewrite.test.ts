import { describe, it, expect } from "vitest";
import { resolveLocalImageSrc } from "../../src/renderer/utils/resolveLocalImageSrc";

// rewriteHtmlImageSrcs is a thin wrapper around resolveLocalImageSrc that
// matches <img> src attributes via regex. We test the regex matching here
// and delegate path resolution tests to resolveLocalImageSrc.
function rewriteHtmlImageSrcs(html: string, fileDir: string): string {
  return html.replace(
    /(<img\s[^>]*?\ssrc="|<img\ssrc=")([^"]+)(")/gi,
    (_match, before, src, after) => {
      const resolved = resolveLocalImageSrc(src, fileDir);
      return before + resolved + after;
    }
  );
}

describe("resolveLocalImageSrc", () => {
  const fileDir = "/Users/andy/github/project/docs";

  describe("relative paths", () => {
    it("rewrites a simple relative src", () => {
      const result = resolveLocalImageSrc("images/photo.png", fileDir);
      expect(result).toMatch(/^local-img:\/\//);
      expect(result).toContain("/Users/andy/github/project/docs/images/photo.png");
    });

    it("rewrites ./ relative paths", () => {
      const result = resolveLocalImageSrc("./icon.png", fileDir);
      expect(result).toMatch(/^local-img:\/\//);
      expect(result).toContain("/Users/andy/github/project/docs/icon.png");
    });

    it("rewrites parent directory paths", () => {
      const result = resolveLocalImageSrc("../assets/logo.svg", fileDir);
      expect(result).toMatch(/^local-img:\/\//);
      expect(result).toContain("/Users/andy/github/project/docs/../assets/logo.svg");
    });
  });

  describe("absolute paths", () => {
    it("rewrites absolute Unix paths", () => {
      const result = resolveLocalImageSrc("/tmp/screenshot.png", fileDir);
      expect(result).toBe("local-img:///tmp/screenshot.png");
    });
  });

  describe("external and special URLs are returned unchanged", () => {
    it("leaves https:// URLs alone", () => {
      expect(resolveLocalImageSrc("https://example.com/logo.png", fileDir))
        .toBe("https://example.com/logo.png");
    });

    it("leaves http:// URLs alone", () => {
      expect(resolveLocalImageSrc("http://example.com/logo.png", fileDir))
        .toBe("http://example.com/logo.png");
    });

    it("leaves local-img:// URLs alone", () => {
      expect(resolveLocalImageSrc("local-img:///Users/andy/photo.png", fileDir))
        .toBe("local-img:///Users/andy/photo.png");
    });

    it("leaves data: URIs alone", () => {
      expect(resolveLocalImageSrc("data:image/png;base64,abc123", fileDir))
        .toBe("data:image/png;base64,abc123");
    });

    it("leaves protocol-relative URLs alone", () => {
      expect(resolveLocalImageSrc("//cdn.example.com/image.png", fileDir))
        .toBe("//cdn.example.com/image.png");
    });
  });

  describe("pre-encoded URLs (double-encoding prevention)", () => {
    it("does not double-encode %20 in filenames", () => {
      const result = resolveLocalImageSrc("my%20images/photo%20%231.png", fileDir);
      expect(result).toContain("local-img://");
      expect(result).toContain("my%20images");
      expect(result).toContain("photo%20%231.png");
      expect(result).not.toContain("%2520");
    });

    it("handles unencoded spaces normally", () => {
      const result = resolveLocalImageSrc("my images/photo #1.png", fileDir);
      expect(result).toContain("my%20images");
      expect(result).toContain("photo%20%231.png");
    });
  });

  describe("URL encoding", () => {
    it("encodes special characters in path segments", () => {
      const result = resolveLocalImageSrc("my images/photo #1.png", fileDir);
      expect(result).toContain("local-img://");
      expect(result).toContain("my%20images");
      expect(result).toContain("photo%20%231.png");
    });
  });
});

describe("rewriteHtmlImageSrcs", () => {
  const fileDir = "/Users/andy/github/project/docs";

  describe("img tag matching", () => {
    it("rewrites src on a simple img tag", () => {
      const html = '<img src="images/photo.png" alt="photo">';
      const result = rewriteHtmlImageSrcs(html, fileDir);
      expect(result).toContain("local-img://");
      expect(result).toContain('alt="photo"');
    });

    it("keeps alt, width, height attributes intact", () => {
      const html = '<img src="icon.png" alt="icon" width="128" height="128">';
      const result = rewriteHtmlImageSrcs(html, fileDir);
      expect(result).toContain('alt="icon"');
      expect(result).toContain('width="128"');
      expect(result).toContain('height="128"');
      expect(result).toContain("local-img://");
    });

    it("rewrites all relative images in a string", () => {
      const html = '<img src="a.png"><img src="b.jpg"><img src="https://ext.com/c.svg">';
      const result = rewriteHtmlImageSrcs(html, fileDir);
      expect(result).toContain("local-img://");
      expect(result).toContain("/docs/a.png");
      expect(result).toContain("/docs/b.jpg");
      expect(result).toContain("https://ext.com/c.svg");
    });
  });

  describe("does not match unrelated elements or attributes", () => {
    it("does not touch src attributes on non-img elements", () => {
      const html = '<script src="app.js"></script>';
      const result = rewriteHtmlImageSrcs(html, fileDir);
      expect(result).toBe(html);
    });

    it("does not match data-src attributes", () => {
      const html = '<img data-src="lazy.png" src="https://example.com/placeholder.png">';
      const result = rewriteHtmlImageSrcs(html, fileDir);
      expect(result).toBe(html);
    });
  });
});
