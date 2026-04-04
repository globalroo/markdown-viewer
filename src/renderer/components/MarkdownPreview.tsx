import { useEffect, useMemo, useRef, useCallback, useState } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { RevealIcon } from "./Icons";
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

marked.use({ renderer });

function renderMarkdown(content: string, filePath: string): string {
  // Set current directory for image resolution during this parse
  currentFileDir = filePath.replace(/[/\\][^/\\]+$/, "");
  const raw = marked.parse(content) as string;
  return DOMPurify.sanitize(raw, {
    ADD_TAGS: ["input"],
    ADD_ATTR: ["checked", "disabled", "type"],
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  // Load file content on selection change, with dirty guard
  useEffect(() => {
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
        scrollRef.current?.scrollTo(0, 0);
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
        scrollRef.current?.scrollTo(0, 0);
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
            className="preview-copy-btn"
            onClick={handleCopy}
            title="Copy raw markdown"
          >
            {copyFeedback ? "Copied!" : "Copy"}
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
        {editMode ? (
          <textarea
            ref={textareaRef}
            className="edit-textarea"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onKeyDown={handleTabKey}
            spellCheck={false}
          />
        ) : (
          <div
            className="preview-content"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </div>
    </div>
  );
}
