import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  protocol,
  net,
} from "electron";
import * as path from "path";
import * as fs from "fs";
import { pathToFileURL } from "url";

let mainWindow: BrowserWindow | null = null;
let pendingFilePath: string | null = null;

// Track allowed project roots for IPC path validation
const allowedRoots = new Set<string>();

function addAllowedRoot(dirPath: string): void {
  try {
    allowedRoots.add(fs.realpathSync(dirPath));
  } catch {
    allowedRoots.add(path.resolve(dirPath));
  }
}

function isPathAllowed(targetPath: string): boolean {
  let resolved: string;
  try {
    resolved = fs.realpathSync(targetPath);
  } catch {
    resolved = path.resolve(targetPath);
  }
  for (const root of allowedRoots) {
    if (resolved.startsWith(root + path.sep) || resolved === root) return true;
  }
  return false;
}

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

  // Security: block ALL navigation — this is an SPA, it should never navigate
  mainWindow.webContents.on("will-navigate", (event, url) => {
    event.preventDefault();
    if (url.startsWith("http://") || url.startsWith("https://")) {
      shell.openExternal(url);
    }
  });

  // Security: open new windows (target="_blank" etc) in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
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
  addAllowedRoot(dirPath);
  const tree = scanDirectory(dirPath);
  return { rootPath: dirPath, tree };
});

ipcMain.handle(
  "scan-directory",
  async (_event, dirPath: string): Promise<TreeNode[]> => {
    if (!isPathAllowed(dirPath)) throw new Error("Access denied");
    return scanDirectory(dirPath);
  }
);

ipcMain.handle(
  "read-file",
  async (_event, filePath: string): Promise<string> => {
    if (!isPathAllowed(filePath)) throw new Error("Access denied");
    return readFileContent(filePath);
  }
);

ipcMain.handle("show-in-folder", async (_event, filePath: string) => {
  if (!isPathAllowed(filePath)) throw new Error("Access denied");
  shell.showItemInFolder(filePath);
});

// Handle CLI arguments — accept a directory or file path
function getInitialPath(): string | null {
  const args = process.argv.slice(app.isPackaged ? 1 : 2);
  if (args.length === 0) return null;
  const target = path.resolve(args[0]);
  try {
    const stat = fs.statSync(target);
    if (stat.isDirectory() || stat.isFile()) return target;
  } catch {
    // path doesn't exist
  }
  return null;
}

// Handle file opened via file association (macOS)
// Buffer the path if the window isn't ready yet (cold launch)
app.on("open-file", (_event, filePath) => {
  if (mainWindow) {
    // Add parent directory to allowed roots so scan-directory works
    addAllowedRoot(path.dirname(filePath));
    mainWindow.webContents.send("file-opened", filePath);
  } else {
    pendingFilePath = filePath;
  }
});

function sendInitialPath(targetPath: string): void {
  if (!mainWindow) return;
  try {
    const stat = fs.statSync(targetPath);
    const dirPath = stat.isDirectory()
      ? targetPath
      : path.dirname(targetPath);
    addAllowedRoot(dirPath);
    if (stat.isDirectory()) {
      mainWindow.webContents.send("open-directory", targetPath);
    } else {
      mainWindow.webContents.send("file-opened", targetPath);
    }
  } catch {
    // ignore invalid paths
  }
}

// Register custom protocol for secure local image loading
// Images are rewritten to local-img:///<absolute-path> in the renderer,
// and this handler validates against allowedRoots before serving.
protocol.registerSchemesAsPrivileged([
  { scheme: "local-img", privileges: { bypassCSP: false, supportFetchAPI: true, stream: true } },
]);

app.whenReady().then(() => {
  protocol.handle("local-img", (request) => {
    // URL: local-img:///absolute/path/to/image.png
    let filePath: string;
    try {
      const url = new URL(request.url);
      filePath = decodeURIComponent(url.pathname);
      // On Windows, pathname starts with /C:/... — strip leading slash
      if (process.platform === "win32" && filePath.startsWith("/")) {
        filePath = filePath.slice(1);
      }
    } catch {
      return new Response("Invalid URL", { status: 400 });
    }

    if (!isPathAllowed(filePath)) {
      return new Response("Access denied", { status: 403 });
    }

    try {
      return net.fetch(pathToFileURL(filePath).href);
    } catch {
      return new Response("Not found", { status: 404 });
    }
  });

  createWindow();

  const initialPath = pendingFilePath || getInitialPath();
  if (initialPath && mainWindow) {
    mainWindow.webContents.on("did-finish-load", () => {
      sendInitialPath(initialPath);
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
