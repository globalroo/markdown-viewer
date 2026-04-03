import { useAppStore } from "../store";

const isMac = navigator.platform.includes("Mac");
const mod = isMac ? "⌘" : "Ctrl+";

export function Toolbar() {
  const {
    fontSize,
    increaseFontSize,
    decreaseFontSize,
    resetFontSize,
    theme,
    toggleTheme,
    toggleSidebar,
    selectedFile,
  } = useAppStore();

  const themeLabel =
    theme === "system" ? "Auto" : theme === "light" ? "Light" : "Dark";

  return (
    <div className="toolbar" role="toolbar" aria-label="Viewer controls">
      <button
        className="toolbar-btn"
        onClick={toggleSidebar}
        aria-label="Toggle sidebar"
        title={`Toggle sidebar (${mod}B)`}
      >
        ☰
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
      {selectedFile && (
        <button
          className="toolbar-btn"
          onClick={() => window.print()}
          aria-label="Print document"
          title={`Print rendered markdown (${mod}P)`}
        >
          🖨
        </button>
      )}
      <button
        className="toolbar-btn"
        onClick={toggleTheme}
        aria-label={`Switch theme, currently ${themeLabel}`}
        title={`Toggle theme (${mod}D)`}
      >
        {theme === "dark" ? "🌙" : theme === "light" ? "☀️" : "💻"}{" "}
        {themeLabel}
      </button>
    </div>
  );
}
