import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { embedLocalImages } from "../../src/main/embedLocalImages";

let tmpDir: string;
let pngPath: string;
let jpgPath: string;
let svgPath: string;
let spacePath: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "embed-img-test-"));

  // Minimal valid 1x1 red PNG
  const pngHex = "89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000c49444154789c63f8cfc0000003010100c9fe92ef0000000049454e44ae426082";
  pngPath = path.join(tmpDir, "test.png");
  fs.writeFileSync(pngPath, Buffer.from(pngHex, "hex"));

  // Use same bytes for jpg test (content doesn't matter, just testing MIME mapping)
  jpgPath = path.join(tmpDir, "test.jpg");
  fs.writeFileSync(jpgPath, Buffer.from(pngHex, "hex"));

  // Simple SVG
  svgPath = path.join(tmpDir, "icon.svg");
  fs.writeFileSync(svgPath, '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>');

  // File with space in name
  spacePath = path.join(tmpDir, "my file.png");
  fs.writeFileSync(spacePath, Buffer.from(pngHex, "hex"));
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("embedLocalImages", () => {
  it("converts file:// PNG to data:image/png;base64", () => {
    const html = `<img src="file://${pngPath}" alt="test">`;
    const result = embedLocalImages(html);
    expect(result).toMatch(/^<img src="data:image\/png;base64,[A-Za-z0-9+/=]+" alt="test">$/);
    expect(result).not.toContain("file://");
  });

  it("converts file:// JPG to data:image/jpeg;base64", () => {
    const html = `<img src="file://${jpgPath}">`;
    const result = embedLocalImages(html);
    expect(result).toContain("data:image/jpeg;base64,");
    expect(result).not.toContain("file://");
  });

  it("converts file:// SVG to data:image/svg+xml;base64", () => {
    const html = `<img src="file://${svgPath}">`;
    const result = embedLocalImages(html);
    expect(result).toContain("data:image/svg+xml;base64,");
    expect(result).not.toContain("file://");
  });

  it("leaves https:// URLs unchanged", () => {
    const html = '<img src="https://example.com/photo.png">';
    const result = embedLocalImages(html);
    expect(result).toBe(html);
  });

  it("leaves data: URLs unchanged", () => {
    const html = '<img src="data:image/png;base64,abc123">';
    const result = embedLocalImages(html);
    expect(result).toBe(html);
  });

  it("falls back to file:// URL when file does not exist", () => {
    const html = '<img src="file:///nonexistent/path/missing.png">';
    const result = embedLocalImages(html);
    expect(result).toBe(html);
  });

  it("falls back when isAllowed returns false", () => {
    const html = `<img src="file://${pngPath}">`;
    const result = embedLocalImages(html, () => false);
    expect(result).toContain("file://");
    expect(result).not.toContain("data:");
  });

  it("embeds all allowed images when isAllowed returns true", () => {
    const html = `<img src="file://${pngPath}">`;
    const result = embedLocalImages(html, () => true);
    expect(result).toContain("data:image/png;base64,");
  });

  it("handles multiple images in one HTML string", () => {
    const html = `<img src="file://${pngPath}"><img src="file://${jpgPath}">`;
    const result = embedLocalImages(html);
    expect(result).toContain("data:image/png;base64,");
    expect(result).toContain("data:image/jpeg;base64,");
    expect(result).not.toContain("file://");
  });

  it("handles percent-encoded filenames (spaces)", () => {
    const encoded = spacePath.replace(/ /g, "%20");
    const html = `<img src="file://${encoded}">`;
    const result = embedLocalImages(html);
    expect(result).toContain("data:image/png;base64,");
    expect(result).not.toContain("file://");
  });

  it("falls back for unknown file extensions", () => {
    const tiffPath = path.join(tmpDir, "photo.tiff");
    fs.writeFileSync(tiffPath, "fake");
    const html = `<img src="file://${tiffPath}">`;
    const result = embedLocalImages(html);
    expect(result).toContain("file://");
  });

  it("handles src preceded by other attributes", () => {
    const html = `<img alt="photo" width="100" src="file://${pngPath}">`;
    const result = embedLocalImages(html);
    expect(result).toContain("data:image/png;base64,");
    expect(result).toContain('alt="photo"');
    expect(result).toContain('width="100"');
  });
});
