import { useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { MarkdownPreview } from "./components/MarkdownPreview";
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
      if (!mod) return;

      const state = useAppStore.getState();

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
          e.preventDefault();
          window.api.openFolder().then((result) => {
            if (result) {
              useAppStore.getState().addProject(result.rootPath, result.tree);
            }
          });
          break;
        case "p":
          e.preventDefault();
          window.print();
          break;
        case "f":
          e.preventDefault();
          const searchInput =
            document.querySelector<HTMLInputElement>(".search-input");
          searchInput?.focus();
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

    return () => {
      unsubFile();
      unsubDir();
    };
  }, []);
}

export function App() {
  useKeyboardShortcuts();
  useThemeAndFont();
  useFileAssociation();

  return (
    <div className="app">
      <Toolbar />
      <div className="app-body">
        <Sidebar />
        <main className="main-content">
          <MarkdownPreview />
        </main>
      </div>
      <Settings />
    </div>
  );
}
