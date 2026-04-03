import { app, BrowserWindow, ipcMain, dialog, shell } from "electron";
import * as path from "path";
import * as fs from "fs";

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 600,
    minHeight: 400,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// File tree scanning
interface TreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: TreeNode[];
}

function scanDirectory(dirPath: string): TreeNode[] {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const nodes: TreeNode[] = [];

  const skipDirs = new Set([
    "node_modules",
    ".git",
    ".hg",
    ".svn",
    "dist",
    "build",
    ".next",
    "__pycache__",
    ".gestalt",
  ]);

  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".github") continue;

    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) continue;
      const children = scanDirectory(fullPath);
      if (children.length > 0) {
        nodes.push({
          name: entry.name,
          path: fullPath,
          type: "directory",
          children,
        });
      }
    } else if (
      entry.isFile() &&
      /\.(md|markdown|mdown|mkd|mkdn)$/i.test(entry.name)
    ) {
      nodes.push({
        name: entry.name,
        path: fullPath,
        type: "file",
      });
    }
  }

  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return nodes;
}

function readFileContent(filePath: string): string {
  return fs.readFileSync(filePath, "utf-8");
}

// IPC handlers
ipcMain.handle("open-folder", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const dirPath = result.filePaths[0];
  const tree = scanDirectory(dirPath);
  return { rootPath: dirPath, tree };
});

ipcMain.handle(
  "scan-directory",
  async (_event, dirPath: string): Promise<TreeNode[]> => {
    return scanDirectory(dirPath);
  }
);

ipcMain.handle(
  "read-file",
  async (_event, filePath: string): Promise<string> => {
    return readFileContent(filePath);
  }
);

ipcMain.handle(
  "resolve-image",
  async (_event, markdownPath: string, imageSrc: string): Promise<string> => {
    if (imageSrc.startsWith("http://") || imageSrc.startsWith("https://")) {
      return imageSrc;
    }
    const dir = path.dirname(markdownPath);
    const resolved = path.resolve(dir, imageSrc);
    if (fs.existsSync(resolved)) {
      return `file://${resolved}`;
    }
    return imageSrc;
  }
);

ipcMain.handle("show-in-folder", async (_event, filePath: string) => {
  shell.showItemInFolder(filePath);
});

// Handle CLI arguments — accept a directory or file path
function getInitialPath(): string | null {
  const args = process.argv.slice(app.isPackaged ? 1 : 2);
  if (args.length === 0) return null;
  const target = path.resolve(args[0]);
  try {
    const stat = fs.statSync(target);
    if (stat.isDirectory()) return target;
    if (stat.isFile()) return target;
  } catch {
    // path doesn't exist
  }
  return null;
}

// Handle file opened via file association
app.on("open-file", (_event, filePath) => {
  if (mainWindow) {
    mainWindow.webContents.send("file-opened", filePath);
  }
});

app.whenReady().then(() => {
  createWindow();

  // Send initial path to renderer once it's ready
  const initialPath = getInitialPath();
  if (initialPath && mainWindow) {
    mainWindow.webContents.on("did-finish-load", () => {
      const stat = fs.statSync(initialPath);
      if (stat.isDirectory()) {
        mainWindow!.webContents.send("open-directory", initialPath);
      } else {
        mainWindow!.webContents.send("file-opened", initialPath);
      }
    });
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
