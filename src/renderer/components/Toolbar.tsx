import { useAppStore } from "../store";

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
    <div className="toolbar">
      <button
        className="toolbar-btn"
        onClick={toggleSidebar}
        title="Toggle sidebar (⌘B)"
      >
        ☰
      </button>
      <div className="toolbar-spacer" />
      <div className="toolbar-group">
        <button
          className="toolbar-btn"
          onClick={decreaseFontSize}
          title="Decrease font size (⌘-)"
        >
          A-
        </button>
        <span
          className="toolbar-label"
          onClick={resetFontSize}
          title="Reset font size (⌘0)"
        >
          {fontSize}px
        </span>
        <button
          className="toolbar-btn"
          onClick={increaseFontSize}
          title="Increase font size (⌘+)"
        >
          A+
        </button>
      </div>
      {selectedFile && (
        <button
          className="toolbar-btn"
          onClick={() => window.print()}
          title="Print rendered markdown (⌘P)"
        >
          🖨
        </button>
      )}
      <button
        className="toolbar-btn"
        onClick={toggleTheme}
        title="Toggle theme (⌘D)"
      >
        {theme === "dark" ? "🌙" : theme === "light" ? "☀️" : "💻"}{" "}
        {themeLabel}
      </button>
    </div>
  );
}
