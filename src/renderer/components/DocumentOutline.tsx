import { useEffect, useState, useRef, useCallback } from "react";
import { useAppStore } from "../store";

interface HeadingEntry {
  id: string;
  text: string;
  level: number;
}

function OutlineIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      {/* Table of contents: bullets + indented lines */}
      <circle cx="3" cy="3" r="1" fill="currentColor" stroke="none" />
      <line x1="6" y1="3" x2="14" y2="3" />
      <circle cx="5" cy="7" r="1" fill="currentColor" stroke="none" />
      <line x1="8" y1="7" x2="14" y2="7" />
      <circle cx="5" cy="11" r="1" fill="currentColor" stroke="none" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  );
}

export { OutlineIcon };

function CollapseIcon() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="5 3 9 7 5 11" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 3 5 7 9 11" />
    </svg>
  );
}

function OutlineResizeHandle() {
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const { setOutlineWidth, resetOutlineWidth, outlineWidth } = useAppStore();

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    startXRef.current = e.clientX;
    startWidthRef.current = useAppStore.getState().outlineWidth;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!(e.target as HTMLElement).hasPointerCapture(e.pointerId)) return;
    // Dragging left increases outline width (right-side panel)
    const delta = startXRef.current - e.clientX;
    const next = Math.min(400, Math.max(160, startWidthRef.current + delta));
    document.documentElement.style.setProperty("--outline-width", `${next}px`);
  }, []);

  const cleanupDrag = useCallback(() => {
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    // Restore CSS variable to store value in case drag was aborted
    const storeWidth = useAppStore.getState().outlineWidth;
    document.documentElement.style.setProperty("--outline-width", `${storeWidth}px`);
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!(e.target as HTMLElement).hasPointerCapture(e.pointerId)) return;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    cleanupDrag();
    const delta = startXRef.current - e.clientX;
    const next = Math.min(400, Math.max(160, startWidthRef.current + delta));
    setOutlineWidth(next);
  }, [setOutlineWidth, cleanupDrag]);

  // Safety: clean up drag state if component unmounts mid-drag
  useEffect(() => cleanupDrag, [cleanupDrag]);

  const handleDoubleClick = useCallback(() => {
    resetOutlineWidth();
  }, [resetOutlineWidth]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const store = useAppStore.getState();
    let next: number | null = null;
    // ArrowLeft = wider (panel is on right side)
    if (e.key === "ArrowLeft") next = store.outlineWidth + 10;
    else if (e.key === "ArrowRight") next = store.outlineWidth - 10;
    else if (e.key === "Home") next = 160;
    else if (e.key === "End") next = 400;
    if (next !== null) {
      e.preventDefault();
      setOutlineWidth(next);
    }
  }, [setOutlineWidth]);

  return (
    <div
      className="outline-resize-handle"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onLostPointerCapture={cleanupDrag}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      role="separator"
      aria-orientation="vertical"
      aria-valuenow={outlineWidth}
      aria-valuemin={160}
      aria-valuemax={400}
      aria-label="Resize document outline"
      tabIndex={0}
    />
  );
}

export function DocumentOutline() {
  const [headings, setHeadings] = useState<HeadingEntry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const collapseRef = useRef<HTMLButtonElement>(null);
  const railRef = useRef<HTMLButtonElement>(null);
  const prevVisibleRef = useRef<boolean | null>(null);
  const isFirstRender = useRef(true);
  const pendingFocusRef = useRef<"rail" | "collapse" | null>(null);
  const outlineVisible = useAppStore((s) => s.outlineVisible);
  const toggleOutline = useAppStore((s) => s.toggleOutline);

  // Extract headings from rendered content whenever it changes
  const selectedFile = useAppStore((s) => s.selectedFile);
  const markdownContent = useAppStore((s) => s.markdownContent);
  const editDirty = useAppStore((s) => s.editDirty);
  const editContent = useAppStore((s) => s.editContent);
  const editMode = useAppStore((s) => s.editMode);

  const extractHeadings = useCallback(() => {
    const container = document.querySelector(".preview-content");
    if (!container) {
      setHeadings([]);
      return;
    }
    const els = container.querySelectorAll("h1, h2, h3, h4, h5, h6");
    const entries: HeadingEntry[] = [];
    els.forEach((el) => {
      const id = el.id;
      if (!id) return;
      const level = parseInt(el.tagName[1], 10);
      const text = el.textContent || "";
      entries.push({ id, text, level });
    });
    setHeadings(entries);
  }, []);

  // Re-extract headings when content changes
  useEffect(() => {
    // Small delay to let the DOM update after React render
    const timer = setTimeout(extractHeadings, 50);
    return () => clearTimeout(timer);
  }, [selectedFile, markdownContent, editDirty, editContent, extractHeadings]);

  // IntersectionObserver for active heading tracking
  useEffect(() => {
    if (!outlineVisible || headings.length === 0 || editMode) {
      setActiveId(null);
      return;
    }

    const scrollContainer = document.querySelector(".preview-scroll");
    if (!scrollContainer) return;

    // Track which headings are visible; pick the topmost
    const visibleIds = new Set<string>();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = (entry.target as HTMLElement).id;
          if (entry.isIntersecting) {
            visibleIds.add(id);
          } else {
            visibleIds.delete(id);
          }
        });

        // Pick the first visible heading by document order
        if (visibleIds.size > 0) {
          for (const h of headings) {
            if (visibleIds.has(h.id)) {
              setActiveId(h.id);
              break;
            }
          }
        }
      },
      {
        root: scrollContainer,
        rootMargin: "0px 0px -70% 0px",
        threshold: 0,
      }
    );

    const container = document.querySelector(".preview-content");
    if (!container) return;

    const els = container.querySelectorAll("h1, h2, h3, h4, h5, h6");
    els.forEach((el) => {
      if (el.id) observerRef.current!.observe(el);
    });

    return () => {
      observerRef.current?.disconnect();
    };
  }, [headings, outlineVisible, editMode]);

  // Focus management: move focus between collapse chevron and rail on toggle.
  // Uses a pending-focus mechanism for when the target isn't mounted yet
  // (e.g., toggling outline while in edit mode or with no headings).
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      prevVisibleRef.current = outlineVisible;
      return;
    }
    if (prevVisibleRef.current === outlineVisible) return;
    const wasVisible = prevVisibleRef.current;
    prevVisibleRef.current = outlineVisible;

    if (wasVisible && !outlineVisible) {
      if (railRef.current) {
        railRef.current.focus();
      } else {
        pendingFocusRef.current = "rail";
      }
    } else if (!wasVisible && outlineVisible) {
      if (collapseRef.current) {
        collapseRef.current.focus();
      } else {
        pendingFocusRef.current = "collapse";
      }
    }
  }, [outlineVisible]);

  // Apply pending focus when refs become available (e.g., exiting edit mode)
  useEffect(() => {
    if (pendingFocusRef.current === "rail" && railRef.current) {
      railRef.current.focus();
      pendingFocusRef.current = null;
    } else if (pendingFocusRef.current === "collapse" && collapseRef.current) {
      collapseRef.current.focus();
      pendingFocusRef.current = null;
    }
  });

  const handleClick = useCallback((id: string) => {
    const scrollContainer = document.querySelector(".preview-scroll");
    const target = document.getElementById(id);
    if (!scrollContainer || !target) return;

    // Calculate offset within the scroll container
    const containerRect = scrollContainer.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const offset = targetRect.top - containerRect.top + scrollContainer.scrollTop;

    scrollContainer.scrollTo({
      top: offset - 16, // small top margin
      behavior: "smooth",
    });

    setActiveId(id);
  }, []);

  // No headings or in edit mode — show nothing
  if (headings.length === 0 || editMode) {
    return null;
  }

  // Outline hidden but headings exist — show the rail
  if (!outlineVisible) {
    return (
      <button
        ref={railRef}
        className="outline-rail"
        onClick={toggleOutline}
        aria-label="Show outline"
        title="Show outline (⌘⇧O)"
      >
        <ExpandIcon />
      </button>
    );
  }

  // Determine the minimum heading level for relative indentation
  const minLevel = Math.min(...headings.map((h) => h.level));

  return (
    <nav className="document-outline" aria-label="Document outline">
      <OutlineResizeHandle />
      <div className="outline-header">
        <span>Contents</span>
        <button
          ref={collapseRef}
          className="outline-collapse-btn"
          onClick={toggleOutline}
          aria-label="Close outline"
          title="Close outline (⌘⇧O)"
        >
          <CollapseIcon />
        </button>
      </div>
      <div className="outline-list">
        {headings.map((h, i) => (
          <button
            key={`${h.id}-${i}`}
            className={`outline-item ${activeId === h.id ? "active" : ""}`}
            style={{ paddingLeft: `${8 + (h.level - minLevel) * 12}px` }}
            onClick={() => handleClick(h.id)}
            title={h.text}
          >
            <span className="outline-item-text">{h.text}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
