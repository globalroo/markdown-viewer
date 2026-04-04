import { create } from "zustand";

export type ThemeId =
  | "system"
  | "light"
  | "dark"
  | "aurora"
  | "prism"
  | "solstice"
  | "ember"
  | "lagoon"
  | "dusk"
  | "stark-light"
  | "stark-dark"
  | "clarity"
  | "terrain"
  | "sapphire";

export type FontId =
  | "system"
  | "humanist"
  | "geometric"
  | "serif"
  | "modern-serif"
  | "mono";

export interface ThemeOption {
  id: ThemeId;
  name: string;
  group: "core" | "colour" | "accessibility";
}

export const THEMES: ThemeOption[] = [
  { id: "system", name: "System", group: "core" },
  { id: "light", name: "Light", group: "core" },
  { id: "dark", name: "Dark", group: "core" },
  { id: "aurora", name: "Aurora", group: "colour" },
  { id: "prism", name: "Prism", group: "colour" },
  { id: "solstice", name: "Solstice", group: "colour" },
  { id: "ember", name: "Ember", group: "colour" },
  { id: "lagoon", name: "Lagoon", group: "colour" },
  { id: "dusk", name: "Dusk", group: "colour" },
  { id: "stark-light", name: "Stark Light", group: "accessibility" },
  { id: "stark-dark", name: "Stark Dark", group: "accessibility" },
  { id: "clarity", name: "Clarity", group: "accessibility" },
  { id: "terrain", name: "Terrain", group: "accessibility" },
  { id: "sapphire", name: "Sapphire", group: "accessibility" },
];

export interface FontOption {
  id: FontId;
  name: string;
  description: string;
}

export const FONTS: FontOption[] = [
  { id: "system", name: "System Default", description: "Platform native" },
  { id: "humanist", name: "Humanist", description: "Verdana — highly readable" },
  { id: "geometric", name: "Geometric", description: "Avenir — clean, modern" },
  { id: "serif", name: "Classic Serif", description: "Georgia — traditional" },
  { id: "modern-serif", name: "Modern Serif", description: "Charter — editorial" },
  { id: "mono", name: "Monospace", description: "SF Mono — technical" },
];

interface Project {
  id: string;
  rootPath: string;
  name: string;
  tree: TreeNode[];
  isExpanded: boolean;
}

interface AppState {
  projects: Project[];
  expandedDirs: Set<string>;
  selectedFile: string | null;
  markdownContent: string;
  searchQuery: string;
  fontSize: number;
  theme: ThemeId;
  font: FontId;
  sidebarVisible: boolean;
  settingsOpen: boolean;

  // Edit mode state
  editMode: boolean;
  editContent: string;
  editDirty: boolean;
  editFilePath: string | null; // the file this draft belongs to

  // Rename state
  renamingPath: string | null;

  addProject: (rootPath: string, tree: TreeNode[]) => void;
  removeProject: (id: string) => void;
  toggleProject: (id: string) => void;
  toggleDir: (dirPath: string) => void;
  selectFile: (filePath: string) => void;
  setMarkdownContent: (content: string) => void;
  setSearchQuery: (query: string) => void;
  increaseFontSize: () => void;
  decreaseFontSize: () => void;
  resetFontSize: () => void;
  setTheme: (theme: ThemeId) => void;
  toggleTheme: () => void;
  setFont: (font: FontId) => void;
  toggleSidebar: () => void;
  toggleSettings: () => void;

  // Edit mode actions
  setEditMode: (mode: boolean) => void;
  setEditContent: (content: string) => void;
  setEditDirty: (dirty: boolean) => void;

  // Rename action
  setRenamingPath: (path: string | null) => void;

  // Tree mutation after rename/move
  updateProjectTree: (projectId: string, tree: TreeNode[], oldPath?: string, newPath?: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  projects: [],
  expandedDirs: new Set<string>(),
  selectedFile: null,
  markdownContent: "",
  searchQuery: "",
  fontSize: 16,
  theme: "system",
  font: "system",
  sidebarVisible: true,
  settingsOpen: false,
  editMode: false,
  editContent: "",
  editDirty: false,
  editFilePath: null,
  renamingPath: null,

  addProject: (rootPath, tree) =>
    set((state) => {
      if (state.projects.some((p) => p.rootPath === rootPath)) return state;
      const name = rootPath.split(/[/\\]/).pop() || rootPath;
      const project: Project = {
        id: rootPath,
        rootPath,
        name,
        tree,
        isExpanded: true,
      };
      return { projects: [...state.projects, project] };
    }),

  removeProject: (id) =>
    set((state) => {
      const removed = state.projects.find((p) => p.id === id);
      if (removed) {
        window.api.removeRoot(removed.rootPath);
      }
      const projects = state.projects.filter((p) => p.id !== id);
      const selectedFile =
        state.selectedFile && state.selectedFile.startsWith(id)
          ? null
          : state.selectedFile;
      return {
        projects,
        selectedFile,
        markdownContent: selectedFile ? state.markdownContent : "",
      };
    }),

  toggleProject: (id) =>
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, isExpanded: !p.isExpanded } : p
      ),
    })),

  toggleDir: (dirPath) =>
    set((state) => {
      const next = new Set(state.expandedDirs);
      if (next.has(dirPath)) {
        next.delete(dirPath);
      } else {
        next.add(dirPath);
      }
      return { expandedDirs: next };
    }),

  selectFile: (filePath) => set({ selectedFile: filePath }),

  setMarkdownContent: (content) => set({ markdownContent: content }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  increaseFontSize: () =>
    set((state) => ({ fontSize: Math.min(state.fontSize + 2, 32) })),

  decreaseFontSize: () =>
    set((state) => ({ fontSize: Math.max(state.fontSize - 2, 10) })),

  resetFontSize: () => set({ fontSize: 16 }),

  setTheme: (theme) => set({ theme }),

  toggleTheme: () =>
    set((state) => {
      const quick: ThemeId[] = ["system", "light", "dark"];
      const idx = quick.indexOf(state.theme);
      if (idx >= 0) return { theme: quick[(idx + 1) % quick.length] };
      return { theme: "system" };
    }),

  setFont: (font) => set({ font }),

  toggleSidebar: () =>
    set((state) => ({ sidebarVisible: !state.sidebarVisible })),

  toggleSettings: () =>
    set((state) => ({ settingsOpen: !state.settingsOpen })),

  setEditMode: (mode) =>
    set((state) => {
      if (mode) {
        // Preserve draft if dirty AND belongs to the current file
        if (state.editDirty && state.editFilePath === state.selectedFile) {
          return { editMode: true };
        }
        return {
          editMode: true,
          editContent: state.markdownContent,
          editDirty: false,
          editFilePath: state.selectedFile,
        };
      }
      return { editMode: false };
    }),

  setEditContent: (content) =>
    set((state) => ({
      editContent: content,
      editDirty: content !== state.markdownContent,
      editFilePath: state.selectedFile,
    })),

  setEditDirty: (dirty) => set({ editDirty: dirty }),

  setRenamingPath: (path) => set({ renamingPath: path }),

  updateProjectTree: (projectId, tree, oldPath, newPath) =>
    set((state) => {
      const projects = state.projects.map((p) =>
        p.id === projectId ? { ...p, tree } : p
      );

      let selectedFile = state.selectedFile;
      let expandedDirs = state.expandedDirs;

      const hasPrefix = (p: string, base: string) =>
        p.startsWith(base + "/") || p.startsWith(base + "\\");

      // Update paths if a rename/move changed them
      if (oldPath && newPath) {
        if (selectedFile === oldPath) {
          selectedFile = newPath;
        } else if (selectedFile && hasPrefix(selectedFile, oldPath)) {
          selectedFile = newPath + selectedFile.slice(oldPath.length);
        }

        const nextDirs = new Set<string>();
        for (const dir of expandedDirs) {
          if (dir === oldPath) {
            nextDirs.add(newPath);
          } else if (hasPrefix(dir, oldPath)) {
            nextDirs.add(newPath + dir.slice(oldPath.length));
          } else {
            nextDirs.add(dir);
          }
        }
        expandedDirs = nextDirs;
      }

      // Also rewrite editFilePath if it matches the old path
      let editFilePath = state.editFilePath;
      if (oldPath && newPath && editFilePath) {
        if (editFilePath === oldPath) {
          editFilePath = newPath;
        } else if (hasPrefix(editFilePath, oldPath)) {
          editFilePath = newPath + editFilePath.slice(oldPath.length);
        }
      }

      return { projects, selectedFile, expandedDirs, editFilePath };
    }),
}));
