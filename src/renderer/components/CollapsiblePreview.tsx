import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { marked, type Token, type TokensList } from "marked";
import DOMPurify from "dompurify";
import { resolveLocalImageSrc } from "../utils/resolveLocalImageSrc";
import { diffHeadingIds, type SectionModel, type Section, type SectionHeading } from "../utils/sectionModel";

interface CollapsiblePreviewProps {
  sectionModel: SectionModel;
  selectedFile: string;
  onClick?: (e: React.MouseEvent) => void;
}

function rewriteHtmlImageSrcs(html: string, fileDir: string): string {
  return html.replace(
    /(<img\s[^>]*?\ssrc="|<img\ssrc=")([^"]+)(")/gi,
    (_match, before, src, after) => {
      const resolved = resolveLocalImageSrc(src, fileDir);
      return before + resolved + after;
    }
  );
}

function sanitizeHtml(raw: string, fileDir: string): string {
  const sanitized = DOMPurify.sanitize(raw, {
    ADD_TAGS: ["input", "annotation", "semantics", "math", "mrow", "mi", "mo", "mn", "msup", "msub", "mfrac", "mtext", "mspace", "mover", "munder"],
    ADD_ATTR: ["checked", "disabled", "type", "data-mermaid", "data-wiki-target", "aria-hidden", "style", "xmlns", "encoding"],
    ADD_URI_SAFE_ATTR: ["src"],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|local-img|data|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  });
  return rewriteHtmlImageSrcs(sanitized, fileDir);
}

function renderTokens(tokens: Token[], links: Record<string, any>, fileDir: string): string {
  const tokensList = tokens.slice() as TokensList;
  tokensList.links = links;
  const raw = marked.parser(tokensList);
  return sanitizeHtml(raw, fileDir);
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`collapsible-chevron${expanded ? " expanded" : ""}`}
      aria-hidden="true"
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="4 2 8 6 4 10" />
    </svg>
  );
}

function CollapsibleSection({
  section,
  fileDir,
  links,
  depth,
  expandedSet,
  onToggle,
  focusedId,
  isFirstVisible,
  onFocus,
  onClick,
}: {
  section: Section;
  fileDir: string;
  links: Record<string, any>;
  depth: number;
  expandedSet: Set<string>;
  onToggle: (id: string) => void;
  focusedId: string | null;
  isFirstVisible: boolean;
  onFocus: (id: string) => void;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const isExpanded = expandedSet.has(section.heading.id);
  const isFocused = focusedId === section.heading.id;
  // First visible heading is tabbable when nothing is focused (roving tabindex)
  const isTabbable = isFocused || (isFirstVisible && focusedId === null);
  const level = section.heading.level;
  const headingRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isFocused && headingRef.current) {
      headingRef.current.focus({ preventScroll: true });
    }
  }, [isFocused]);

  // Lazy-render: only compute HTML when first expanded
  const [hasExpanded, setHasExpanded] = useState(false);
  useEffect(() => {
    if (isExpanded && !hasExpanded) {
      setHasExpanded(true);
    }
  }, [isExpanded, hasExpanded]);

  const contentHtml = useMemo(() => {
    if (!hasExpanded) return "";
    return renderTokens(section.tokens, links, fileDir);
  }, [hasExpanded, section.tokens, links, fileDir]);

  return (
    <div className="collapsible-section" style={{ contain: "layout style" }}>
      <button
        ref={headingRef}
        className={`collapsible-heading-row collapsible-heading-row-L${section.heading.level}`}
        onClick={() => onToggle(section.heading.id)}
        onFocus={() => onFocus(section.heading.id)}
        aria-expanded={isExpanded}
        data-heading-id={section.heading.id}
        tabIndex={isTabbable ? 0 : -1}
      >
        <ChevronIcon expanded={isExpanded} />
        <span
          className={`collapsible-heading-text collapsible-heading-text-L${level}`}
          id={section.heading.id}
          role="heading"
          aria-level={level}
        >
          {section.heading.text}
        </span>
        {section.rawLineCount > 0 && (
          <span className="collapsible-line-count">{section.rawLineCount} lines</span>
        )}
      </button>
      <div className={`collapsible-section-body${isExpanded ? " expanded" : ""}`}>
        <div className="collapsible-section-inner">
          {hasExpanded && contentHtml && (
            <div
              className="preview-content collapsible-section-content"
              dangerouslySetInnerHTML={{ __html: contentHtml }}
              onClick={onClick}
            />
          )}
          {section.children.map((child) => (
            <CollapsibleSection
              key={child.heading.id}
              section={child}
              fileDir={fileDir}
              links={links}
              depth={depth + 1}
              expandedSet={expandedSet}
              onToggle={onToggle}
              focusedId={focusedId}
              isFirstVisible={false}
              onFocus={onFocus}
              onClick={onClick}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function CollapsiblePreview({ sectionModel, selectedFile, onClick }: CollapsiblePreviewProps) {
  const [expandedSet, setExpandedSet] = useState<Set<string>>(new Set());
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [noTransition, setNoTransition] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const preSearchStateRef = useRef<Set<string> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Pending save tracks the file + state that should be flushed.
  // This avoids saving stale expandedSet during rapid file switches.
  const pendingSaveRef = useRef<{ file: string; state: Record<string, boolean> } | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevFileRef = useRef(selectedFile);
  const prevHeadingsRef = useRef<SectionHeading[]>(sectionModel.flatHeadings);
  const loadGenRef = useRef(0); // generation counter to prevent stale async loads
  const fileDir = selectedFile.replace(/[/\\][^/\\]+$/, "");
  const links = sectionModel.annotatedTokens.links || {};

  // Convert expanded set to record for IPC
  const expandedToRecord = useCallback((expanded: Set<string>): Record<string, boolean> => {
    const state: Record<string, boolean> = {};
    for (const id of expanded) state[id] = true;
    return state;
  }, []);

  // Schedule a debounced save — stores pending state in ref
  const scheduleSave = useCallback((file: string, expanded: Set<string>) => {
    pendingSaveRef.current = { file, state: expandedToRecord(expanded) };
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      if (pendingSaveRef.current) {
        window.api.saveFoldState(pendingSaveRef.current.file, pendingSaveRef.current.state);
        pendingSaveRef.current = null;
      }
    }, 2000);
  }, [expandedToRecord]);

  // Flush pending save immediately (for file switch and unmount)
  const flushPendingSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (pendingSaveRef.current) {
      window.api.saveFoldState(pendingSaveRef.current.file, pendingSaveRef.current.state);
      pendingSaveRef.current = null;
    }
  }, []);

  // Flush on unmount and beforeunload (covers app quit within debounce window)
  useEffect(() => {
    const handleBeforeUnload = () => flushPendingSave();
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      flushPendingSave();
    };
  }, [flushPendingSave]);

  // Load fold state on file change, flush previous file's state
  useEffect(() => {
    if (prevFileRef.current !== selectedFile) {
      flushPendingSave();
      setFocusedId(null);
      setSearchExpanded(false);
      preSearchStateRef.current = null;
      // Reset heading ref so diffHeadingIds doesn't cross-pollinate files
      prevHeadingsRef.current = sectionModel.flatHeadings;
      prevFileRef.current = selectedFile;
    }
    // Load saved fold state — use generation counter to discard stale results
    const gen = ++loadGenRef.current;
    window.api.loadFoldState(selectedFile).then((saved) => {
      if (gen !== loadGenRef.current) return; // stale — user switched files during load
      // Skip if user already interacted (pending save for this file)
      if (pendingSaveRef.current?.file === selectedFile) return;
      if (saved) {
        const restored = new Set<string>();
        for (const [id, expanded] of Object.entries(saved)) {
          if (expanded) restored.add(id);
        }
        setExpandedSet(restored);
      } else {
        setExpandedSet(new Set());
      }
    });
  }, [selectedFile, flushPendingSave, sectionModel.flatHeadings]);

  // Transfer fold state when document headings change (same-file editing only)
  useEffect(() => {
    const prev = prevHeadingsRef.current;
    const next = sectionModel.flatHeadings;
    // Only transfer if the section model belongs to the currently selected file
    // (sectionModel can lag behind selectedFile during async content load)
    if (sectionModel.sourceFile !== selectedFile) return;
    if (prev !== next && prev.length > 0 && next.length > 0) {
      const mapping = diffHeadingIds(prev, next);
      if (mapping.size > 0) {
        setExpandedSet((current) => {
          const transferred = new Set<string>();
          for (const id of current) {
            const newId = mapping.get(id);
            if (newId) transferred.add(newId);
          }
          scheduleSave(selectedFile, transferred);
          return transferred;
        });
      }
    }
    prevHeadingsRef.current = next;
  }, [sectionModel.flatHeadings, selectedFile, scheduleSave]);

  const toggle = useCallback((id: string) => {
    setExpandedSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      scheduleSave(selectedFile, next);
      return next;
    });
  }, [selectedFile, scheduleSave]);

  const expandAll = useCallback(() => {
    setNoTransition(true);
    const all = new Set(sectionModel.flatHeadings.map((h) => h.id));
    setExpandedSet(all);
    scheduleSave(selectedFile, all);
    requestAnimationFrame(() => setNoTransition(false));
  }, [sectionModel.flatHeadings, selectedFile, scheduleSave]);

  const collapseAll = useCallback(() => {
    setNoTransition(true);
    const empty = new Set<string>();
    setExpandedSet(empty);
    scheduleSave(selectedFile, empty);
    requestAnimationFrame(() => setNoTransition(false));
  }, [selectedFile, scheduleSave]);

  // Compute visible headings (skip children of collapsed parents)
  const visibleHeadings = useMemo(() => {
    const visible: typeof sectionModel.flatHeadings = [];
    function collectVisible(sections: Section[]) {
      for (const section of sections) {
        visible.push(section.heading);
        if (expandedSet.has(section.heading.id)) {
          collectVisible(section.children);
        }
      }
    }
    collectVisible(sectionModel.sections);
    return visible;
  }, [sectionModel.sections, expandedSet]);

  const visibleHeadingIds = useMemo(
    () => new Set(visibleHeadings.map((h) => h.id)),
    [visibleHeadings]
  );

  // Clear focusedId if it becomes invisible (parent collapsed)
  useEffect(() => {
    if (focusedId && !visibleHeadingIds.has(focusedId)) {
      setFocusedId(null);
    }
  }, [focusedId, visibleHeadingIds]);

  // Keyboard navigation
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      // Don't handle keys when in input/textarea
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      const headings = visibleHeadings;
      if (headings.length === 0) return;

      const currentIdx = focusedId
        ? headings.findIndex((h) => h.id === focusedId)
        : -1;

      switch (e.key) {
        case "j":
        case "ArrowDown": {
          e.preventDefault();
          const next = Math.min(currentIdx + 1, headings.length - 1);
          setFocusedId(headings[next].id);
          break;
        }
        case "k":
        case "ArrowUp": {
          e.preventDefault();
          const prev = Math.max(currentIdx - 1, 0);
          setFocusedId(headings[prev].id);
          break;
        }
        case "Enter":
        case " ": {
          if (focusedId) {
            e.preventDefault();
            toggle(focusedId);
          }
          break;
        }
        case "Escape": {
          if (focusedId && expandedSet.has(focusedId)) {
            e.preventDefault();
            toggle(focusedId);
          }
          break;
        }
        case "[": {
          e.preventDefault();
          collapseAll();
          break;
        }
        case "]": {
          e.preventDefault();
          expandAll();
          break;
        }
      }
    };

    container.addEventListener("keydown", handleKeyDown);
    return () => container.removeEventListener("keydown", handleKeyDown);
  }, [visibleHeadings, focusedId, expandedSet, toggle, expandAll, collapseAll]);

  // Cmd+F: expand all sections so native browser find can search content
  useEffect(() => {
    const handleFind = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key === "f" && !e.shiftKey) {
        if (!searchExpanded) {
          // Save current state and expand all
          preSearchStateRef.current = new Set(expandedSet);
          setSearchExpanded(true);
          setNoTransition(true);
          setExpandedSet(new Set(sectionModel.flatHeadings.map((h) => h.id)));
          requestAnimationFrame(() => setNoTransition(false));
        }
      }
      if (e.key === "Escape" && searchExpanded) {
        // Restore pre-search state
        setSearchExpanded(false);
        if (preSearchStateRef.current) {
          setNoTransition(true);
          setExpandedSet(preSearchStateRef.current);
          preSearchStateRef.current = null;
          requestAnimationFrame(() => setNoTransition(false));
        }
      }
    };
    window.addEventListener("keydown", handleFind);
    return () => window.removeEventListener("keydown", handleFind);
  }, [searchExpanded, expandedSet, sectionModel.flatHeadings]);

  // Render preamble (content before first heading)
  const preambleHtml = useMemo(() => {
    if (sectionModel.preamble.length === 0) return "";
    return renderTokens(sectionModel.preamble, links, fileDir);
  }, [sectionModel.preamble, links, fileDir]);

  return (
    <div
      className={`collapsible-preview${noTransition ? " no-transition" : ""}`}
      ref={containerRef}
      tabIndex={-1}
    >
      <div className="collapsible-controls">
        <button className="collapsible-control-btn" onClick={expandAll}>
          Expand All
        </button>
        <button className="collapsible-control-btn" onClick={collapseAll}>
          Collapse All
        </button>
        <span className="collapsible-count">
          {searchExpanded && (
            <span className="collapsible-search-indicator">Expanded for search (Esc to restore) </span>
          )}
          {sectionModel.flatHeadings.length} sections
        </span>
      </div>
      {preambleHtml && (
        <div
          className="preview-content collapsible-preamble"
          dangerouslySetInnerHTML={{ __html: preambleHtml }}
          onClick={onClick}
        />
      )}
      {sectionModel.sections.map((section, idx) => (
        <CollapsibleSection
          key={section.heading.id}
          section={section}
          fileDir={fileDir}
          links={links}
          depth={0}
          expandedSet={expandedSet}
          onToggle={toggle}
          focusedId={focusedId}
          isFirstVisible={idx === 0}
          onFocus={setFocusedId}
          onClick={onClick}
        />
      ))}
    </div>
  );
}
