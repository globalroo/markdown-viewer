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

interface SearchResult {
  filePath: string;
  line: number;
  text: string;
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
  exportHTML: (html: string, css: string, theme?: string, font?: string, rootStyle?: string, warmFilter?: boolean) => Promise<void>;
  exportPDF: () => Promise<void>;
  exportDOCX: (html: string, css: string, theme?: string, font?: string, rootStyle?: string, warmFilter?: boolean) => Promise<void>;
  searchContent: (query: string, roots: string[]) => Promise<SearchResult[]>;
  loadCustomCSS: () => Promise<{ path: string; content: string } | null>;
  getCustomCSS: () => Promise<{ path: string; content: string } | null>;
  clearCustomCSS: () => Promise<void>;
  onFileOpened: (callback: (filePath: string) => void) => () => void;
  onDirectoryOpened: (callback: (dirPath: string) => void) => () => void;
  onFileChanged: (callback: (filePath: string, content: string) => void) => () => void;
  onTreeChanged: (callback: (rootPath: string, tree: TreeNode[]) => void) => () => void;
}

interface Window {
  api: ElectronAPI;
}
