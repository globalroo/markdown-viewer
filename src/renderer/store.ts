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
  | "sapphire"
  | "sepia"
  | "sage"
  | "twilight-reader";

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
  group: "core" | "colour" | "accessibility" | "reading";
}

export const THEMES: ThemeOption[] = [
  { id: "system", name: "System", group: "core" },
  { id: "light", name: "Light", group: "core" },
  { id: "dark", name: "Dark", group: "core" },
  { id: "sepia", name: "Sepia", group: "reading" },
  { id: "sage", name: "Sage", group: "reading" },
  { id: "twilight-reader", name: "Twilight Reader", group: "reading" },
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

interface OpenTab {
  filePath: string;
  scrollPosition: number;
}

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

  // Reading comfort
  contentWidth: "narrow" | "standard" | "wide" | "full";
  lineHeight: "compact" | "optimal" | "relaxed";
  focusMode: boolean;
  warmFilter: boolean;

  // Sidebar layout
  sidebarFontSize: "small" | "medium" | "large";
  sidebarWidth: number;

  // Edit mode state
  editMode: boolean;
  editContent: string;
  editDirty: boolean;
  editFilePath: string | null; // the file this draft belongs to

  // Rename state
  renamingPath: string | null;

  // Document outline
  outlineVisible: boolean;
  outlineWidth: number;

  // Custom CSS
  customCSSPath: string | null;
  customCSSContent: string;

  // Tabs
  openTabs: OpenTab[];
  activeTab: string | null;

  // Style check
  styleCheckEnabled: boolean;

  // Section model (shared by CollapsiblePreview and DocumentOutline)
  sectionModel: import("./utils/sectionModel").SectionModel | null;

  // Preview mode
  previewMode: "standard" | "collapsible";

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

  // Reading comfort actions
  setContentWidth: (width: "narrow" | "standard" | "wide" | "full") => void;
  setLineHeight: (height: "compact" | "optimal" | "relaxed") => void;
  toggleFocusMode: () => void;
  toggleWarmFilter: () => void;

  // Sidebar layout actions
  setSidebarFontSize: (size: "small" | "medium" | "large") => void;
  setSidebarWidth: (width: number) => void;
  resetSidebarWidth: () => void;

  // Edit mode actions
  setEditMode: (mode: boolean) => void;
  setEditContent: (content: string) => void;
  setEditDirty: (dirty: boolean) => void;

  // Rename action
  setRenamingPath: (path: string | null) => void;

  // Document outline actions
  toggleOutline: () => void;
  setOutlineWidth: (width: number) => void;
  resetOutlineWidth: () => void;

  // Custom CSS actions
  setCustomCSS: (path: string | null, content: string) => void;
  clearCustomCSS: () => void;

  // Tab actions
  openTab: (filePath: string) => void;
  closeTab: (filePath: string) => void;
  setTabScrollPosition: (filePath: string, position: number) => void;

  // Style check actions
  toggleStyleCheck: () => void;

  // Section model actions
  setSectionModel: (model: import("./utils/sectionModel").SectionModel | null) => void;

  // Preview mode actions
  setPreviewMode: (mode: "standard" | "collapsible") => void;

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
  contentWidth: "standard",
  lineHeight: "optimal",
  focusMode: false,
  warmFilter: false,
  sidebarFontSize: "medium",
  sidebarWidth: 280,
  editMode: false,
  editContent: "",
  editDirty: false,
  editFilePath: null,
  renamingPath: null,
  outlineVisible: true,
  outlineWidth: 200,
  customCSSPath: null,
  customCSSContent: "",
  openTabs: [],
  activeTab: null,
  styleCheckEnabled: false,
  sectionModel: null,
  previewMode: "standard",

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
      const belongsToProject = (p: string) =>
        p === id || p.startsWith(id + "/") || p.startsWith(id + "\\");
      const selectedFile =
        state.selectedFile && belongsToProject(state.selectedFile)
          ? null
          : state.selectedFile;
      const openTabs = state.openTabs.filter((t) => !belongsToProject(t.filePath));
      let activeTab = state.activeTab;
      if (activeTab && belongsToProject(activeTab)) {
        activeTab = openTabs.length > 0 ? openTabs[0].filePath : null;
      }
      // Clear dirty state if the draft belongs to the removed project
      const editDirty = state.editDirty && state.editFilePath && belongsToProject(state.editFilePath)
        ? false
        : state.editDirty;
      const editFilePath = state.editFilePath && belongsToProject(state.editFilePath)
        ? null
        : state.editFilePath;

      return {
        projects,
        selectedFile: selectedFile ?? activeTab,
        markdownContent: selectedFile ?? activeTab ? state.markdownContent : "",
        openTabs,
        activeTab,
        editDirty,
        editFilePath,
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

  selectFile: (filePath) =>
    set((state) => ({
      selectedFile: filePath,
      activeTab: filePath,
      openTabs: state.openTabs.some((t) => t.filePath === filePath)
        ? state.openTabs
        : [...state.openTabs, { filePath, scrollPosition: 0 }],
    })),

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

  setContentWidth: (width) => set({ contentWidth: width }),

  setLineHeight: (height) => set({ lineHeight: height }),

  toggleFocusMode: () =>
    set((state) => ({ focusMode: !state.focusMode })),

  toggleWarmFilter: () =>
    set((state) => ({ warmFilter: !state.warmFilter })),

  setSidebarFontSize: (size) => set({ sidebarFontSize: size }),

  setSidebarWidth: (width) =>
    set({ sidebarWidth: Math.min(500, Math.max(180, width)) }),

  resetSidebarWidth: () => set({ sidebarWidth: 280 }),

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

  toggleOutline: () =>
    set((state) => ({ outlineVisible: !state.outlineVisible })),

  setOutlineWidth: (width) =>
    set({ outlineWidth: Math.min(400, Math.max(160, width)) }),

  resetOutlineWidth: () => set({ outlineWidth: 200 }),

  setCustomCSS: (path, content) =>
    set({ customCSSPath: path, customCSSContent: content }),

  clearCustomCSS: () =>
    set({ customCSSPath: null, customCSSContent: "" }),

  openTab: (filePath) =>
    set((state) => ({
      activeTab: filePath,
      selectedFile: filePath,
      openTabs: state.openTabs.some((t) => t.filePath === filePath)
        ? state.openTabs
        : [...state.openTabs, { filePath, scrollPosition: 0 }],
    })),

  closeTab: (filePath) =>
    set((state) => {
      const idx = state.openTabs.findIndex((t) => t.filePath === filePath);
      if (idx === -1) return state;
      const openTabs = state.openTabs.filter((t) => t.filePath !== filePath);
      let activeTab = state.activeTab;
      let selectedFile = state.selectedFile;
      if (state.activeTab === filePath) {
        if (openTabs.length === 0) {
          activeTab = null;
          selectedFile = null;
        } else {
          activeTab = openTabs[Math.min(idx, openTabs.length - 1)].filePath;
          selectedFile = activeTab;
        }
      }
      // If the closed tab had a dirty draft, clear it to prevent orphaned state
      const editDirty = state.editDirty && state.editFilePath === filePath
        ? false
        : state.editDirty;
      const editFilePath = state.editFilePath === filePath ? null : state.editFilePath;

      return {
        openTabs,
        activeTab,
        selectedFile,
        markdownContent: selectedFile ? state.markdownContent : "",
        editDirty,
        editFilePath,
      };
    }),

  setTabScrollPosition: (filePath, position) =>
    set((state) => ({
      openTabs: state.openTabs.map((t) =>
        t.filePath === filePath ? { ...t, scrollPosition: position } : t
      ),
    })),

  toggleStyleCheck: () =>
    set((state) => ({ styleCheckEnabled: !state.styleCheckEnabled })),

  setSectionModel: (model) => set({ sectionModel: model }),

  setPreviewMode: (mode) => set({ previewMode: mode }),

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

      // Remap tabs on rename/move
      let openTabs = state.openTabs;
      let activeTab = state.activeTab;
      if (oldPath && newPath) {
        openTabs = openTabs.map((t) =>
          t.filePath === oldPath
            ? { ...t, filePath: newPath }
            : hasPrefix(t.filePath, oldPath)
              ? { ...t, filePath: newPath + t.filePath.slice(oldPath.length) }
              : t
        );
        if (activeTab === oldPath) {
          activeTab = newPath;
        } else if (activeTab && hasPrefix(activeTab, oldPath)) {
          activeTab = newPath + activeTab.slice(oldPath.length);
        }
      }

      return { projects, selectedFile, expandedDirs, editFilePath, openTabs, activeTab };
    }),
}));
