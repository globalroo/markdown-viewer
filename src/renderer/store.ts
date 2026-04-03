import { create } from "zustand";

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
  theme: "light" | "dark" | "system";
  sidebarVisible: boolean;

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
  toggleTheme: () => void;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  projects: [],
  expandedDirs: new Set<string>(),
  selectedFile: null,
  markdownContent: "",
  searchQuery: "",
  fontSize: 16,
  theme: "system",
  sidebarVisible: true,

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

  toggleTheme: () =>
    set((state) => {
      const order: Array<"light" | "dark" | "system"> = [
        "system",
        "light",
        "dark",
      ];
      const idx = order.indexOf(state.theme);
      return { theme: order[(idx + 1) % order.length] };
    }),

  toggleSidebar: () =>
    set((state) => ({ sidebarVisible: !state.sidebarVisible })),
}));
