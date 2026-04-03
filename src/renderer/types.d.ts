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
  resolveImage: (markdownPath: string, imageSrc: string) => Promise<string>;
  showInFolder: (filePath: string) => Promise<void>;
  onFileOpened: (callback: (filePath: string) => void) => () => void;
  onDirectoryOpened: (callback: (dirPath: string) => void) => () => void;
}

interface Window {
  api: ElectronAPI;
}
