import {
  test,
  expect,
  _electron as electron,
  ElectronApplication,
  Page,
} from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

let app: ElectronApplication;
let page: Page;
let testDir: string;

const readmePath = () => path.join(testDir, "README.md");
const guidePath = () => path.join(testDir, "docs", "guide.md");
const notesPath = () => path.join(testDir, "docs", "notes.md");

test.beforeAll(() => {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), "viewmd-e2e-"));

  fs.writeFileSync(readmePath(), "# Hello World\n\nThis is a test.");
  fs.mkdirSync(path.join(testDir, "docs"));
  fs.writeFileSync(guidePath(), "# Guide\n\nSome guide content.");
  fs.writeFileSync(notesPath(), "# Notes\n\nSome notes.");
});

test.afterAll(() => {
  fs.rmSync(testDir, { recursive: true, force: true });
});

test.beforeEach(async () => {
  app = await electron.launch({ args: ["dist/main/main.js"] });
  page = await app.firstWindow();
  await page.waitForLoadState("domcontentloaded");
  // Auto-dismiss any confirm/beforeunload dialogs
  page.on("dialog", (dialog) => dialog.dismiss().catch(() => {}));
});

test.afterEach(async () => {
  // Force close — app.close() can hang if beforeunload prevents it
  const pid = app.process().pid;
  if (pid) {
    process.kill(pid, "SIGKILL");
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Mock Electron's open-folder dialog to return our test directory, then click Add Folder. */
async function openTestFolder(): Promise<void> {
  await app.evaluate(async ({ dialog }, dirPath) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [dirPath],
    });
  }, testDir);

  await page.click(".open-folder-btn");
  // Wait for the file tree to populate
  await page.waitForSelector(".file-tree");
}

/** Select a file in the tree by clicking its label text. */
async function selectFileByName(name: string): Promise<void> {
  await page.click(`.tree-label:text-is("${name}")`);
  // Wait for the preview to load the selected file
  await page.waitForSelector(".preview-container");
}

/** Expand a folder in the tree by clicking its label text. */
async function expandFolder(name: string): Promise<void> {
  // Folder toggle buttons contain the folder name in a .project-name or
  // are rendered as tree-items with a tree-label. Click the tree-item
  // whose label matches the directory name.
  const folderItem = page.locator(`.tree-item:has(.tree-label:text-is("${name}"))`);
  await folderItem.click();
}

/** Determine the correct modifier key for the current platform. */
function modKey(): string {
  return process.platform === "darwin" ? "Meta" : "Control";
}

// ---------------------------------------------------------------------------
// 1. App launches
// ---------------------------------------------------------------------------

test("app launches with sidebar and toolbar visible", async () => {
  await expect(page.locator(".sidebar")).toBeVisible();
  await expect(page.locator(".toolbar")).toBeVisible();
});

// ---------------------------------------------------------------------------
// 2. Open folder — files appear in tree
// ---------------------------------------------------------------------------

test("open folder shows files in tree", async () => {
  await openTestFolder();

  const treeLabels = page.locator(".tree-label");
  await expect(treeLabels.filter({ hasText: "README.md" })).toBeVisible();
  await expect(treeLabels.filter({ hasText: "docs" })).toBeVisible();
});

// ---------------------------------------------------------------------------
// 3. Select file — preview renders content
// ---------------------------------------------------------------------------

test("selecting a file renders its markdown content", async () => {
  await openTestFolder();
  await selectFileByName("README.md");

  await expect(page.locator(".preview-filename")).toContainText("README.md");

  const previewContent = page.locator(".preview-content");
  await expect(previewContent).toBeVisible();
  await expect(previewContent.locator("h1")).toHaveText("Hello World");
  await expect(previewContent.locator("p")).toContainText("This is a test.");
});

// ---------------------------------------------------------------------------
// 4. Search filter
// ---------------------------------------------------------------------------

test("search input filters the file tree", async () => {
  await openTestFolder();

  // Expand docs folder so all files are visible
  await expandFolder("docs");
  await expect(page.locator(".tree-label:text-is('guide.md')")).toBeVisible();

  await page.fill(".search-input", "guide");

  // guide.md should still be visible; README.md and notes.md should be hidden
  await expect(page.locator(".tree-label:text-is('guide.md')")).toBeVisible();
  await expect(page.locator(".tree-label:text-is('README.md')")).toBeHidden();
  await expect(page.locator(".tree-label:text-is('notes.md')")).toBeHidden();

  // Clear the filter
  await page.fill(".search-input", "");
  await expect(page.locator(".tree-label:text-is('README.md')")).toBeVisible();
});

// ---------------------------------------------------------------------------
// 5. Edit mode — textarea appears with markdown content
// ---------------------------------------------------------------------------

test("edit mode shows textarea with file content", async () => {
  await openTestFolder();
  await selectFileByName("README.md");

  // Click the Edit button
  await page.click('.preview-mode-btn:text-is("Edit")');

  const textarea = page.locator(".edit-textarea");
  await expect(textarea).toBeVisible();
  await expect(textarea).toHaveValue("# Hello World\n\nThis is a test.");
});

// ---------------------------------------------------------------------------
// 6. Edit and save
// ---------------------------------------------------------------------------

test("editing and saving persists changes to disk", async () => {
  await openTestFolder();
  await selectFileByName("README.md");

  // Enter edit mode
  await page.click('.preview-mode-btn:text-is("Edit")');
  const textarea = page.locator(".edit-textarea");
  await expect(textarea).toBeVisible();

  // Append text
  await textarea.focus();
  await textarea.press("End");
  await textarea.fill("# Hello World\n\nThis is a test.\n\nAppended line.");

  // Save with keyboard shortcut
  await page.keyboard.press(`${modKey()}+s`);

  // Wait briefly for the write to flush
  await page.waitForTimeout(300);

  // Verify on disk
  const content = fs.readFileSync(readmePath(), "utf-8");
  expect(content).toContain("Appended line.");

  // Restore original content for other tests
  fs.writeFileSync(readmePath(), "# Hello World\n\nThis is a test.");
});

// ---------------------------------------------------------------------------
// 7. Dirty indicator
// ---------------------------------------------------------------------------

test("dirty indicator appears on edit and disappears when content restored", async () => {
  await openTestFolder();
  await selectFileByName("README.md");

  await page.click('.preview-mode-btn:text-is("Edit")');
  const textarea = page.locator(".edit-textarea");
  await expect(textarea).toBeVisible();

  // Make a change
  await textarea.focus();
  await textarea.press("End");
  await page.keyboard.type("x");

  await expect(page.locator(".dirty-indicator")).toBeVisible();

  // Undo the change — the content should match the saved version again
  await page.keyboard.press(`${modKey()}+z`);
  await expect(page.locator(".dirty-indicator")).toBeHidden();
});

// ---------------------------------------------------------------------------
// 8. Preview with edits — preview shows edited content
// ---------------------------------------------------------------------------

test("switching to preview shows edited content", async () => {
  await openTestFolder();
  await selectFileByName("README.md");

  // Enter edit mode
  await page.click('.preview-mode-btn:text-is("Edit")');
  const textarea = page.locator(".edit-textarea");
  await expect(textarea).toBeVisible();

  // Make an edit
  await textarea.fill("# Edited Title\n\nNew paragraph.");

  // Switch back to Preview
  await page.click('.preview-mode-btn:text-is("Preview")');

  const previewContent = page.locator(".preview-content");
  await expect(previewContent.locator("h1")).toHaveText("Edited Title");
  await expect(previewContent.locator("p")).toContainText("New paragraph.");
});

// ---------------------------------------------------------------------------
// 9. Copy button
// ---------------------------------------------------------------------------

test("copy button copies raw markdown to clipboard", async () => {
  await openTestFolder();
  await selectFileByName("README.md");

  // Grant clipboard permissions in the Electron context
  await app.evaluate(async ({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      win.webContents.session.setPermissionRequestHandler(
        (_webContents, _permission, callback) => callback(true)
      );
    }
  });

  await page.click(".preview-copy-btn");

  // The button should momentarily show "Copied!"
  await expect(page.locator(".preview-copy-btn")).toHaveText("Copied!");

  // Verify clipboard content via the renderer
  const clipboardText = await page.evaluate(() =>
    navigator.clipboard.readText()
  );
  expect(clipboardText).toBe("# Hello World\n\nThis is a test.");
});

// ---------------------------------------------------------------------------
// 10. Right-click rename
// ---------------------------------------------------------------------------

test("right-click rename updates the file name", async () => {
  await openTestFolder();
  await expandFolder("docs");
  await selectFileByName("notes.md");

  // Right-click to open context menu
  await page.click('.tree-item:has(.tree-label:text-is("notes.md"))', {
    button: "right",
  });
  await expect(page.locator(".context-menu")).toBeVisible();

  // Click Rename
  await page.click('.context-menu-item:text-is("Rename")');

  // The inline rename input should appear pre-filled
  const renameInput = page.locator(".tree-rename-input");
  await expect(renameInput).toBeVisible();

  // Type a new name and confirm
  await renameInput.fill("renamed-notes.md");
  await renameInput.press("Enter");

  // The tree should now show the new name
  await expect(
    page.locator('.tree-label:text-is("renamed-notes.md")')
  ).toBeVisible();
  await expect(
    page.locator('.tree-label:text-is("notes.md")')
  ).toBeHidden();

  // Verify on disk
  expect(
    fs.existsSync(path.join(testDir, "docs", "renamed-notes.md"))
  ).toBe(true);
  expect(
    fs.existsSync(path.join(testDir, "docs", "notes.md"))
  ).toBe(false);

  // Rename back for other tests
  fs.renameSync(
    path.join(testDir, "docs", "renamed-notes.md"),
    path.join(testDir, "docs", "notes.md")
  );
});

// ---------------------------------------------------------------------------
// 11. F2 rename
// ---------------------------------------------------------------------------

test("F2 triggers inline rename for selected file", async () => {
  await openTestFolder();
  await selectFileByName("README.md");

  // Focus the tree item and press F2
  const treeItem = page.locator(
    '.tree-item:has(.tree-label:text-is("README.md"))'
  );
  await treeItem.focus();
  await page.keyboard.press("F2");

  const renameInput = page.locator(".tree-rename-input");
  await expect(renameInput).toBeVisible();
  await expect(renameInput).toHaveValue("README.md");

  // Escape to cancel
  await renameInput.press("Escape");
  await expect(renameInput).toBeHidden();
});

// ---------------------------------------------------------------------------
// 12. Rename validation — invalid names show error
// ---------------------------------------------------------------------------

test("rename rejects invalid filenames", async () => {
  await openTestFolder();
  await selectFileByName("README.md");

  const treeItem = page.locator(
    '.tree-item:has(.tree-label:text-is("README.md"))'
  );
  await treeItem.focus();
  await page.keyboard.press("F2");

  const renameInput = page.locator(".tree-rename-input");
  await expect(renameInput).toBeVisible();

  // Try a name with path separators
  await renameInput.fill("foo/bar.md");
  await renameInput.press("Enter");

  // The input should remain visible (rename failed) and show an error style
  await expect(renameInput).toBeVisible();
  await expect(renameInput).toHaveCSS("border-color", "rgb(238, 85, 85)");

  // Try an empty name — triggers cancel (empty trimmed = original name = cancel)
  await renameInput.press("Escape");
  await expect(renameInput).toBeHidden();
});

// ---------------------------------------------------------------------------
// 13. Drag and drop — move file to a folder
// ---------------------------------------------------------------------------

test("drag and drop moves a file into a folder", async () => {
  await openTestFolder();

  // We need the docs folder visible as a drop target
  const sourceItem = page.locator(
    '.tree-item:has(.tree-label:text-is("README.md"))'
  );
  const docsFolder = page.locator(
    '.tree-item:has(.tree-label:text-is("docs"))'
  );

  // Perform the drag-and-drop
  await sourceItem.dragTo(docsFolder);

  // Wait for the tree to re-scan
  await page.waitForTimeout(500);

  // README.md should now exist inside docs/
  const movedPath = path.join(testDir, "docs", "README.md");
  expect(fs.existsSync(movedPath)).toBe(true);
  expect(fs.existsSync(readmePath())).toBe(false);

  // Move it back for other tests
  fs.renameSync(movedPath, readmePath());
});

// ---------------------------------------------------------------------------
// 14. Font size — Cmd+= and Cmd+-
// ---------------------------------------------------------------------------

test("keyboard shortcuts change font size", async () => {
  // The toolbar shows the current font size as "16px"
  const fontLabel = page.locator(".toolbar-label");
  await expect(fontLabel).toHaveText("16px");

  // Increase
  await page.keyboard.press(`${modKey()}+=`);
  await expect(fontLabel).toHaveText("18px");

  // Decrease back
  await page.keyboard.press(`${modKey()}+-`);
  await expect(fontLabel).toHaveText("16px");

  // Decrease below default
  await page.keyboard.press(`${modKey()}+-`);
  await expect(fontLabel).toHaveText("14px");

  // Reset with Cmd+0
  await page.keyboard.press(`${modKey()}+0`);
  await expect(fontLabel).toHaveText("16px");
});

// ---------------------------------------------------------------------------
// 15. Theme toggle — Cmd+D cycles themes
// ---------------------------------------------------------------------------

test("Cmd+D cycles through quick themes", async () => {
  // Default is "system" — the toolbar button text shows "System"
  const themeBtn = page.locator('.toolbar-btn:has-text("System")');
  await expect(themeBtn).toBeVisible();

  // Toggle to "Light"
  await page.keyboard.press(`${modKey()}+d`);
  await expect(page.locator('.toolbar-btn:has-text("Light")')).toBeVisible();

  // Toggle to "Dark"
  await page.keyboard.press(`${modKey()}+d`);
  await expect(page.locator('.toolbar-btn:has-text("Dark")')).toBeVisible();

  // Toggle back to "System"
  await page.keyboard.press(`${modKey()}+d`);
  await expect(page.locator('.toolbar-btn:has-text("System")')).toBeVisible();
});

// ---------------------------------------------------------------------------
// 16. Sidebar toggle — Cmd+B
// ---------------------------------------------------------------------------

test("Cmd+B toggles sidebar visibility", async () => {
  await expect(page.locator(".sidebar")).toBeVisible();

  // Hide
  await page.keyboard.press(`${modKey()}+b`);
  await expect(page.locator(".sidebar")).toBeHidden();

  // Show
  await page.keyboard.press(`${modKey()}+b`);
  await expect(page.locator(".sidebar")).toBeVisible();
});

// ---------------------------------------------------------------------------
// 17. Keyboard shortcuts suppressed in edit mode
// ---------------------------------------------------------------------------

test("shortcuts like Cmd+B are suppressed when editing", async () => {
  await openTestFolder();
  await selectFileByName("README.md");

  // Enter edit mode
  await page.click('.preview-mode-btn:text-is("Edit")');
  const textarea = page.locator(".edit-textarea");
  await expect(textarea).toBeVisible();

  // Focus the textarea to simulate active editing
  await textarea.focus();

  // Press Cmd+B — sidebar should NOT toggle
  await expect(page.locator(".sidebar")).toBeVisible();
  await page.keyboard.press(`${modKey()}+b`);
  await expect(page.locator(".sidebar")).toBeVisible();

  // Exit edit mode by clicking Preview
  await page.click('.preview-mode-btn:text-is("Preview")');

  // Now Cmd+B should work
  await page.keyboard.press(`${modKey()}+b`);
  await expect(page.locator(".sidebar")).toBeHidden();

  // Restore
  await page.keyboard.press(`${modKey()}+b`);
});
