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

const api = {
  openFolder: (): Promise<OpenFolderResult | null> =>
    ipcRenderer.invoke("open-folder"),

  scanDirectory: (dirPath: string): Promise<TreeNode[]> =>
    ipcRenderer.invoke("scan-directory", dirPath),

  readFile: (filePath: string): Promise<string> =>
    ipcRenderer.invoke("read-file", filePath),

  showInFolder: (filePath: string): Promise<void> =>
    ipcRenderer.invoke("show-in-folder", filePath),

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
};

contextBridge.exposeInMainWorld("api", api);

export type ElectronAPI = typeof api;
