import * as fs from "fs";
import * as path from "path";

const IMAGE_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon",
};

/**
 * Replace file:// image URLs in HTML with base64 data URLs.
 * Runs in the main process (has fs access). Falls back gracefully
 * to the original URL on any error.
 */
export function embedLocalImages(
  html: string,
  isAllowed?: (filePath: string) => boolean
): string {
  return html.replace(
    /(<img\s[^>]*?\ssrc="|<img\ssrc=")(file:\/\/[^"]+)(")/gi,
    (match, before: string, fileUrl: string, after: string) => {
      let filePath: string;
      try {
        const url = new URL(fileUrl);
        filePath = decodeURIComponent(url.pathname);
        // On Windows, pathname starts with /C:/... — strip leading slash
        if (process.platform === "win32" && filePath.startsWith("/")) {
          filePath = filePath.slice(1);
        }
      } catch {
        return match;
      }

      if (isAllowed && !isAllowed(filePath)) {
        return match;
      }

      const ext = path.extname(filePath).toLowerCase();
      const mime = IMAGE_MIME[ext];
      if (!mime) return match;

      try {
        const data = fs.readFileSync(filePath);
        return `${before}data:${mime};base64,${data.toString("base64")}${after}`;
      } catch {
        return match;
      }
    }
  );
}
