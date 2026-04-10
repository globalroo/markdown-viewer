import { useEffect, useMemo, useRef, useCallback, useState } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { RevealIcon } from "./Icons";
import hljs from "highlight.js/lib/core";
import katex from "katex";
import "katex/dist/katex.min.css";
import { useAppStore } from "../store";
import { analyzeText, computeReadability, type StyleIssue } from "../utils/styleCheck";

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
  // Mermaid diagrams — render as a placeholder, initialised after DOM insert
  if (lang === "mermaid") {
    const escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return `<div class="mermaid-block" data-mermaid="${encodeURIComponent(text)}">${escaped}</div>`;
  }
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

// Heading slug counter to handle duplicate headings within a single render pass
let headingSlugCounts: Record<string, number> = {};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]*>/g, "")       // strip HTML tags
    .replace(/&[^;]+;/g, "")       // strip HTML entities
    .replace(/[^\w\s-]/g, "")      // remove non-word chars
    .replace(/\s+/g, "-")          // spaces to hyphens
    .replace(/-+/g, "-")           // collapse hyphens
    .replace(/^-|-$/g, "");        // trim leading/trailing hyphens
}

renderer.heading = function ({ text, depth }: { text: string; depth: number }) {
  const base = slugify(text);
  const count = headingSlugCounts[base] || 0;
  headingSlugCounts[base] = count + 1;
  const id = count === 0 ? base : `${base}-${count}`;
  return `<h${depth} id="${id}">${text}</h${depth}>\n`;
};

renderer.list = function (token: any) {
  const tag = token.ordered ? "ol" : "ul";
  const isTaskList = token.items?.some((item: any) => item.task);
  const cls = isTaskList ? ' class="task-list"' : "";
  const startAttr = token.ordered && token.start && token.start !== 1 ? ` start="${token.start}"` : "";
  const body = token.items?.map((item: any) => this.listitem(item)).join("") ?? "";
  return `<${tag}${cls}${startAttr}>${body}</${tag}>\n`;
};

// Current file directory, set before each render pass
let currentFileDir = "";

renderer.image = function (token: any) {
  const src: string = token.href || "";
  const alt: string = token.text || "";
  const title: string = token.title || "";

  let resolvedSrc = src;
  if (!src.startsWith("http://") && !src.startsWith("https://") && !src.startsWith("data:")) {
    // Rewrite relative/absolute local paths to custom protocol
    // The main process validates against allowedRoots when serving
    const cleanSrc = src.replace(/^\.\//, "");
    const isAbsolute = cleanSrc.startsWith("/") || /^[a-zA-Z]:[/\\]/.test(cleanSrc);
    const absolutePath = isAbsolute
      ? cleanSrc.replace(/\\/g, "/")
      : (currentFileDir + "/" + cleanSrc).replace(/\\/g, "/");
    const urlPath = absolutePath.startsWith("/") ? absolutePath : "/" + absolutePath;
    // Encode path segments to handle # % and other URL-significant characters
    const encoded = urlPath.split("/").map((s) => encodeURIComponent(s)).join("/");
    resolvedSrc = "local-img://" + encoded;
  }

  const titleAttr = title ? ` title="${title}"` : "";
  return `<img src="${resolvedSrc}" alt="${alt}"${titleAttr} />`;
};

// Wiki-link extension: [[filename]] or [[filename|display text]]
const wikiLinkExtension = {
  name: "wikiLink",
  level: "inline" as const,
  start(src: string) { return src.indexOf("[["); },
  tokenizer(src: string) {
    const match = /^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/.exec(src);
    if (match) {
      return {
        type: "wikiLink",
        raw: match[0],
        target: match[1].trim(),
        display: (match[2] || match[1]).trim(),
      };
    }
    return undefined;
  },
  renderer(token: { target: string; display: string }) {
    const escaped = token.display
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
    const targetAttr = token.target
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;");
    return `<a class="wiki-link" data-wiki-target="${targetAttr}" href="#">${escaped}</a>`;
  },
};

// KaTeX math extensions: $$...$$ for display, $...$ for inline
const mathBlockExtension = {
  name: "mathBlock",
  level: "block" as const,
  start(src: string) { return src.indexOf("$$"); },
  tokenizer(src: string) {
    const match = /^\$\$([\s\S]+?)\$\$/.exec(src);
    if (match) {
      return { type: "mathBlock", raw: match[0], text: match[1].trim() };
    }
    return undefined;
  },
  renderer(token: { text: string }) {
    try {
      return `<div class="math-block">${katex.renderToString(token.text, { displayMode: true, throwOnError: false })}</div>`;
    } catch {
      return `<div class="math-block math-error">${token.text}</div>`;
    }
  },
};

const mathInlineExtension = {
  name: "mathInline",
  level: "inline" as const,
  start(src: string) { return src.indexOf("$"); },
  tokenizer(src: string) {
    const match = /^\$([^\s$](?:[^$]*[^\s$])?)\$(?!\d)/.exec(src);
    if (match) {
      return { type: "mathInline", raw: match[0], text: match[1] };
    }
    return undefined;
  },
  renderer(token: { text: string }) {
    try {
      return katex.renderToString(token.text, { displayMode: false, throwOnError: false });
    } catch {
      return `<code class="math-error">${token.text}</code>`;
    }
  },
};

marked.use({ renderer, extensions: [wikiLinkExtension, mathBlockExtension, mathInlineExtension] });

function renderMarkdown(content: string, filePath: string): string {
  // Set current directory for image resolution during this parse
  currentFileDir = filePath.replace(/[/\\][^/\\]+$/, "");
  // Reset heading slug counter for each render pass
  headingSlugCounts = {};
  const raw = marked.parse(content) as string;
  return DOMPurify.sanitize(raw, {
    ADD_TAGS: ["input", "annotation", "semantics", "math", "mrow", "mi", "mo", "mn", "msup", "msub", "mfrac", "mtext", "mspace", "mover", "munder"],
    ADD_ATTR: ["checked", "disabled", "type", "data-mermaid", "data-wiki-target", "aria-hidden", "style", "xmlns", "encoding"],
    ADD_URI_SAFE_ATTR: ["src"],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|local-img|data|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  });
}

const isMac = navigator.platform.includes("Mac");
const mod = isMac ? "⌘" : "Ctrl+";
const revealLabel = isMac ? "Reveal in Finder" : "Show in Explorer";

/** Returns true if it's safe to proceed, false if the draft is still unsaved. */
async function saveOrDiscardDirty(filePath: string, content: string): Promise<boolean> {
  const shouldSave = window.confirm("You have unsaved changes. Save before continuing?");
  if (shouldSave) {
    try {
      await window.api.writeFile(filePath, content);
      useAppStore.getState().setEditDirty(false);
      return true;
    } catch {
      // Save failed — keep dirty state so the user doesn't lose their draft
      return false;
    }
  } else {
    // User chose to discard
    useAppStore.getState().setEditDirty(false);
    return true;
  }
}

export function MarkdownPreview() {
  const selectedFile = useAppStore((s) => s.selectedFile);
  const markdownContent = useAppStore((s) => s.markdownContent);
  const setMarkdownContent = useAppStore((s) => s.setMarkdownContent);
  const fontSize = useAppStore((s) => s.fontSize);
  const editMode = useAppStore((s) => s.editMode);
  const editContent = useAppStore((s) => s.editContent);
  const editDirty = useAppStore((s) => s.editDirty);
  const setEditMode = useAppStore((s) => s.setEditMode);
  const setEditContent = useAppStore((s) => s.setEditContent);
  const styleCheckEnabled = useAppStore((s) => s.styleCheckEnabled);
  const toggleStyleCheck = useAppStore((s) => s.toggleStyleCheck);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  // Save scroll position of the previous tab before switching
  const prevFileRef = useRef<string | null>(null);

  // Load file content on selection change, with dirty guard
  useEffect(() => {
    // Save scroll position for the tab we're leaving
    if (prevFileRef.current && prevFileRef.current !== selectedFile && scrollRef.current) {
      useAppStore.getState().setTabScrollPosition(prevFileRef.current, scrollRef.current.scrollTop);
    }
    prevFileRef.current = selectedFile;

    if (!selectedFile) return;

    let cancelled = false;

    (async () => {
      const state = useAppStore.getState();

      // If there's a dirty draft for a DIFFERENT file, prompt save/discard
      if (state.editDirty && state.editFilePath && state.editFilePath !== selectedFile) {
        const canProceed = await saveOrDiscardDirty(state.editFilePath, state.editContent);
        if (!canProceed) {
          // Save failed — revert selection to the file that owns the draft
          useAppStore.getState().selectFile(state.editFilePath);
          return;
        }
      }
      if (cancelled) return;

      // If we have a dirty draft for THIS file (e.g. after rename/move), keep it
      const freshState = useAppStore.getState();
      if (freshState.editDirty && freshState.editFilePath === selectedFile) {
        // Restore saved scroll position for this tab
        const tab = freshState.openTabs.find((t) => t.filePath === selectedFile);
        const savedPos = tab?.scrollPosition ?? 0;
        requestAnimationFrame(() => scrollRef.current?.scrollTo(0, savedPos));
        return;
      }

      const content = await window.api.readFile(selectedFile);
      if (!cancelled) {
        setMarkdownContent(content);
        // Always sync editContent to the new file's content
        const s = useAppStore.getState();
        if (s.editMode) {
          s.setEditContent(content);
          s.setEditDirty(false);
        }
        // Restore saved scroll position for this tab
        const tab = s.openTabs.find((t) => t.filePath === selectedFile);
        const savedPos = tab?.scrollPosition ?? 0;
        requestAnimationFrame(() => scrollRef.current?.scrollTo(0, savedPos));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedFile, setMarkdownContent]);

  // Window close dirty guard
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (useAppStore.getState().editDirty) {
        e.preventDefault();
        e.returnValue = false;
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // Track scroll progress for reading progress bar (preview mode only)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || editMode) {
      setScrollProgress(0);
      return;
    }
    const updateProgress = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const max = scrollHeight - clientHeight;
      setScrollProgress(max > 0 ? scrollTop / max : 0);
    };
    // Initialize from current scroll position (e.g. returning from edit mode)
    updateProgress();
    el.addEventListener("scroll", updateProgress, { passive: true });
    // Observe the content child for reflows from width/height/font changes
    const content = el.querySelector(".preview-content");
    const observer = new ResizeObserver(updateProgress);
    if (content) observer.observe(content);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", updateProgress);
      observer.disconnect();
    };
  }, [selectedFile, editMode]);

  // Render draft content when dirty, otherwise saved content
  const previewSource = editDirty ? editContent : markdownContent;
  const html = useMemo(() => {
    if (!previewSource || !selectedFile) return "";
    return renderMarkdown(previewSource, selectedFile);
  }, [previewSource, selectedFile]);

  // Style check: analyse text and compute readability when enabled
  const styleIssues = useMemo<StyleIssue[]>(() => {
    if (!styleCheckEnabled || !previewSource) return [];
    return analyzeText(previewSource);
  }, [styleCheckEnabled, previewSource]);

  const readability = useMemo(() => {
    if (!styleCheckEnabled || !previewSource) return null;
    return computeReadability(previewSource);
  }, [styleCheckEnabled, previewSource]);

  // Post-process rendered HTML to inject style-check highlights.
  // We walk text nodes in the preview DOM after render and wrap matched
  // ranges with <mark> elements.  This avoids mutating the markdown source.
  useEffect(() => {
    const container = scrollRef.current?.querySelector(".preview-content");
    // Cleanup function: unwrap any existing style marks
    const removeMarks = () => {
      if (!container) return;
      const marks = container.querySelectorAll("mark.style-issue");
      marks.forEach((mark) => {
        const parent = mark.parentNode;
        if (parent) {
          parent.replaceChild(document.createTextNode(mark.textContent || ""), mark);
          parent.normalize();
        }
      });
    };
    if (!styleCheckEnabled || editMode || styleIssues.length === 0) {
      removeMarks();
      return removeMarks;
    }
    if (!container) return;

    // Build a set of issue texts grouped by type for quick lookup.
    // We match on the rendered text content, not markdown positions.
    const issuesByType = new Map<string, Set<string>>();
    for (const issue of styleIssues) {
      const lc = issue.text.toLowerCase();
      if (!issuesByType.has(issue.type)) issuesByType.set(issue.type, new Set());
      issuesByType.get(issue.type)!.add(lc);
    }

    // Build a combined regex from all issue texts for efficient matching
    const escapedTexts = styleIssues.map((i) =>
      i.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    );
    // Deduplicate
    const uniqueTexts = [...new Set(escapedTexts)];
    if (uniqueTexts.length === 0) return;
    const combinedPattern = new RegExp(`\\b(${uniqueTexts.join("|")})\\b`, "gi");

    // Build a lookup from lowercased text to { type, suggestion }
    const issueLookup = new Map<string, { type: string; suggestion: string }>();
    for (const issue of styleIssues) {
      const key = issue.text.toLowerCase();
      if (!issueLookup.has(key)) {
        issueLookup.set(key, { type: issue.type, suggestion: issue.suggestion || "" });
      }
    }

    // Walk text nodes and wrap matches
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        // Skip nodes inside <code>, <pre>, <script>, <style>, and existing marks
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        const tag = parent.tagName;
        if (tag === "CODE" || tag === "PRE" || tag === "SCRIPT" || tag === "STYLE" || tag === "MARK") {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const textNodes: Text[] = [];
    let n: Node | null;
    while ((n = walker.nextNode())) textNodes.push(n as Text);

    for (const textNode of textNodes) {
      const text = textNode.textContent || "";
      combinedPattern.lastIndex = 0;
      const fragments: (string | HTMLElement)[] = [];
      let lastIndex = 0;
      let matchResult: RegExpExecArray | null;

      while ((matchResult = combinedPattern.exec(text)) !== null) {
        const matchedText = matchResult[0];
        const info = issueLookup.get(matchedText.toLowerCase());
        if (!info) continue;

        if (matchResult.index > lastIndex) {
          fragments.push(text.slice(lastIndex, matchResult.index));
        }

        const mark = document.createElement("mark");
        mark.className = `style-issue style-${info.type}`;
        mark.textContent = matchedText;
        if (info.suggestion) {
          mark.setAttribute("data-tooltip", info.suggestion);
          mark.title = info.suggestion;
        }
        fragments.push(mark);
        lastIndex = matchResult.index + matchedText.length;
      }

      if (fragments.length > 0) {
        if (lastIndex < text.length) {
          fragments.push(text.slice(lastIndex));
        }
        const parent = textNode.parentNode;
        if (parent) {
          const frag = document.createDocumentFragment();
          for (const f of fragments) {
            if (typeof f === "string") {
              frag.appendChild(document.createTextNode(f));
            } else {
              frag.appendChild(f);
            }
          }
          parent.replaceChild(frag, textNode);
        }
      }
    }
    return removeMarks;
  }, [html, styleCheckEnabled, editMode, styleIssues]);

  // Render Mermaid diagrams after DOM update
  useEffect(() => {
    if (editMode || !html) return;
    const container = scrollRef.current;
    if (!container) return;
    const blocks = container.querySelectorAll<HTMLElement>(".mermaid-block[data-mermaid]");
    if (blocks.length === 0) return;

    let cancelled = false;
    import("mermaid").then(({ default: mermaid }) => {
      if (cancelled) return;
      mermaid.initialize({ startOnLoad: false, theme: "default", securityLevel: "strict" });
      blocks.forEach(async (block, i) => {
        if (cancelled) return;
        const source = decodeURIComponent(block.dataset.mermaid || "");
        try {
          const { svg } = await mermaid.render(`mermaid-${i}-${Date.now()}`, source);
          if (!cancelled) block.innerHTML = svg;
        } catch {
          // Leave the raw text visible on parse error
        }
      });
    });
    return () => { cancelled = true; };
  }, [html, editMode]);

  // Word count and reading time
  const { wordCount, readingTime } = useMemo(() => {
    if (!previewSource) return { wordCount: 0, readingTime: "0 min" };
    const words = previewSource.trim().split(/\s+/).filter(Boolean).length;
    const minutes = Math.max(1, Math.round(words / 225));
    return { wordCount: words, readingTime: `${minutes} min read` };
  }, [previewSource]);

  const handleTabKey = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;

      if (e.shiftKey) {
        // Outdent: remove up to 2 leading spaces from current line
        const lineStart = ta.value.lastIndexOf("\n", start - 1) + 1;
        const lineText = ta.value.slice(lineStart, end);
        const spacesToRemove = lineText.startsWith("  ") ? 2 : lineText.startsWith(" ") ? 1 : 0;
        if (spacesToRemove > 0) {
          const newValue = ta.value.slice(0, lineStart) + ta.value.slice(lineStart + spacesToRemove);
          setEditContent(newValue);
          requestAnimationFrame(() => {
            ta.selectionStart = Math.max(start - spacesToRemove, lineStart);
            ta.selectionEnd = Math.max(end - spacesToRemove, lineStart);
          });
        }
      } else {
        // Insert 2 spaces
        const newValue = ta.value.slice(0, start) + "  " + ta.value.slice(end);
        setEditContent(newValue);
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = start + 2;
        });
      }
    }
  }, [setEditContent]);

  const handleCopy = useCallback(async () => {
    const content = editDirty ? editContent : markdownContent;
    await navigator.clipboard.writeText(content);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 1500);
  }, [editDirty, editContent, markdownContent]);

  // Handle wiki-link clicks
  const handlePreviewClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const wikiLink = target.closest(".wiki-link") as HTMLElement | null;
    if (!wikiLink) return;
    e.preventDefault();
    const wikiTarget = wikiLink.dataset.wikiTarget;
    if (!wikiTarget) return;

    // Find the matching file across all projects
    const state = useAppStore.getState();
    const normalised = wikiTarget.replace(/\\/g, "/").toLowerCase();

    function findInTree(nodes: TreeNode[]): string | null {
      for (const node of nodes) {
        if (node.type === "file") {
          const name = node.name.replace(/\.(md|markdown|mdown|mkd|mkdn)$/i, "").toLowerCase();
          const pathLower = node.path.replace(/\\/g, "/").toLowerCase();
          if (name === normalised || pathLower.endsWith("/" + normalised + ".md") || pathLower.endsWith("/" + normalised)) {
            return node.path;
          }
        }
        if (node.children) {
          const found = findInTree(node.children);
          if (found) return found;
        }
      }
      return null;
    }

    for (const project of state.projects) {
      const found = findInTree(project.tree);
      if (found) {
        state.selectFile(found);
        window.api.readFile(found).then((content) => {
          useAppStore.getState().setMarkdownContent(content);
        });
        return;
      }
    }
  }, []);

  const handleExportHTML = useCallback(async () => {
    if (!html) return;
    // Rewrite local-img:// protocol URLs back to file:// for portability
    const portableHtml = html.replace(/local-img:\/\/([^"')\s]+)/g, (_match, encoded) => {
      const decoded = decodeURIComponent(encoded);
      return "file://" + decoded;
    });
    // Gather computed styles for the preview
    const styleSheets = Array.from(document.styleSheets);
    let css = "";
    for (const sheet of styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          css += rule.cssText + "\n";
        }
      } catch {
        // Cross-origin stylesheets can't be read
      }
    }
    // Carry over theme/font state so CSS variables resolve in the exported file
    const root = document.documentElement;
    const theme = root.getAttribute("data-theme") || "light";
    const font = root.getAttribute("data-font") || "system";
    // Include runtime CSS custom properties (content-width, line-height, etc.)
    const rootInlineStyle = root.style.cssText;
    const warmFilter = root.classList.contains("warm-filter");
    await window.api.exportHTML(portableHtml, css, theme, font, rootInlineStyle, warmFilter);
  }, [html]);

  const handleSave = useCallback(async () => {
    if (!selectedFile || !editDirty) return;
    await window.api.writeFile(selectedFile, editContent);
    useAppStore.getState().setEditDirty(false);
    useAppStore.getState().setMarkdownContent(editContent);
  }, [selectedFile, editDirty, editContent]);

  if (!selectedFile) {
    return (
      <div className="preview-empty">
        <div className="preview-empty-content">
          <h2>viewmd</h2>
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
          {editDirty && <span className="dirty-indicator" title="Unsaved changes"> ●</span>}
        </span>
        <span className="preview-stats" title={`${wordCount.toLocaleString()} words`}>
          {wordCount.toLocaleString()} words &middot; {readingTime}
          {styleCheckEnabled && readability && (
            <>
              {" "}&middot; Grade {readability.gradeLevel} &middot; {readability.label}
              {styleIssues.length > 0 && (
                <> &middot; {styleIssues.length} issue{styleIssues.length !== 1 ? "s" : ""}</>
              )}
            </>
          )}
        </span>
        <div className="preview-header-actions">
          <div className="preview-mode-toggle">
            <button
              className={`preview-mode-btn ${!editMode ? "active" : ""}`}
              onClick={() => setEditMode(false)}
              title={`Preview (${mod}E)`}
            >
              Preview
            </button>
            <button
              className={`preview-mode-btn ${editMode ? "active" : ""}`}
              onClick={() => setEditMode(true)}
              title={`Edit (${mod}E)`}
            >
              Edit
            </button>
          </div>
          {editMode && editDirty && (
            <button
              className="preview-save-btn"
              onClick={handleSave}
              title={`Save (${mod}S)`}
            >
              Save
            </button>
          )}
          <button
            className={`preview-copy-btn style-check-toggle${styleCheckEnabled ? " active" : ""}`}
            onClick={toggleStyleCheck}
            title={`Style check ${styleCheckEnabled ? "on" : "off"}`}
          >
            Style
          </button>
          <button
            className="preview-copy-btn"
            onClick={handleCopy}
            title="Copy raw markdown"
          >
            {copyFeedback ? "Copied!" : "Copy"}
          </button>
          <button
            className="preview-copy-btn"
            onClick={handleExportHTML}
            title="Export as HTML"
          >
            Export
          </button>
          <button
            className="preview-reveal-btn"
            onClick={() => window.api.showInFolder(selectedFile)}
            aria-label={revealLabel}
            title={revealLabel}
          >
            <RevealIcon />
          </button>
        </div>
      </div>
      {!editMode && (
        <div className="progress-bar-track">
          <div
            className="progress-bar-fill"
            style={{ transform: `scaleX(${scrollProgress})` }}
          />
        </div>
      )}
      <div
        className="preview-scroll"
        ref={scrollRef}
        style={{ fontSize: `${fontSize}px` }}
      >
        {editMode && (
          <textarea
            ref={textareaRef}
            className="edit-textarea"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onKeyDown={handleTabKey}
            spellCheck={false}
          />
        )}
        <div
          className="preview-content"
          style={editMode ? { display: "none" } : undefined}
          dangerouslySetInnerHTML={{ __html: html }}
          onClick={handlePreviewClick}
        />
      </div>
    </div>
  );
}
