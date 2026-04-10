import { useEffect, useRef, useCallback, useState } from "react";
import { useAppStore, THEMES, FONTS, type ThemeId, type FontId } from "../store";

export function Settings() {
  const { theme, setTheme, font, setFont, contentWidth, setContentWidth, lineHeight, setLineHeight, warmFilter, toggleWarmFilter, sidebarFontSize, setSidebarFontSize, settingsOpen, toggleSettings, customCSSPath, setCustomCSS, clearCustomCSS: storeClearCustomCSS } =
    useAppStore();
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape key and focus management
  useEffect(() => {
    if (!settingsOpen) return;

    // Focus the panel on open
    panelRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        toggleSettings();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [settingsOpen, toggleSettings]);

  if (!settingsOpen) return null;

  const coreThemes = THEMES.filter((t) => t.group === "core");
  const readingThemes = THEMES.filter((t) => t.group === "reading");
  const colourThemes = THEMES.filter((t) => t.group === "colour");
  const a11yThemes = THEMES.filter((t) => t.group === "accessibility");

  return (
    <div className="settings-overlay" onClick={toggleSettings}>
      <div
        ref={panelRef}
        className="settings-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        tabIndex={-1}
      >
        <div className="settings-header">
          <h2>Settings</h2>
          <button
            className="settings-close"
            onClick={toggleSettings}
            aria-label="Close settings"
          >
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="1" y1="1" x2="13" y2="13" />
              <line x1="13" y1="1" x2="1" y2="13" />
            </svg>
          </button>
        </div>

        <div className="settings-body">
          <section className="settings-section">
            <h3>Theme</h3>

            <div className="settings-group-label">Core</div>
            <div className="theme-grid">
              {coreThemes.map((t) => (
                <ThemeSwatch
                  key={t.id}
                  theme={t}
                  active={theme === t.id}
                  onSelect={setTheme}
                />
              ))}
            </div>

            <div className="settings-group-label">Reading Comfort</div>
            <div className="theme-grid">
              {readingThemes.map((t) => (
                <ThemeSwatch
                  key={t.id}
                  theme={t}
                  active={theme === t.id}
                  onSelect={setTheme}
                />
              ))}
            </div>

            <div className="settings-group-label">Colour</div>
            <div className="theme-grid">
              {colourThemes.map((t) => (
                <ThemeSwatch
                  key={t.id}
                  theme={t}
                  active={theme === t.id}
                  onSelect={setTheme}
                />
              ))}
            </div>

            <div className="settings-group-label">Accessibility</div>
            <div className="theme-grid">
              {a11yThemes.map((t) => (
                <ThemeSwatch
                  key={t.id}
                  theme={t}
                  active={theme === t.id}
                  onSelect={setTheme}
                />
              ))}
            </div>
          </section>

          <section className="settings-section">
            <h3>Reading Font</h3>
            <div className="font-list">
              {FONTS.map((f) => (
                <button
                  key={f.id}
                  className={`font-option ${font === f.id ? "active" : ""}`}
                  onClick={() => setFont(f.id)}
                >
                  <span className="font-option-name">{f.name}</span>
                  <span className="font-option-desc">{f.description}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="settings-section">
            <h3>Layout</h3>

            <div className="settings-group-label">Sidebar Text</div>
            <div className="segmented-control" role="group" aria-label="Sidebar text size">
              {([["small", "Small"], ["medium", "Medium"], ["large", "Large"]] as const).map(([id, label]) => (
                <button
                  key={id}
                  className={`segmented-btn ${sidebarFontSize === id ? "active" : ""}`}
                  onClick={() => setSidebarFontSize(id)}
                  aria-pressed={sidebarFontSize === id}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="settings-group-label">Line Width</div>
            <div className="segmented-control" role="group" aria-label="Line width">
              {([["narrow", "Narrow"], ["standard", "Standard"], ["wide", "Wide"], ["full", "Full"]] as const).map(([id, label]) => (
                <button
                  key={id}
                  className={`segmented-btn ${contentWidth === id ? "active" : ""}`}
                  onClick={() => setContentWidth(id)}
                  aria-pressed={contentWidth === id}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="settings-group-label">Line Spacing</div>
            <div className="segmented-control" role="group" aria-label="Line spacing">
              {([["compact", "Compact"], ["optimal", "Optimal"], ["relaxed", "Relaxed"]] as const).map(([id, label]) => (
                <button
                  key={id}
                  className={`segmented-btn ${lineHeight === id ? "active" : ""}`}
                  onClick={() => setLineHeight(id)}
                  aria-pressed={lineHeight === id}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="settings-group-label">Comfort</div>
            <button
              className={`toggle-option ${warmFilter ? "active" : ""}`}
              onClick={toggleWarmFilter}
            >
              <span className="toggle-option-label">Warm filter</span>
              <span className="toggle-option-desc">Reduces blue light for evening reading</span>
            </button>
          </section>

          <section className="settings-section">
            <h3>Custom CSS</h3>
            <p className="settings-hint">
              Load a .css file to style the preview area. Rules should target
              <code>.preview-content</code> and its children.
            </p>
            <div className="custom-css-controls">
              <button
                className="custom-css-btn"
                onClick={async () => {
                  const result = await window.api.loadCustomCSS();
                  if (result) {
                    setCustomCSS(result.path, result.content);
                  }
                }}
              >
                Load CSS File...
              </button>
              {customCSSPath && (
                <button
                  className="custom-css-btn custom-css-clear"
                  onClick={async () => {
                    await window.api.clearCustomCSS();
                    storeClearCustomCSS();
                  }}
                >
                  Clear
                </button>
              )}
            </div>
            <div className="custom-css-status">
              {customCSSPath
                ? customCSSPath.split(/[/\\]/).pop()
                : "None"}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

const SWATCH_COLOURS: Record<ThemeId, { bg: string; sidebar: string; accent: string; text: string }> = {
  system: { bg: "#faf9f7", sidebar: "#f0eeeb", accent: "#3b82f6", text: "#1c1917" },
  light: { bg: "#faf9f7", sidebar: "#f0eeeb", accent: "#3b82f6", text: "#1c1917" },
  dark: { bg: "#171717", sidebar: "#1e1e1e", accent: "#60a5fa", text: "#e5e5e5" },
  aurora: { bg: "#1a1625", sidebar: "#211d2e", accent: "#a855f7", text: "#ede9f6" },
  prism: { bg: "#fffbf5", sidebar: "#fef3e2", accent: "#f97316", text: "#451a03" },
  solstice: { bg: "#0f172a", sidebar: "#141d33", accent: "#f59e0b", text: "#e2e8f0" },
  ember: { bg: "#fdf6f0", sidebar: "#f5ebe0", accent: "#d97706", text: "#3e2318" },
  lagoon: { bg: "#0d1b1e", sidebar: "#122226", accent: "#26a69a", text: "#e0f2f1" },
  dusk: { bg: "#1e1520", sidebar: "#261c29", accent: "#ec4899", text: "#f0e4f0" },
  "stark-light": { bg: "#ffffff", sidebar: "#f5f5f5", accent: "#0000cc", text: "#000000" },
  "stark-dark": { bg: "#000000", sidebar: "#0a0a0a", accent: "#6eb5ff", text: "#ffffff" },
  clarity: { bg: "#f8f7f4", sidebar: "#eeedea", accent: "#0066cc", text: "#1a1a1a" },
  terrain: { bg: "#f5f5eb", sidebar: "#eaeade", accent: "#2255aa", text: "#1a1a0e" },
  sapphire: { bg: "#f7f5f5", sidebar: "#ece8e8", accent: "#b91c1c", text: "#1a1414" },
  sepia: { bg: "#f5f0e8", sidebar: "#ece5d8", accent: "#a0774a", text: "#3b2e1e" },
  sage: { bg: "#eaf4e2", sidebar: "#e0ebd8", accent: "#4a8a5a", text: "#253126" },
  "twilight-reader": { bg: "#1a1a2e", sidebar: "#20203a", accent: "#7eb8da", text: "#d4d0cc" },
};

function ThemeSwatch({
  theme,
  active,
  onSelect,
}: {
  theme: { id: ThemeId; name: string };
  active: boolean;
  onSelect: (id: ThemeId) => void;
}) {
  const colours = SWATCH_COLOURS[theme.id];
  return (
    <button
      className={`theme-swatch ${active ? "active" : ""}`}
      onClick={() => onSelect(theme.id)}
      title={theme.name}
      aria-label={`${theme.name} theme`}
      aria-pressed={active}
    >
      <div className="swatch-preview">
        <div
          className="swatch-bg"
          style={{ background: colours.bg }}
        >
          <div
            className="swatch-sidebar"
            style={{ background: colours.sidebar }}
          />
          <div
            className="swatch-accent"
            style={{ background: colours.accent }}
          />
        </div>
      </div>
      <span className="swatch-label">{theme.name}</span>
    </button>
  );
}
