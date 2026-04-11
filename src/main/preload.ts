import { contextBridge, ipcRenderer } from "electron";

export interface TreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: TreeNode[];
}

export interface OpenFolderResult {
  rootPath: string;
  tree: TreeNode[];
}

export interface SearchResult {
  filePath: string;
  line: number;
  text: string;
}

const api = {
  openFolder: (): Promise<OpenFolderResult | null> =>
    ipcRenderer.invoke("open-folder"),

  scanDirectory: (dirPath: string): Promise<TreeNode[]> =>
    ipcRenderer.invoke("scan-directory", dirPath),

  readFile: (filePath: string): Promise<string> =>
    ipcRenderer.invoke("read-file", filePath),

  showInFolder: (filePath: string): Promise<void> =>
    ipcRenderer.invoke("show-in-folder", filePath),

  renameFile: (oldPath: string, newName: string): Promise<{ newPath: string }> =>
    ipcRenderer.invoke("rename-file", oldPath, newName),

  moveFile: (sourcePath: string, destDir: string): Promise<{ newPath: string }> =>
    ipcRenderer.invoke("move-file", sourcePath, destDir),

  writeFile: (filePath: string, content: string): Promise<void> =>
    ipcRenderer.invoke("write-file", filePath, content),

  removeRoot: (rootPath: string): Promise<void> =>
    ipcRenderer.invoke("remove-root", rootPath),

  getInitialPath: (): Promise<string | null> =>
    ipcRenderer.invoke("get-initial-path"),

  exportHTML: (html: string, css: string, theme?: string, font?: string, rootStyle?: string, warmFilter?: boolean): Promise<void> =>
    ipcRenderer.invoke("export-html", html, css, theme, font, rootStyle, warmFilter),
  exportPDF: (): Promise<void> =>
    ipcRenderer.invoke("export-pdf"),
  exportDOCX: (html: string, css: string, theme?: string, font?: string, rootStyle?: string, warmFilter?: boolean): Promise<void> =>
    ipcRenderer.invoke("export-docx", html, css, theme, font, rootStyle, warmFilter),

  loadCustomCSS: (): Promise<{ path: string; content: string } | null> =>
    ipcRenderer.invoke("load-custom-css"),

  getCustomCSS: (): Promise<{ path: string; content: string } | null> =>
    ipcRenderer.invoke("get-custom-css"),

  clearCustomCSS: (): Promise<void> =>
    ipcRenderer.invoke("clear-custom-css"),

  searchContent: (query: string, roots: string[]): Promise<SearchResult[]> =>
    ipcRenderer.invoke("search-content", query, roots),

  loadFoldState: (filePath: string): Promise<Record<string, boolean> | null> =>
    ipcRenderer.invoke("fold-state:load", filePath),

  saveFoldState: (filePath: string, state: Record<string, boolean>): Promise<void> =>
    ipcRenderer.invoke("fold-state:save", filePath, state),

  getLinkGraph: (filePath: string) =>
    ipcRenderer.invoke("get-link-graph", filePath),

  getConnectedPaths: (filePath: string, hops: number): Promise<string[]> =>
    ipcRenderer.invoke("get-connected-paths", filePath, hops),

  onLinkGraphChanged: (callback: (affectedPaths: string[]) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, affectedPaths: string[]) =>
      callback(affectedPaths);
    ipcRenderer.on("link-graph-changed", handler);
    return () => ipcRenderer.removeListener("link-graph-changed", handler);
  },

  onFileOpened: (callback: (filePath: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, filePath: string) =>
      callback(filePath);
    ipcRenderer.on("file-opened", handler);
    return () => ipcRenderer.removeListener("file-opened", handler);
  },

  onDirectoryOpened: (callback: (dirPath: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, dirPath: string) =>
      callback(dirPath);
    ipcRenderer.on("open-directory", handler);
    return () => ipcRenderer.removeListener("open-directory", handler);
  },

  onFileChanged: (callback: (filePath: string, content: string) => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      filePath: string,
      content: string
    ) => callback(filePath, content);
    ipcRenderer.on("file-changed", handler);
    return () => ipcRenderer.removeListener("file-changed", handler);
  },

  onTreeChanged: (
    callback: (rootPath: string, tree: TreeNode[]) => void
  ) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      rootPath: string,
      tree: TreeNode[]
    ) => callback(rootPath, tree);
    ipcRenderer.on("tree-changed", handler);
    return () => ipcRenderer.removeListener("tree-changed", handler);
  },
};

contextBridge.exposeInMainWorld("api", api);

export type ElectronAPI = typeof api;
