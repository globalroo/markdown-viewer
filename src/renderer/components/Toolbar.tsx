import { useAppStore, THEMES } from "../store";
import { useState, useRef, useEffect, useCallback } from "react";

const isMac = navigator.platform.includes("Mac");
const mod = isMac ? "⌘" : "Ctrl+";

function SidebarIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="2" width="14" height="12" rx="2" />
      <line x1="5.5" y1="2" x2="5.5" y2="14" />
    </svg>
  );
}

function PrintIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <polyline points="4,6 4,1 12,1 12,6" />
      <rect x="1" y="6" width="14" height="7" rx="1" />
      <rect x="4" y="10" width="8" height="5" />
    </svg>
  );
}

function WidthIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <line x1="3" y1="3" x2="3" y2="13" />
      <line x1="13" y1="3" x2="13" y2="13" />
      <polyline points="1,8 3,6 3,10 1,8" fill="currentColor" stroke="none" />
      <polyline points="15,8 13,6 13,10 15,8" fill="currentColor" stroke="none" />
      <line x1="6" y1="6" x2="10" y2="6" />
      <line x1="5" y1="8" x2="11" y2="8" />
      <line x1="6" y1="10" x2="10" y2="10" />
    </svg>
  );
}

const WIDTH_OPTIONS = [
  ["narrow", "Narrow"],
  ["standard", "Standard"],
  ["wide", "Wide"],
  ["full", "Full"],
] as const;

function ContentWidthPopover() {
  const [open, setOpen] = useState(false);
  const { contentWidth, setContentWidth } = useAppStore();
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

  return (
    <div className="toolbar-popover-anchor">
      <button
        ref={btnRef}
        className="toolbar-btn"
        onClick={toggle}
        aria-label="Content width"
        aria-expanded={open}
        title="Content width"
      >
        <WidthIcon />
      </button>
      {open && (
        <div ref={popRef} className="toolbar-popover" role="menu">
          {WIDTH_OPTIONS.map(([id, label]) => (
            <button
              key={id}
              className={`toolbar-popover-item ${contentWidth === id ? "active" : ""}`}
              onClick={() => { setContentWidth(id); setOpen(false); }}
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

function SettingsIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="2.5" />
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M2.9 2.9l1.4 1.4M11.7 11.7l1.4 1.4M13.1 2.9l-1.4 1.4M4.3 11.7l-1.4 1.4" />
    </svg>
  );
}

export function Toolbar() {
  const {
    fontSize,
    increaseFontSize,
    decreaseFontSize,
    resetFontSize,
    theme,
    toggleTheme,
    toggleSidebar,
    toggleSettings,
    selectedFile,
  } = useAppStore();

  const themeInfo = THEMES.find((t) => t.id === theme);
  const themeLabel = themeInfo?.name || "System";

  return (
    <div className="toolbar" role="toolbar" aria-label="Viewer controls">
      <button
        className="toolbar-btn"
        onClick={toggleSidebar}
        aria-label="Toggle sidebar"
        title={`Toggle sidebar (${mod}B)`}
      >
        <SidebarIcon />
      </button>
      <div className="toolbar-spacer" />
      <div className="toolbar-group" role="group" aria-label="Font size">
        <button
          className="toolbar-btn"
          onClick={decreaseFontSize}
          aria-label="Decrease font size"
          title={`Decrease font size (${mod}-)`}
        >
          A-
        </button>
        <button
          className="toolbar-label"
          onClick={resetFontSize}
          aria-label={`Reset font size to 16px, currently ${fontSize}px`}
          title={`Reset font size (${mod}0)`}
        >
          {fontSize}px
        </button>
        <button
          className="toolbar-btn"
          onClick={increaseFontSize}
          aria-label="Increase font size"
          title={`Increase font size (${mod}+)`}
        >
          A+
        </button>
      </div>
      <ContentWidthPopover />
      {selectedFile && (
        <button
          className="toolbar-btn"
          onClick={() => window.print()}
          aria-label="Print document"
          title={`Print rendered markdown (${mod}P)`}
        >
          <PrintIcon />
        </button>
      )}
      <button
        className="toolbar-btn"
        onClick={toggleTheme}
        aria-label={`Quick switch theme, currently ${themeLabel}`}
        title={`Quick switch theme (${mod}D)`}
      >
        {themeLabel}
      </button>
      <button
        className="toolbar-btn"
        onClick={toggleSettings}
        aria-label="Open settings"
        title="Settings"
      >
        <SettingsIcon />
      </button>
    </div>
  );
}
