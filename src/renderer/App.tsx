import { useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { MarkdownPreview } from "./components/MarkdownPreview";
import { DocumentOutline } from "./components/DocumentOutline";
import { TabBar } from "./components/TabBar";
import { Toolbar } from "./components/Toolbar";
import { Settings } from "./components/Settings";
import { useAppStore } from "./store";
import "./styles/app.css";
import "./styles/themes.css";
import "highlight.js/styles/github.css";

function useKeyboardShortcuts() {
  const {
    increaseFontSize,
    decreaseFontSize,
    resetFontSize,
    toggleTheme,
    toggleSidebar,
    toggleSettings,
  } = useAppStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const state = useAppStore.getState();

      // Escape exits focus mode (no mod key needed)
      if (e.key === "Escape" && state.focusMode) {
        e.preventDefault();
        state.toggleFocusMode();
        return;
      }

      if (!mod) return;

      // Don't fire shortcuts when settings modal is open
      if (state.settingsOpen && e.key !== ",") return;

      // When editing, only allow save (s) and edit toggle (e)
      const isEditing = (e.target as HTMLElement)?.tagName === "TEXTAREA";
      if (isEditing) {
        if (e.key === "s") {
          e.preventDefault();
          if (state.editDirty && state.selectedFile) {
            window.api.writeFile(state.selectedFile, state.editContent).then(() => {
              useAppStore.getState().setEditDirty(false);
              useAppStore.getState().setMarkdownContent(state.editContent);
            });
          }
          return;
        }
        if (e.key === "e") {
          e.preventDefault();
          state.setEditMode(!state.editMode);
          return;
        }
        return; // suppress all other shortcuts while editing
      }

      switch (e.key) {
        case "=":
        case "+":
          e.preventDefault();
          increaseFontSize();
          break;
        case "-":
          e.preventDefault();
          decreaseFontSize();
          break;
        case "0":
          e.preventDefault();
          resetFontSize();
          break;
        case "d":
          if (!e.shiftKey) {
            e.preventDefault();
            toggleTheme();
          }
          break;
        case "b":
          e.preventDefault();
          toggleSidebar();
          break;
        case ",":
          e.preventDefault();
          toggleSettings();
          break;
        case "o":
        case "O":
          if (e.shiftKey) {
            e.preventDefault();
            state.toggleOutline();
          } else {
            e.preventDefault();
            window.api.openFolder().then((result) => {
              if (result) {
                useAppStore.getState().addProject(result.rootPath, result.tree);
              }
            });
          }
          break;
        case "p":
          e.preventDefault();
          window.print();
          break;
        case "f":
        case "F":
          if (e.shiftKey) {
            e.preventDefault();
            state.toggleFocusMode();
          } else {
            e.preventDefault();
            const searchInput =
              document.querySelector<HTMLInputElement>(".search-input");
            searchInput?.focus();
          }
          break;
        case "w":
          if (state.activeTab) {
            e.preventDefault();
            state.closeTab(state.activeTab);
          }
          break;
        case "e":
          if (state.selectedFile) {
            e.preventDefault();
            state.setEditMode(!state.editMode);
          }
          break;
        case "s":
          if (state.editMode && state.editDirty && state.selectedFile) {
            e.preventDefault();
            window.api.writeFile(state.selectedFile, state.editContent).then(() => {
              useAppStore.getState().setEditDirty(false);
              useAppStore.getState().setMarkdownContent(state.editContent);
            });
          }
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    increaseFontSize,
    decreaseFontSize,
    resetFontSize,
    toggleTheme,
    toggleSidebar,
    toggleSettings,
  ]);
}

function useThemeAndFont() {
  const theme = useAppStore((s) => s.theme);
  const font = useAppStore((s) => s.font);

  useEffect(() => {
    const root = document.documentElement;

    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const apply = () => {
        root.setAttribute("data-theme", mq.matches ? "dark" : "light");
      };
      apply();
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }

    root.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute("data-font", font);
  }, [font]);
}

const WIDTH_MAP = { narrow: "38rem", standard: "44rem", wide: "52rem", full: "none" };
const HEIGHT_MAP = { compact: "1.35", optimal: "1.45", relaxed: "1.55" };
const SIDEBAR_FONT_BASE = { small: 12, medium: 13, large: 15 };

function useReadingComfort() {
  const contentWidth = useAppStore((s) => s.contentWidth);
  const lineHeight = useAppStore((s) => s.lineHeight);
  const warmFilter = useAppStore((s) => s.warmFilter);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--content-width", WIDTH_MAP[contentWidth]);
    root.style.setProperty("--line-height", HEIGHT_MAP[lineHeight]);
  }, [contentWidth, lineHeight]);

  useEffect(() => {
    const root = document.documentElement;
    if (warmFilter) {
      root.classList.add("warm-filter");
    } else {
      root.classList.remove("warm-filter");
    }
  }, [warmFilter]);
}

function useSidebarLayout() {
  const sidebarWidth = useAppStore((s) => s.sidebarWidth);
  const sidebarFontSize = useAppStore((s) => s.sidebarFontSize);
  const fontSize = useAppStore((s) => s.fontSize);
  const outlineWidth = useAppStore((s) => s.outlineWidth);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--sidebar-width", `${sidebarWidth}px`);
    root.style.setProperty("--outline-width", `${outlineWidth}px`);
    const zoomFactor = fontSize / 16;
    // Compute small base, then ensure medium and large are always distinct
    const smallPx = Math.max(9, Math.round(SIDEBAR_FONT_BASE.small * zoomFactor));
    const sizes = { small: smallPx, medium: smallPx + 1, large: smallPx + 3 };
    root.style.setProperty("--sidebar-font-size", `${sizes[sidebarFontSize]}px`);
  }, [sidebarWidth, sidebarFontSize, fontSize, outlineWidth]);
}

const CUSTOM_CSS_STYLE_ID = "custom-user-css";

function useCustomCSS() {
  const customCSSContent = useAppStore((s) => s.customCSSContent);

  // On mount, load the saved custom CSS path from config
  useEffect(() => {
    window.api.getCustomCSS().then((result) => {
      if (result) {
        useAppStore.getState().setCustomCSS(result.path, result.content);
      }
    }).catch(() => {
      // Config unavailable — silently ignore
    });
  }, []);

  // Inject or remove the <style> element when customCSSContent changes
  useEffect(() => {
    let style = document.getElementById(CUSTOM_CSS_STYLE_ID) as HTMLStyleElement | null;

    if (customCSSContent) {
      if (!style) {
        style = document.createElement("style");
        style.id = CUSTOM_CSS_STYLE_ID;
        document.head.appendChild(style);
      }
      style.textContent = customCSSContent;
    } else {
      if (style) {
        style.remove();
      }
    }

    return () => {
      const el = document.getElementById(CUSTOM_CSS_STYLE_ID);
      if (el) el.remove();
    };
  }, [customCSSContent]);
}

function useFileAssociation() {
  useEffect(() => {
    const unsubFile = window.api.onFileOpened(async (filePath) => {
      const store = useAppStore.getState();
      const dirPath = filePath.replace(/[/\\][^/\\]+$/, "");
      const tree = await window.api.scanDirectory(dirPath);
      store.addProject(dirPath, tree);
      store.selectFile(filePath);
    });

    const unsubDir = window.api.onDirectoryOpened(async (dirPath) => {
      const store = useAppStore.getState();
      const tree = await window.api.scanDirectory(dirPath);
      store.addProject(dirPath, tree);
    });

    // File watching: auto-reload content when the selected file changes on disk
    const unsubFileChanged = window.api.onFileChanged((filePath, content) => {
      const state = useAppStore.getState();

      // Only update if this is the currently selected file
      if (state.selectedFile !== filePath) return;

      // Don't overwrite a dirty editor — the user has unsaved local changes
      if (state.editDirty) return;

      state.setMarkdownContent(content);

      // If in edit mode, sync the editor content too
      if (state.editMode) {
        state.setEditContent(content);
        state.setEditDirty(false);
      }
    });

    // File watching: auto-refresh tree when files are added/removed/renamed
    const unsubTreeChanged = window.api.onTreeChanged((rootPath, tree) => {
      const state = useAppStore.getState();
      const project = state.projects.find((p) => p.rootPath === rootPath);
      if (project) {
        state.updateProjectTree(project.id, tree);
        // If the selected file no longer exists in the updated tree, clear it
        const sel = useAppStore.getState().selectedFile;
        if (sel && sel.startsWith(rootPath)) {
          const stillExists = (nodes: TreeNode[]): boolean =>
            nodes.some((n) => n.path === sel || (n.children && stillExists(n.children)));
          if (!stillExists(tree)) {
            useAppStore.getState().closeTab(sel);
          }
        }
      }
    });

    // Pull initial CLI path after mount (avoids race with push-based IPC)
    window.api.getInitialPath().then(async (targetPath) => {
      if (!targetPath) return;
      const store = useAppStore.getState();
      try {
        const tree = await window.api.scanDirectory(targetPath);
        store.addProject(targetPath, tree);
      } catch {
        // targetPath might be a file, not a directory
        const dirPath = targetPath.replace(/[/\\][^/\\]+$/, "");
        const tree = await window.api.scanDirectory(dirPath);
        store.addProject(dirPath, tree);
        store.selectFile(targetPath);
      }
    }).catch(() => {
      // Initial path unavailable or inaccessible — silently ignore
    });

    return () => {
      unsubFile();
      unsubDir();
      unsubFileChanged();
      unsubTreeChanged();
    };
  }, []);
}

export function App() {
  useKeyboardShortcuts();
  useThemeAndFont();
  useReadingComfort();
  useSidebarLayout();
  useCustomCSS();
  useFileAssociation();

  const focusMode = useAppStore((s) => s.focusMode);

  return (
    <div className={`app ${focusMode ? "focus-mode" : ""}`}>
      <Toolbar />
      <div className="app-body">
        <Sidebar />
        <main className="main-content">
          <TabBar />
          <MarkdownPreview />
        </main>
        <DocumentOutline />
      </div>
      <Settings />
    </div>
  );
}
