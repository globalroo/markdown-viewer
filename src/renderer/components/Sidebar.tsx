import { useAppStore } from "../store";
import { FileTree } from "./FileTree";
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { ChevronIcon, ProjectIcon, AddFolderIcon } from "./Icons";

const SIDEBAR_SIZE_OPTIONS = [
  ["small", "Small"],
  ["medium", "Medium"],
  ["large", "Large"],
] as const;

const DRAG_MIME = "application/x-viewmd-path";

function ProjectSection({ project, connectedPaths }: { project: { id: string; rootPath: string; name: string; tree: TreeNode[]; isExpanded: boolean }; connectedPaths?: Set<string> }) {
  const { toggleProject, removeProject, searchQuery } = useAppStore();
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    setIsDragOver(false);
    const raw = e.dataTransfer.getData(DRAG_MIME);
    if (!raw) return;
    e.preventDefault();

    try {
      const { path: sourcePath, projectRootPath: sourceRoot } = JSON.parse(raw);

      // Guard: no drop on own parent
      const sourceDir = sourcePath.replace(/[/\\][^/\\]+$/, "");
      if (sourceDir === project.rootPath) return;

      const { newPath } = await window.api.moveFile(sourcePath, project.rootPath);

      const state = useAppStore.getState();

      // Re-scan source project
      const sourceProject = state.projects.find((p) => p.rootPath === sourceRoot);
      if (sourceProject) {
        const newTree = await window.api.scanDirectory(sourceRoot);
        state.updateProjectTree(sourceProject.id, newTree, sourcePath, newPath);
      }

      // Re-scan destination project if different
      if (sourceRoot !== project.rootPath) {
        const newTree = await window.api.scanDirectory(project.rootPath);
        state.updateProjectTree(project.id, newTree);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Move failed";
      alert(msg);
    }
  }, [project.rootPath, project.id]);

  return (
    <div className="project-section">
      <div
        className={`project-header ${isDragOver ? "drag-over" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <button
          className="project-toggle"
          onClick={() => toggleProject(project.id)}
          title={project.rootPath}
        >
          <span className="tree-icon">
            <ChevronIcon expanded={project.isExpanded} />
          </span>
          <span className="tree-icon-secondary">
            <ProjectIcon open={project.isExpanded} />
          </span>
          <span className="project-name">{project.name}</span>
        </button>
        <button
          className="project-remove"
          onClick={() => removeProject(project.id)}
          title="Remove project"
          aria-label={`Remove ${project.name}`}
        >
          <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <line x1="2" y1="2" x2="10" y2="10" />
            <line x1="10" y1="2" x2="2" y2="10" />
          </svg>
        </button>
      </div>
      {project.isExpanded && (
        <div className="project-tree">
          <FileTree tree={project.tree} searchQuery={searchQuery} projectRootPath={project.rootPath} connectedPaths={connectedPaths} />
        </div>
      )}
    </div>
  );
}

function SidebarResizeHandle() {
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const { setSidebarWidth, resetSidebarWidth, sidebarWidth } = useAppStore();

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    startXRef.current = e.clientX;
    startWidthRef.current = useAppStore.getState().sidebarWidth;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!(e.target as HTMLElement).hasPointerCapture(e.pointerId)) return;
    const delta = e.clientX - startXRef.current;
    const next = Math.min(500, Math.max(180, startWidthRef.current + delta));
    document.documentElement.style.setProperty("--sidebar-width", `${next}px`);
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!(e.target as HTMLElement).hasPointerCapture(e.pointerId)) return;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    const delta = e.clientX - startXRef.current;
    const next = Math.min(500, Math.max(180, startWidthRef.current + delta));
    setSidebarWidth(next);
  }, [setSidebarWidth]);

  const handleDoubleClick = useCallback(() => {
    resetSidebarWidth();
  }, [resetSidebarWidth]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const store = useAppStore.getState();
    let next: number | null = null;
    if (e.key === "ArrowLeft") next = store.sidebarWidth - 10;
    else if (e.key === "ArrowRight") next = store.sidebarWidth + 10;
    else if (e.key === "Home") next = 180;
    else if (e.key === "End") next = 500;
    if (next !== null) {
      e.preventDefault();
      setSidebarWidth(next);
    }
  }, [setSidebarWidth]);

  return (
    <div
      className="sidebar-resize-handle"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      role="separator"
      aria-orientation="vertical"
      aria-valuenow={sidebarWidth}
      aria-valuemin={180}
      aria-valuemax={500}
      aria-label="Resize sidebar"
      tabIndex={0}
    />
  );
}

function SidebarTextSizeButton() {
  const [open, setOpen] = useState(false);
  const { sidebarFontSize, setSidebarFontSize } = useAppStore();
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const toggle = useCallback(() => setOpen((o) => !o), []);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (popRef.current?.contains(e.target as Node)) return;
      if (btnRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);

  // Compute fixed position so the popover escapes sidebar's overflow:hidden
  const popStyle = (() => {
    if (!open || !btnRef.current) return {};
    const rect = btnRef.current.getBoundingClientRect();
    return { position: "fixed" as const, top: rect.bottom + 4, left: rect.left, zIndex: 50 };
  })();

  return (
    <div className="sidebar-text-size-anchor">
      <button
        ref={btnRef}
        className="sidebar-text-size-btn"
        onClick={toggle}
        aria-label="Sidebar text size"
        aria-expanded={open}
        title="Sidebar text size"
      >
        Aa
      </button>
      {open && (
        <div ref={popRef} className="sidebar-text-popover" style={popStyle} role="menu">
          {SIDEBAR_SIZE_OPTIONS.map(([id, label]) => (
            <button
              key={id}
              className={`toolbar-popover-item ${sidebarFontSize === id ? "active" : ""}`}
              onClick={() => { setSidebarFontSize(id); setOpen(false); }}
              role="menuitem"
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const lower = text.toLowerCase();
  const qLower = query.toLowerCase();
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  let idx = lower.indexOf(qLower, cursor);
  let key = 0;
  while (idx !== -1) {
    if (idx > cursor) {
      parts.push(<span key={key++}>{text.slice(cursor, idx)}</span>);
    }
    parts.push(
      <mark key={key++} className="search-highlight">
        {text.slice(idx, idx + query.length)}
      </mark>
    );
    cursor = idx + query.length;
    idx = lower.indexOf(qLower, cursor);
  }
  if (cursor < text.length) {
    parts.push(<span key={key++}>{text.slice(cursor)}</span>);
  }
  return <>{parts}</>;
}

function ContentSearchResults({
  results,
  query,
  isSearching,
}: {
  results: SearchResult[];
  query: string;
  isSearching: boolean;
}) {
  const { selectFile } = useAppStore();

  // TODO(Issue 9): When clicking a content search result in collapsible mode,
  // the matched content may be inside a collapsed section. This requires
  // cross-component communication to expand the relevant section. For now,
  // users can use Cmd+F which already expands all sections for native find.
  const handleClick = useCallback(
    (result: SearchResult) => {
      // Use openTab + selectFile only — MarkdownPreview's useEffect handles
      // file reading and the dirty-draft save/discard guard.
      const store = useAppStore.getState();
      store.openTab(result.filePath);
      store.selectFile(result.filePath);
      // TODO: scroll to approximate line position after content loads
    },
    [selectFile]
  );

  // Group results by file
  const grouped = useMemo(() => {
    const map = new Map<string, SearchResult[]>();
    for (const r of results) {
      let list = map.get(r.filePath);
      if (!list) {
        list = [];
        map.set(r.filePath, list);
      }
      list.push(r);
    }
    return map;
  }, [results]);

  if (isSearching) {
    return <div className="search-results-status">Searching...</div>;
  }

  if (results.length === 0 && query) {
    return <div className="search-results-status">No content matches</div>;
  }

  return (
    <div className="search-results-list">
      {Array.from(grouped.entries()).map(([filePath, fileResults]) => {
        const fileName = filePath.split(/[/\\]/).pop() || filePath;
        return (
          <div key={filePath} className="search-result-group">
            <div className="search-result-file" title={filePath}>
              {fileName}
            </div>
            {fileResults.map((r, i) => (
              <button
                key={`${r.line}-${i}`}
                className="search-result-item"
                onClick={() => handleClick(r)}
                title={`${filePath}:${r.line}`}
              >
                <span className="search-result-line">L{r.line}</span>
                <span className="search-result-text">
                  <HighlightedText text={r.text.trim()} query={query} />
                </span>
              </button>
            ))}
          </div>
        );
      })}
      {results.length >= 100 && (
        <div className="search-results-status">
          Showing first 100 results. Refine your query.
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const { projects, searchQuery, setSearchQuery, sidebarVisible, linksFilterActive, toggleLinksFilter, linksFilterHops, setLinksFilterHops, selectedFile, linkGraph } = useAppStore();
  const [contentSearchMode, setContentSearchMode] = useState(false);
  const [contentResults, setContentResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQueryRef = useRef("");

  // Connected files filter: fetch connected paths when filter is active
  const [connectedPaths, setConnectedPaths] = useState<Set<string> | undefined>(undefined);
  useEffect(() => {
    if (!linksFilterActive || !selectedFile) {
      setConnectedPaths(undefined);
      return;
    }
    let cancelled = false;
    window.api.getConnectedPaths(selectedFile, linksFilterHops).then((paths) => {
      if (cancelled) return;
      const pathSet = new Set(paths);
      setConnectedPaths(pathSet);
      // Auto-expand ancestor directories so filtered files are visible
      const store = useAppStore.getState();
      const dirsToExpand = new Set<string>();
      for (const p of paths) {
        let dir = p.substring(0, p.lastIndexOf("/"));
        while (dir && !store.expandedDirs.has(dir)) {
          dirsToExpand.add(dir);
          dir = dir.substring(0, dir.lastIndexOf("/"));
        }
      }
      for (const d of dirsToExpand) store.toggleDir(d);
    });
    return () => { cancelled = true; };
  }, [linksFilterActive, selectedFile, linksFilterHops, linkGraph]);

  const handleAddFolder = useCallback(async () => {
    const result = await window.api.openFolder();
    if (result) {
      useAppStore.getState().addProject(result.rootPath, result.tree);
    }
  }, []);

  // Run content search with debounce
  const runContentSearch = useCallback(
    (query: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      lastQueryRef.current = query;

      if (!query.trim()) {
        setContentResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      debounceRef.current = setTimeout(() => {
        const roots = useAppStore
          .getState()
          .projects.map((p) => p.rootPath);
        window.api.searchContent(query, roots).then((results) => {
          // Only apply results if query hasn't changed since dispatch
          if (lastQueryRef.current === query) {
            setContentResults(results);
            setIsSearching(false);
          }
        });
      }, 300);
    },
    []
  );

  // Handle Enter key to trigger content search mode
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && searchQuery.trim()) {
        e.preventDefault();
        if (!contentSearchMode) {
          setContentSearchMode(true);
        }
        runContentSearch(searchQuery);
      }
      if (e.key === "Escape") {
        if (contentSearchMode) {
          setContentSearchMode(false);
          setContentResults([]);
          setIsSearching(false);
        }
      }
    },
    [searchQuery, contentSearchMode, runContentSearch]
  );

  // Re-run content search when query changes while in content mode
  useEffect(() => {
    if (contentSearchMode && searchQuery.trim()) {
      runContentSearch(searchQuery);
    } else if (contentSearchMode && !searchQuery.trim()) {
      setContentResults([]);
      setIsSearching(false);
    }
  }, [searchQuery, contentSearchMode, runContentSearch]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleClear = useCallback(() => {
    setSearchQuery("");
    setContentSearchMode(false);
    setContentResults([]);
    setIsSearching(false);
  }, [setSearchQuery]);

  const toggleSearchMode = useCallback(() => {
    const next = !contentSearchMode;
    setContentSearchMode(next);
    if (next && searchQuery.trim()) {
      runContentSearch(searchQuery);
    } else {
      setContentResults([]);
      setIsSearching(false);
    }
  }, [contentSearchMode, searchQuery, runContentSearch]);

  if (!sidebarVisible) return null;

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <button className="open-folder-btn" onClick={handleAddFolder} title="Add Project Folder">
          <AddFolderIcon /> Add Folder
        </button>
        <SidebarTextSizeButton />
      </div>

      {projects.length > 0 && (
        <div className="search-container">
          <input
            type="text"
            className="search-input"
            placeholder={contentSearchMode ? "Search in files..." : "Filter files..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="search-actions">
            <button
              className={`search-mode-toggle ${contentSearchMode ? "active" : ""}`}
              onClick={toggleSearchMode}
              title={contentSearchMode ? "Switch to filename filter" : "Search file contents (Enter)"}
              aria-label="Toggle content search"
            >
              <svg aria-hidden="true" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="6.5" cy="6.5" r="5" />
                <line x1="10" y1="10" x2="14.5" y2="14.5" />
              </svg>
            </button>
            {searchQuery && (
              <button
                className="search-clear"
                onClick={handleClear}
                aria-label="Clear search"
              >
                <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <line x1="1" y1="1" x2="9" y2="9" />
                  <line x1="9" y1="1" x2="1" y2="9" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      {linksFilterActive && selectedFile && (
        <div className="links-filter-pill">
          <span>Linked files ({linksFilterHops === 1 ? "1-hop" : "2-hop"})</span>
          <select
            className="links-filter-hops"
            value={linksFilterHops}
            onChange={(e) => setLinksFilterHops(Number(e.target.value) as 1 | 2)}
          >
            <option value={1}>1-hop</option>
            <option value={2}>2-hop</option>
          </select>
          <button
            className="links-filter-clear"
            onClick={toggleLinksFilter}
            aria-label="Clear link filter"
          >
            <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="1" y1="1" x2="9" y2="9" />
              <line x1="9" y1="1" x2="1" y2="9" />
            </svg>
          </button>
        </div>
      )}

      <div className="sidebar-content">
        {contentSearchMode ? (
          <ContentSearchResults
            results={contentResults}
            query={searchQuery}
            isSearching={isSearching}
          />
        ) : (
          <>
            {projects.map((project) => (
              <ProjectSection key={project.id} project={project} connectedPaths={connectedPaths} />
            ))}

            {projects.length === 0 && (
              <div className="sidebar-empty">
                <p>Add a folder to browse markdown files</p>
                <p className="shortcut-hint">
                  {navigator.platform.includes("Mac") ? "⌘" : "Ctrl+"}O
                </p>
              </div>
            )}
          </>
        )}
      </div>
      <SidebarResizeHandle />
    </aside>
  );
}
