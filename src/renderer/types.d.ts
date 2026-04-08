interface TreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: TreeNode[];
}

interface OpenFolderResult {
  rootPath: string;
  tree: TreeNode[];
}

interface ElectronAPI {
  openFolder: () => Promise<OpenFolderResult | null>;
  scanDirectory: (dirPath: string) => Promise<TreeNode[]>;
  readFile: (filePath: string) => Promise<string>;
  showInFolder: (filePath: string) => Promise<void>;
  renameFile: (oldPath: string, newName: string) => Promise<{ newPath: string }>;
  moveFile: (sourcePath: string, destDir: string) => Promise<{ newPath: string }>;
  writeFile: (filePath: string, content: string) => Promise<void>;
  removeRoot: (rootPath: string) => Promise<void>;
  getInitialPath: () => Promise<string | null>;
  onFileOpened: (callback: (filePath: string) => void) => () => void;
  onDirectoryOpened: (callback: (dirPath: string) => void) => () => void;
}

interface Window {
  api: ElectronAPI;
}
