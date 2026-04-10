import { useEffect, useState, useRef, useCallback } from "react";
import { useAppStore } from "../store";

interface HeadingEntry {
  id: string;
  text: string;
  level: number;
}

function OutlineIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <line x1="3" y1="3" x2="13" y2="3" />
      <line x1="5" y1="6" x2="13" y2="6" />
      <line x1="5" y1="9" x2="13" y2="9" />
      <line x1="3" y1="12" x2="13" y2="12" />
    </svg>
  );
}

export { OutlineIcon };

export function DocumentOutline() {
  const [headings, setHeadings] = useState<HeadingEntry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const outlineVisible = useAppStore((s) => s.outlineVisible);

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

  if (!outlineVisible || headings.length === 0 || editMode) {
    return null;
  }

  // Determine the minimum heading level for relative indentation
  const minLevel = Math.min(...headings.map((h) => h.level));

  return (
    <nav className="document-outline" aria-label="Document outline">
      <div className="outline-header">Contents</div>
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
