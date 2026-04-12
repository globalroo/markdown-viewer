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
import { embedLocalImages } from "./embedLocalImages";
import {
  type LinkIndexState,
  buildLinkIndex,
  updateLinkIndexForFile,
  removeFileFromIndex,
  getLinkGraph,
  getConnectedPaths,
} from "./linkIndex";

let mainWindow: BrowserWindow | null = null;
let pendingFilePath: string | null = null;

// --- User config persistence (custom CSS path, etc.) ---
function getConfigPath(): string {
  return path.join(app.getPath("userData"), "user-config.json");
}

interface UserConfig {
  customCSSPath?: string | null;
}

function readConfig(): UserConfig {
  try {
    const raw = fs.readFileSync(getConfigPath(), "utf-8");
    return JSON.parse(raw) as UserConfig;
  } catch {
    return {};
  }
}

/** Atomic JSON write: write to tmp then rename (prevents corruption on crash) */
function atomicWriteJson(filePath: string, data: unknown): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = filePath + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(tmp, filePath);
}

function writeConfig(config: UserConfig): void {
  atomicWriteJson(getConfigPath(), config);
}

// --- Fold state persistence ---
interface FoldStateEntry {
  headingIds: Record<string, boolean>;
  lastAccessed: number;
}

interface FoldStateStore {
  entries: Record<string, FoldStateEntry>;
}

const FOLD_STATE_MAX_ENTRIES = 300;

function getFoldStatePath(): string {
  return path.join(app.getPath("userData"), "fold-state.json");
}

let foldStateCache: FoldStateStore | null = null;
let foldStateDirty = false;
let foldStateTimer: ReturnType<typeof setTimeout> | null = null;

function loadFoldStateStore(): FoldStateStore {
  if (foldStateCache) return foldStateCache;
  try {
    const raw = fs.readFileSync(getFoldStatePath(), "utf-8");
    foldStateCache = JSON.parse(raw) as FoldStateStore;
    if (!foldStateCache.entries) foldStateCache.entries = {};
  } catch {
    foldStateCache = { entries: {} };
  }
  return foldStateCache;
}

function scheduleFoldStateWrite(): void {
  if (foldStateTimer) return;
  foldStateTimer = setTimeout(() => {
    foldStateTimer = null;
    flushFoldState();
  }, 2000);
}

function flushFoldState(): void {
  if (!foldStateDirty || !foldStateCache) return;
  // LRU eviction
  const keys = Object.keys(foldStateCache.entries);
  if (keys.length > FOLD_STATE_MAX_ENTRIES) {
    const sorted = keys.sort(
      (a, b) => (foldStateCache!.entries[a].lastAccessed || 0) - (foldStateCache!.entries[b].lastAccessed || 0)
    );
    const toRemove = sorted.slice(0, keys.length - FOLD_STATE_MAX_ENTRIES);
    for (const k of toRemove) delete foldStateCache.entries[k];
  }
  try {
    atomicWriteJson(getFoldStatePath(), foldStateCache);
    foldStateDirty = false;
  } catch {
    // Keep foldStateDirty = true and re-arm the timer so next flush retries
    scheduleFoldStateWrite();
  }
}

// --- Link index ---
let linkIndex: LinkIndexState | null = null;

function rebuildLinkIndex(): void {
  const roots = Array.from(allowedRoots);
  if (roots.length === 0) {
    linkIndex = null;
    return;
  }
  linkIndex = buildLinkIndex(roots, collectMarkdownFiles, allowedRoots);
}

function notifyLinkGraphChanged(affectedPaths: Set<string>): void {
  if (!mainWindow || affectedPaths.size === 0) return;
  mainWindow.webContents.send("link-graph-changed", Array.from(affectedPaths));
}

// --- Last-viewed tracking (for stale link detection) ---
const lastViewed = new Map<string, number>();

// Track allowed project roots for IPC path validation
const allowedRoots = new Set<string>();

// --- File watching ---
// Track active fs.watch watchers per project root
const activeWatchers = new Map<string, fs.FSWatcher>();

// Directories to skip when watching (same set used by scanDirectory)
const SKIP_DIRS = new Set([
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

// Debounce timers keyed by event type + path
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

function debounced(key: string, delayMs: number, fn: () => void): void {
  const existing = debounceTimers.get(key);
  if (existing) clearTimeout(existing);
  debounceTimers.set(
    key,
    setTimeout(() => {
      debounceTimers.delete(key);
      fn();
    }, delayMs)
  );
}

function startWatching(rootPath: string): void {
  // Don't double-watch the same root
  if (activeWatchers.has(rootPath)) return;

  // fs.watch with { recursive: true } is only supported on macOS and Windows.
  // On Linux it throws or silently ignores subdirectories.
  if (process.platform === "linux") return;

  let watcher: fs.FSWatcher;
  try {
    watcher = fs.watch(rootPath, { recursive: true }, (eventType, filename) => {
      if (!filename || !mainWindow) return;

      // Normalise path separators on Windows
      const relativePath = filename.replace(/\\/g, "/");
      const segments = relativePath.split("/");

      // Skip events inside ignored directories
      if (segments.some((seg) => SKIP_DIRS.has(seg) || (seg.startsWith(".") && seg !== ".github"))) {
        return;
      }

      const fullPath = path.join(rootPath, filename);
      const isMarkdown = /\.(md|markdown|mdown|mkd|mkdn)$/i.test(filename);

      if (eventType === "rename") {
        // A file/directory was added, removed, or renamed — refresh tree + link index
        debounced(`tree:${rootPath}`, 150, () => {
          if (!mainWindow) return;
          try {
            const tree = scanDirectory(rootPath);
            mainWindow.webContents.send("tree-changed", rootPath, tree);
            // Rebuild link index for this root (new/removed files change the graph)
            rebuildLinkIndex();
            notifyLinkGraphChanged(new Set(["*"])); // broad notification
          } catch {
            // Directory may have been removed
          }
        });
      }

      if (eventType === "change" && isMarkdown) {
        // File content changed — notify renderer and update link index
        debounced(`file:${fullPath}`, 150, () => {
          if (!mainWindow) return;
          try {
            const content = readFileContent(fullPath);
            mainWindow.webContents.send("file-changed", fullPath, content);
            if (linkIndex) {
              const affected = updateLinkIndexForFile(linkIndex, fullPath, content);
              notifyLinkGraphChanged(affected);
            }
          } catch {
            // File may have been deleted between event and read
          }
        });
      }

      // A rename of a markdown file also means its content should reload if selected
      if (eventType === "rename" && isMarkdown) {
        debounced(`file:${fullPath}`, 200, () => {
          if (!mainWindow) return;
          try {
            fs.statSync(fullPath); // check file still exists
            const content = readFileContent(fullPath);
            mainWindow.webContents.send("file-changed", fullPath, content);
          } catch {
            // File was removed — tree-changed already covers this
          }
        });
      }
    });
  } catch {
    // fs.watch may fail on some filesystems — degrade gracefully
    return;
  }

  activeWatchers.set(rootPath, watcher);

  // Handle watcher errors (e.g. directory deleted)
  watcher.on("error", () => {
    stopWatching(rootPath);
  });
}

function stopWatching(rootPath: string): void {
  const watcher = activeWatchers.get(rootPath);
  if (watcher) {
    watcher.close();
    activeWatchers.delete(rootPath);
  }
  // Clean up any pending debounce timers for this root
  for (const [key, timer] of debounceTimers) {
    if (key.startsWith(`tree:${rootPath}`) || key.startsWith(`file:${rootPath}`)) {
      clearTimeout(timer);
      debounceTimers.delete(key);
    }
  }
}

function stopAllWatchers(): void {
  for (const [rootPath] of activeWatchers) {
    stopWatching(rootPath);
  }
}

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
    if (resolved === root) return true;
    const prefix = root.endsWith(path.sep) ? root : root + path.sep;
    if (resolved.startsWith(prefix)) return true;
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

// Validation helpers for mutating operations
const MARKDOWN_EXTENSIONS = /\.(md|markdown|mdown|mkd|mkdn)$/i;
const RESERVED_WINDOWS_NAMES = /^(CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])(\.|$)/i;

function validateFileName(name: string): void {
  if (!name || !name.trim()) throw new Error("Filename cannot be empty");
  if (/[/\\]/.test(name)) throw new Error("Filename cannot contain path separators");
  if (name.includes("..")) throw new Error("Invalid filename");
  if (name.startsWith(".")) throw new Error("Filename cannot start with a dot");
  if (/[.\s]$/.test(name)) throw new Error("Filename cannot end with a dot or space");
  if (RESERVED_WINDOWS_NAMES.test(name)) throw new Error("Reserved filename");
  if (!MARKDOWN_EXTENSIONS.test(name)) throw new Error("File must have a markdown extension (.md, .markdown, etc.)");
}

function removeAllowedRoot(dirPath: string): void {
  try {
    allowedRoots.delete(fs.realpathSync(dirPath));
  } catch {
    allowedRoots.delete(path.resolve(dirPath));
  }
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
  startWatching(dirPath);
  // Build/rebuild link index in background (non-blocking)
  setTimeout(() => {
    rebuildLinkIndex();
    notifyLinkGraphChanged(new Set(["*"]));
  }, 0);
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
    lastViewed.set(path.normalize(filePath), Date.now());
    return readFileContent(filePath);
  }
);

ipcMain.handle("show-in-folder", async (_event, filePath: string) => {
  if (!isPathAllowed(filePath)) throw new Error("Access denied");
  shell.showItemInFolder(filePath);
});

ipcMain.handle(
  "rename-file",
  async (_event, oldPath: string, newName: string): Promise<{ newPath: string }> => {
    if (!isPathAllowed(oldPath)) throw new Error("Access denied");
    if (!MARKDOWN_EXTENSIONS.test(oldPath)) throw new Error("Can only rename markdown files");
    validateFileName(newName);

    const dir = path.dirname(oldPath);
    const newPath = path.join(dir, newName);

    // Allow case-only renames on case-insensitive filesystems
    if (fs.existsSync(newPath)) {
      try {
        const srcStat = fs.statSync(oldPath);
        const dstStat = fs.statSync(newPath);
        if (srcStat.ino !== dstStat.ino) {
          throw new Error("A file with that name already exists");
        }
      } catch (e: unknown) {
        if (e instanceof Error && e.message === "A file with that name already exists") throw e;
        // If stat fails, fall through to the rename attempt
      }
    }

    fs.renameSync(oldPath, newPath);
    // Update link index: remove old, index new, THEN refresh backers
    // (backers must be re-parsed after the new path is in filenameLookup)
    if (linkIndex) {
      const backers = Array.from(linkIndex.backLinks.get(oldPath) || []);
      const affected = removeFileFromIndex(linkIndex, oldPath);
      try {
        const content = fs.readFileSync(newPath, "utf-8");
        const affected2 = updateLinkIndexForFile(linkIndex, newPath, content);
        for (const p of affected2) affected.add(p);
      } catch { /* ignore */ }
      // Now refresh backers — new path is in lookup, so wiki-links resolve correctly
      for (const backer of backers) {
        try {
          const content = fs.readFileSync(backer, "utf-8");
          const a = updateLinkIndexForFile(linkIndex, backer, content);
          for (const p of a) affected.add(p);
        } catch { /* ignore */ }
      }
      notifyLinkGraphChanged(affected);
    }
    return { newPath };
  }
);

ipcMain.handle(
  "move-file",
  async (_event, sourcePath: string, destDir: string): Promise<{ newPath: string }> => {
    if (!isPathAllowed(sourcePath)) throw new Error("Access denied: source");
    if (!isPathAllowed(destDir)) throw new Error("Access denied: destination");
    if (!MARKDOWN_EXTENSIONS.test(sourcePath)) throw new Error("Can only move markdown files");

    const fileName = path.basename(sourcePath);
    const newPath = path.join(destDir, fileName);

    if (path.dirname(sourcePath) === path.resolve(destDir)) {
      throw new Error("File is already in this directory");
    }

    if (fs.existsSync(newPath)) {
      throw new Error("A file with that name already exists in the destination");
    }

    try {
      fs.renameSync(sourcePath, newPath);
    } catch (err: unknown) {
      // EXDEV: cross-device move — atomic copy+delete fallback
      if (err && typeof err === "object" && "code" in err && err.code === "EXDEV") {
        const tmpPath = newPath + ".tmp";
        fs.copyFileSync(sourcePath, tmpPath);
        fs.renameSync(tmpPath, newPath);
        fs.unlinkSync(sourcePath);
      } else {
        throw err;
      }
    }

    // Update link index: remove old, index new, THEN refresh backers
    if (linkIndex) {
      const backers = Array.from(linkIndex.backLinks.get(sourcePath) || []);
      const affected = removeFileFromIndex(linkIndex, sourcePath);
      try {
        const content = fs.readFileSync(newPath, "utf-8");
        const affected2 = updateLinkIndexForFile(linkIndex, newPath, content);
        for (const p of affected2) affected.add(p);
      } catch { /* ignore */ }
      for (const backer of backers) {
        try {
          const content = fs.readFileSync(backer, "utf-8");
          const a = updateLinkIndexForFile(linkIndex, backer, content);
          for (const p of a) affected.add(p);
        } catch { /* ignore */ }
      }
      notifyLinkGraphChanged(affected);
    }
    return { newPath };
  }
);

ipcMain.handle(
  "write-file",
  async (_event, filePath: string, content: string): Promise<void> => {
    if (!isPathAllowed(filePath)) throw new Error("Access denied");
    if (!MARKDOWN_EXTENSIONS.test(filePath)) {
      throw new Error("Can only write markdown files");
    }
    fs.writeFileSync(filePath, content, "utf-8");
    // Update lastViewed so the file doesn't appear stale to its backers
    lastViewed.set(path.normalize(filePath), Date.now());
    // Update link index (also serves as Linux fallback since fs.watch is disabled there)
    if (linkIndex) {
      const affected = updateLinkIndexForFile(linkIndex, filePath, content);
      notifyLinkGraphChanged(affected);
    }
  }
);

ipcMain.handle("remove-root", async (_event, rootPath: string) => {
  stopWatching(rootPath);
  removeAllowedRoot(rootPath);
  // Rebuild link index without the removed root
  rebuildLinkIndex();
  notifyLinkGraphChanged(new Set(["*"]));
});

// Content search across all markdown files in given roots
interface SearchResult {
  filePath: string;
  line: number;
  text: string;
}

function collectMarkdownFiles(dirPath: string): string[] {
  const results: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".github") continue;
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      results.push(...collectMarkdownFiles(fullPath));
    } else if (
      entry.isFile() &&
      /\.(md|markdown|mdown|mkd|mkdn)$/i.test(entry.name)
    ) {
      results.push(fullPath);
    }
  }
  return results;
}

function searchFileContent(
  filePath: string,
  queryLower: string,
  results: SearchResult[],
  limit: number
): void {
  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    return;
  }
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (results.length >= limit) return;
    if (lines[i].toLowerCase().includes(queryLower)) {
      results.push({
        filePath,
        line: i + 1,
        text: lines[i],
      });
    }
  }
}

ipcMain.handle(
  "search-content",
  async (
    _event,
    query: string,
    roots: string[]
  ): Promise<SearchResult[]> => {
    if (!query || query.trim().length === 0) return [];
    const queryLower = query.toLowerCase();
    const limit = 100;
    const results: SearchResult[] = [];

    for (const root of roots) {
      if (!isPathAllowed(root)) continue;
      try {
        const files = collectMarkdownFiles(root);
        for (const filePath of files) {
          if (results.length >= limit) break;
          searchFileContent(filePath, queryLower, results, limit);
        }
      } catch {
        // Root may no longer exist
      }
      if (results.length >= limit) break;
    }

    return results;
  }
);

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Export handlers
ipcMain.handle(
  "export-html",
  async (_event, html: string, cssContent: string, theme?: string, font?: string, rootStyle?: string, warmFilter?: boolean): Promise<void> => {
    const result = await dialog.showSaveDialog({
      defaultPath: "document.html",
      filters: [{ name: "HTML", extensions: ["html"] }],
    });
    if (result.canceled || !result.filePath) return;
    const themeAttr = theme ? ` data-theme="${escapeAttr(theme)}"` : "";
    const fontAttr = font ? ` data-font="${escapeAttr(font)}"` : "";
    const styleAttr = rootStyle ? ` style="${escapeAttr(rootStyle)}"` : "";
    const warmClass = warmFilter ? ` class="warm-filter"` : "";
    const doc = `<!DOCTYPE html>
<html lang="en"${themeAttr}${fontAttr}${styleAttr}${warmClass}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Exported Document</title>
<style>${cssContent}</style>
<style>/* Standalone override — undo app-layout scroll constraints */
html, body { height: auto !important; overflow: auto !important; }</style>
</head>
<body>
<div class="preview-content">${html}</div>
</body>
</html>`;
    fs.writeFileSync(result.filePath, embedLocalImages(doc, isPathAllowed), "utf-8");
  }
);

ipcMain.handle("export-pdf", async (): Promise<void> => {
  if (!mainWindow) return;
  const result = await dialog.showSaveDialog({
    defaultPath: "document.pdf",
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (result.canceled || !result.filePath) return;
  // Add pdf-export class to suppress ::after URL display (links are clickable in PDFs)
  await mainWindow.webContents.executeJavaScript(
    'document.documentElement.classList.add("pdf-export")'
  );
  try {
    const pdfData = await mainWindow.webContents.printToPDF({
      printBackground: true,
      margins: { marginType: "default" },
    });
    fs.writeFileSync(result.filePath, pdfData);
  } finally {
    await mainWindow.webContents.executeJavaScript(
      'document.documentElement.classList.remove("pdf-export")'
    );
  }
});

ipcMain.handle(
  "export-docx",
  async (_event, html: string, cssContent: string, theme?: string, font?: string, rootStyle?: string, warmFilter?: boolean): Promise<void> => {
    const result = await dialog.showSaveDialog({
      defaultPath: "document.docx",
      filters: [{ name: "Word Document", extensions: ["docx"] }],
    });
    if (result.canceled || !result.filePath) return;
    const themeAttr = theme ? ` data-theme="${escapeAttr(theme)}"` : "";
    const fontAttr = font ? ` data-font="${escapeAttr(font)}"` : "";
    const styleAttr = rootStyle ? ` style="${escapeAttr(rootStyle)}"` : "";
    const warmClass = warmFilter ? ` class="warm-filter"` : "";
    const fullHtml = `<!DOCTYPE html>
<html lang="en"${themeAttr}${fontAttr}${styleAttr}${warmClass}>
<head>
<meta charset="utf-8">
<style>${cssContent}</style>
</head>
<body>
<div class="preview-content">${html}</div>
</body>
</html>`;
    const embeddedHtml = embedLocalImages(fullHtml, isPathAllowed);
    const htmlDocxModule = await import("html-docx-js");
    const htmlDocx = htmlDocxModule.default || htmlDocxModule;
    const docxResult = htmlDocx.asBlob(embeddedHtml);
    // html-docx-js returns Buffer in Node, Blob in browser — handle both
    let bytes: Buffer;
    if (Buffer.isBuffer(docxResult)) {
      bytes = docxResult;
    } else if (docxResult instanceof Blob) {
      const arrayBuf = await docxResult.arrayBuffer();
      bytes = Buffer.from(arrayBuf);
    } else {
      bytes = Buffer.from(docxResult as ArrayBuffer);
    }
    fs.writeFileSync(result.filePath, bytes);
  }
);

// Return the initial CLI path so the renderer can request it after mount
let initialPathForRenderer: string | null = null;

ipcMain.handle("get-initial-path", async () => {
  const result = initialPathForRenderer;
  initialPathForRenderer = null; // consume once
  return result;
});

// --- Custom CSS IPC handlers ---

ipcMain.handle("load-custom-css", async (): Promise<{ path: string; content: string } | null> => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "CSS Stylesheets", extensions: ["css"] }],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const cssPath = result.filePaths[0];
  const content = fs.readFileSync(cssPath, "utf-8");
  const config = readConfig();
  config.customCSSPath = cssPath;
  writeConfig(config);
  return { path: cssPath, content };
});

ipcMain.handle("get-custom-css", async (): Promise<{ path: string; content: string } | null> => {
  const config = readConfig();
  if (!config.customCSSPath) return null;
  try {
    const content = fs.readFileSync(config.customCSSPath, "utf-8");
    return { path: config.customCSSPath, content };
  } catch {
    // File no longer exists — clear the saved path
    config.customCSSPath = null;
    writeConfig(config);
    return null;
  }
});

ipcMain.handle("clear-custom-css", async (): Promise<void> => {
  const config = readConfig();
  config.customCSSPath = null;
  writeConfig(config);
});

// --- Fold state IPC handlers ---
ipcMain.handle("fold-state:load", async (_event, filePath: string): Promise<Record<string, boolean> | null> => {
  const store = loadFoldStateStore();
  const normalized = path.normalize(filePath);
  const entry = store.entries[normalized];
  if (!entry) return null;
  entry.lastAccessed = Date.now();
  foldStateDirty = true;
  scheduleFoldStateWrite();
  return entry.headingIds;
});

ipcMain.handle("fold-state:save", async (_event, filePath: string, headingIds: Record<string, boolean>): Promise<void> => {
  const store = loadFoldStateStore();
  const normalized = path.normalize(filePath);
  store.entries[normalized] = { headingIds, lastAccessed: Date.now() };
  foldStateDirty = true;
  scheduleFoldStateWrite();
});

// --- Link graph IPC handlers ---
ipcMain.handle("get-link-graph", async (_event, filePath: string) => {
  if (!isPathAllowed(filePath)) throw new Error("Access denied");
  if (!linkIndex) return null;
  const graph = getLinkGraph(linkIndex, path.normalize(filePath));
  // Annotate with stale status: target was modified after user last viewed it
  const staleTargets: Record<string, boolean> = {};
  for (const target of graph.outgoing) {
    const status = graph.outgoingStatus[target];
    if (status?.exists && status.lastModified) {
      const viewedAt = lastViewed.get(target);
      staleTargets[target] = viewedAt ? status.lastModified > viewedAt : false;
    }
  }
  return { ...graph, staleTargets };
});

ipcMain.handle("get-connected-paths", async (_event, filePath: string, hops: number) => {
  if (!isPathAllowed(filePath)) throw new Error("Access denied");
  if (!linkIndex) return [];
  return getConnectedPaths(linkIndex, path.normalize(filePath), hops);
});

// Find the first real file/directory path in an argv slice, skipping Chromium flags.
// cwd overrides path.resolve base for relative args (used by second-instance).
function findPathArg(args: string[], cwd?: string): string | null {
  for (const arg of args) {
    // Skip Chromium flags (--flag=value) but not filenames that start with -
    if (arg.startsWith("--")) continue;
    const target = cwd ? path.resolve(cwd, arg) : path.resolve(arg);
    try {
      const stat = fs.statSync(target);
      if (stat.isDirectory() || stat.isFile()) return target;
    } catch {
      // not a valid path — try next arg
    }
  }
  return null;
}

// Handle CLI arguments — accept a directory or file path
function getInitialPath(): string | null {
  const args = process.argv.slice(app.isPackaged ? 1 : 2);
  return findPathArg(args);
}

// Handle file opened via file association (macOS)
// Buffer the path if the window isn't ready yet (cold launch)
app.on("open-file", (_event, filePath) => {
  if (mainWindow) {
    // Add parent directory to allowed roots so scan-directory works
    const dirPath = path.dirname(filePath);
    addAllowedRoot(dirPath);
    startWatching(dirPath);
    setTimeout(() => { rebuildLinkIndex(); notifyLinkGraphChanged(new Set(["*"])); }, 0);
    mainWindow.webContents.send("file-opened", filePath);
  } else {
    pendingFilePath = filePath;
  }
});

// Register custom protocol for secure local image loading
// Images are rewritten to local-img:///<absolute-path> in the renderer,
// and this handler validates against allowedRoots before serving.
protocol.registerSchemesAsPrivileged([
  { scheme: "local-img", privileges: { bypassCSP: false, supportFetchAPI: true, stream: true } },
]);

// Single instance lock — forward args from second launch to existing window
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv, workingDirectory) => {
    // argv: [electron, main.js, ...userArgs] when packaged: [binary, ...userArgs]
    // Chromium may inject flags like --original-process-start-time, so find the first real path.
    // Resolve relative paths against the second instance's working directory, not ours.
    const args = argv.slice(app.isPackaged ? 1 : 2);
    const target = findPathArg(args, workingDirectory);
    if (target && mainWindow) {
      try {
        const stat = fs.statSync(target);
        const dirPath = stat.isDirectory() ? target : path.dirname(target);
        addAllowedRoot(dirPath);
        startWatching(dirPath);
        setTimeout(() => { rebuildLinkIndex(); notifyLinkGraphChanged(new Set(["*"])); }, 0);
        if (stat.isDirectory()) {
          mainWindow.webContents.send("open-directory", target);
        } else {
          mainWindow.webContents.send("file-opened", target);
        }
      } catch {
        // invalid path — ignore
      }
    }
    // Bring existing window to front
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

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
  if (initialPath) {
    // Store for pull-based retrieval by the renderer after mount
    initialPathForRenderer = initialPath;
    // Also add to allowed roots immediately so scan-directory works
    try {
      const stat = fs.statSync(initialPath);
      const dirPath = stat.isDirectory() ? initialPath : path.dirname(initialPath);
      addAllowedRoot(dirPath);
      startWatching(dirPath);
      setTimeout(() => { rebuildLinkIndex(); notifyLinkGraphChanged(new Set(["*"])); }, 0);
    } catch {
      // ignore
    }
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  stopAllWatchers();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  stopAllWatchers();
  flushFoldState();
});
