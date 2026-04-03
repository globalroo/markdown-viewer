import { useEffect, useMemo, useRef } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import hljs from "highlight.js/lib/core";
import { useAppStore } from "../store";

// Register only the most common languages to keep bundle small
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import bash from "highlight.js/lib/languages/bash";
import json from "highlight.js/lib/languages/json";
import css from "highlight.js/lib/languages/css";
import xml from "highlight.js/lib/languages/xml";
import markdown from "highlight.js/lib/languages/markdown";
import yaml from "highlight.js/lib/languages/yaml";
import sql from "highlight.js/lib/languages/sql";
import java from "highlight.js/lib/languages/java";
import csharp from "highlight.js/lib/languages/csharp";
import go from "highlight.js/lib/languages/go";
import rust from "highlight.js/lib/languages/rust";
import diff from "highlight.js/lib/languages/diff";
import plaintext from "highlight.js/lib/languages/plaintext";

hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("js", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("sh", bash);
hljs.registerLanguage("shell", bash);
hljs.registerLanguage("json", json);
hljs.registerLanguage("css", css);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("md", markdown);
hljs.registerLanguage("yaml", yaml);
hljs.registerLanguage("yml", yaml);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("java", java);
hljs.registerLanguage("csharp", csharp);
hljs.registerLanguage("cs", csharp);
hljs.registerLanguage("go", go);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("rs", rust);
hljs.registerLanguage("diff", diff);
hljs.registerLanguage("plaintext", plaintext);
hljs.registerLanguage("text", plaintext);

// Configure marked once
marked.setOptions({
  gfm: true,
  breaks: false,
});

// Custom renderer for syntax highlighting
const renderer = new marked.Renderer();
renderer.code = function ({ text, lang }: { text: string; lang?: string }) {
  if (lang && hljs.getLanguage(lang)) {
    const highlighted = hljs.highlight(text, { language: lang }).value;
    return `<pre><code class="hljs language-${lang}">${highlighted}</code></pre>`;
  }
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<pre><code>${escaped}</code></pre>`;
};

renderer.list = function (token: any) {
  const tag = token.ordered ? "ol" : "ul";
  const isTaskList = token.items?.some((item: any) => item.task);
  const cls = isTaskList ? ' class="task-list"' : "";
  const startAttr = token.ordered && token.start && token.start !== 1 ? ` start="${token.start}"` : "";
  const body = token.items?.map((item: any) => this.listitem(item)).join("") ?? "";
  return `<${tag}${cls}${startAttr}>${body}</${tag}>\n`;
};

marked.use({ renderer });

function resolveImagePaths(html: string, fileDir: string): string {
  // Rewrite relative image src to absolute file:// URLs
  return html.replace(
    /(<img\s[^>]*src=")([^"]+)(")/gi,
    (_match, prefix, src, suffix) => {
      if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("file://") || src.startsWith("data:")) {
        return prefix + src + suffix;
      }
      // Resolve relative path against the markdown file's directory
      const absolute = fileDir + "/" + src;
      return prefix + "file://" + absolute + suffix;
    }
  );
}

function renderMarkdown(content: string, filePath: string): string {
  const raw = marked.parse(content) as string;
  const fileDir = filePath.replace(/[/\\][^/\\]+$/, "");
  const withImages = resolveImagePaths(raw, fileDir);
  return DOMPurify.sanitize(withImages, {
    ADD_TAGS: ["input"],
    ADD_ATTR: ["checked", "disabled", "type"],
  });
}

const isMac = navigator.platform.includes("Mac");
const mod = isMac ? "⌘" : "Ctrl+";
const revealLabel = isMac ? "Reveal in Finder" : "Show in Explorer";

export function MarkdownPreview() {
  const selectedFile = useAppStore((s) => s.selectedFile);
  const markdownContent = useAppStore((s) => s.markdownContent);
  const setMarkdownContent = useAppStore((s) => s.setMarkdownContent);
  const fontSize = useAppStore((s) => s.fontSize);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedFile) return;

    let cancelled = false;
    window.api.readFile(selectedFile).then((content) => {
      if (!cancelled) {
        setMarkdownContent(content);
        // Scroll to top when switching files
        scrollRef.current?.scrollTo(0, 0);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [selectedFile, setMarkdownContent]);

  const html = useMemo(() => {
    if (!markdownContent || !selectedFile) return "";
    return renderMarkdown(markdownContent, selectedFile);
  }, [markdownContent, selectedFile]);

  if (!selectedFile) {
    return (
      <div className="preview-empty">
        <div className="preview-empty-content">
          <h2>Markdown Viewer</h2>
          <p>Select a file from the sidebar to start reading</p>
          <div className="shortcut-list">
            <div><kbd>{mod}O</kbd> Open folder</div>
            <div><kbd>{mod}B</kbd> Toggle sidebar</div>
            <div><kbd>{mod}+</kbd> Increase font size</div>
            <div><kbd>{mod}-</kbd> Decrease font size</div>
            <div><kbd>{mod}D</kbd> Toggle theme</div>
            <div><kbd>{mod}P</kbd> Print document</div>
          </div>
        </div>
      </div>
    );
  }

  const fileName = selectedFile.split(/[/\\]/).pop() || "";

  return (
    <div className="preview-container">
      <div className="preview-header">
        <span className="preview-filename" title={selectedFile}>
          {fileName}
        </span>
        <button
          className="preview-reveal-btn"
          onClick={() => window.api.showInFolder(selectedFile)}
          aria-label={revealLabel}
          title={revealLabel}
        >
          ↗
        </button>
      </div>
      <div
        className="preview-scroll"
        ref={scrollRef}
        style={{ fontSize: `${fontSize}px` }}
      >
        <div
          className="preview-content"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}
