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

/** Create a minimal valid 1x1 red PNG (69 bytes). */
function createTestPng(): Buffer {
  // Minimal valid PNG: 1x1 pixel, red (#FF0000), with correct CRC and zlib compression
  const hex = "89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000c49444154789c63f8cfc0000003010100c9fe92ef0000000049454e44ae426082";
  return Buffer.from(hex, "hex");
}

test.beforeAll(() => {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), "viewmd-e2e-"));

  fs.writeFileSync(readmePath(), "# Hello World\n\nThis is a test.");
  fs.mkdirSync(path.join(testDir, "docs"));
  fs.writeFileSync(guidePath(), "# Guide\n\nSome guide content.");
  fs.writeFileSync(notesPath(), "# Notes\n\nSome notes.");
  // Long file for scroll tests
  const longContent = "# Long Document\n\n" + Array.from({ length: 100 }, (_, i) => `## Section ${i + 1}\n\nParagraph ${i + 1} with enough text to take up space in the viewport.\n`).join("\n");
  fs.writeFileSync(path.join(testDir, "long.md"), longContent);

  // Image test files
  fs.mkdirSync(path.join(testDir, "images"));
  fs.writeFileSync(path.join(testDir, "images", "test.png"), createTestPng());
  fs.writeFileSync(path.join(testDir, "images", "my file.png"), createTestPng());
  fs.writeFileSync(
    path.join(testDir, "images.md"),
    [
      "# Image Test",
      "",
      "## Markdown image syntax",
      "",
      "![Test](./images/test.png)",
      "",
      "## HTML img tag",
      "",
      '<p><img src="images/test.png" alt="HTML test" width="32" height="32"></p>',
      "",
      "## External image (1x1 transparent pixel via https)",
      "",
      "![External](https://upload.wikimedia.org/wikipedia/commons/c/ce/Transparent.gif)",
      "",
      "## Protocol-relative image (HTML)",
      "",
      '<p><img src="//upload.wikimedia.org/wikipedia/commons/c/ce/Transparent.gif" alt="ProtoRel"></p>',
      "",
      "## Protocol-relative image (markdown)",
      "",
      "![MdProtoRel](//upload.wikimedia.org/wikipedia/commons/c/ce/Transparent.gif)",
      "",
      "## Pre-encoded URL (markdown)",
      "",
      "![MdEncoded](./images/my%20file.png)",
      "",
    ].join("\n")
  );
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

  await page.click('.preview-copy-btn:text-is("Copy")');

  // The button should momentarily show "Copied!"
  await expect(page.locator('.preview-copy-btn:text-is("Copied!")')).toBeVisible();

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

// ---------------------------------------------------------------------------
// 18. Reading themes available in settings
// ---------------------------------------------------------------------------

test("reading themes are visible in settings panel", async () => {
  await page.click('[aria-label="Open settings"]');
  await expect(page.locator(".settings-panel")).toBeVisible();

  // Scroll the settings body to ensure reading themes are visible
  const body = page.locator(".settings-body");
  await body.evaluate((el) => el.scrollTop = 0);

  await expect(page.locator('.swatch-label:text-is("Sepia")')).toBeVisible();
  await expect(page.locator('.swatch-label:text-is("Sage")')).toBeVisible();
  await expect(page.locator('.swatch-label:text-is("Twilight Reader")')).toBeVisible();
});

// ---------------------------------------------------------------------------
// 19. Theme switching — click Sepia swatch
// ---------------------------------------------------------------------------

test("clicking Sepia swatch changes data-theme attribute", async () => {
  await page.click('[aria-label="Open settings"]');
  await expect(page.locator(".settings-panel")).toBeVisible();

  const sepiaSwatch = page.locator('.theme-swatch', { has: page.locator('.swatch-label:text-is("Sepia")') });
  await sepiaSwatch.click();

  await expect(page.locator("html")).toHaveAttribute("data-theme", "sepia");
});

// ---------------------------------------------------------------------------
// 20. Typography controls visible in settings
// ---------------------------------------------------------------------------

test("typography controls are visible in settings", async () => {
  await page.click('[aria-label="Open settings"]');
  await expect(page.locator(".settings-panel")).toBeVisible();

  // Scroll to bottom of settings to reveal reading layout section
  const body = page.locator(".settings-body");
  await body.evaluate((el) => el.scrollTop = el.scrollHeight);

  // Content width buttons
  await expect(page.locator('.segmented-btn:text-is("Narrow")')).toBeVisible();
  await expect(page.locator('.segmented-btn:text-is("Standard")')).toBeVisible();
  await expect(page.locator('.segmented-btn:text-is("Wide")')).toBeVisible();

  // Line height buttons
  await expect(page.locator('.segmented-btn:text-is("Compact")')).toBeVisible();
  await expect(page.locator('.segmented-btn:text-is("Optimal")')).toBeVisible();
  await expect(page.locator('.segmented-btn:text-is("Relaxed")')).toBeVisible();
});

// ---------------------------------------------------------------------------
// 21. Line width changes — clicking Narrow
// ---------------------------------------------------------------------------

test("clicking Narrow changes --content-width CSS variable", async () => {
  await page.click('[aria-label="Open settings"]');
  await expect(page.locator(".settings-panel")).toBeVisible();

  const body = page.locator(".settings-body");
  await body.evaluate((el) => el.scrollTop = el.scrollHeight);

  await page.click('.segmented-btn:text-is("Narrow")');

  const narrowWidth = await page.locator("html").evaluate((el) =>
    el.style.getPropertyValue("--content-width")
  );

  expect(narrowWidth).toBe("38rem");
});

// ---------------------------------------------------------------------------
// 22. Focus mode toggle — Cmd+Shift+F
// ---------------------------------------------------------------------------

test("focus mode hides toolbar and sidebar, Escape restores them", async () => {
  await expect(page.locator(".toolbar")).toBeVisible();
  await expect(page.locator(".sidebar")).toBeVisible();

  // Enter focus mode
  await page.keyboard.press(`${modKey()}+Shift+f`);

  await expect(page.locator(".toolbar")).toBeHidden();
  await expect(page.locator(".sidebar")).toBeHidden();

  // Exit focus mode with Escape
  await page.keyboard.press("Escape");

  await expect(page.locator(".toolbar")).toBeVisible();
  await expect(page.locator(".sidebar")).toBeVisible();
});

// ---------------------------------------------------------------------------
// 23. Warm filter toggle
// ---------------------------------------------------------------------------

test("warm filter toggle adds warm-filter class to html", async () => {
  await page.click('[aria-label="Open settings"]');
  await expect(page.locator(".settings-panel")).toBeVisible();

  const body = page.locator(".settings-body");
  await body.evaluate((el) => el.scrollTop = el.scrollHeight);

  await page.click('.toggle-option:has-text("Warm filter")');

  await expect(page.locator("html")).toHaveClass(/warm-filter/);
});

// ---------------------------------------------------------------------------
// 24. Progress bar visible when viewing a file
// ---------------------------------------------------------------------------

test("progress bar is visible when viewing a file", async () => {
  await openTestFolder();
  await selectFileByName("README.md");

  await expect(page.locator(".progress-bar-track")).toBeVisible();
});

// ---------------------------------------------------------------------------
// 25. Progress bar hidden in edit mode
// ---------------------------------------------------------------------------

test("progress bar is hidden in edit mode", async () => {
  await openTestFolder();
  await selectFileByName("README.md");

  // Verify progress bar is present in preview mode
  await expect(page.locator(".progress-bar-track")).toBeVisible();

  // Enter edit mode
  await page.click('.preview-mode-btn:text-is("Edit")');
  await expect(page.locator(".edit-textarea")).toBeVisible();

  // Progress bar should not be visible in edit mode
  await expect(page.locator(".progress-bar-track")).toBeHidden();
});

// ---------------------------------------------------------------------------
// 26. Progress bar re-derives after edit mode toggle
// ---------------------------------------------------------------------------

test("progress bar updates after scrolling a long document", async () => {
  await openTestFolder();
  await selectFileByName("long.md");

  // Initially at top — progress should be 0
  const initialTransform = await page.locator(".progress-bar-fill").evaluate((el) =>
    getComputedStyle(el).transform
  );

  // Scroll to the bottom
  await page.locator(".preview-scroll").evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await page.waitForTimeout(100);

  // Progress should now be non-zero
  const scrolledTransform = await page.locator(".progress-bar-fill").evaluate((el) =>
    getComputedStyle(el).transform
  );

  expect(scrolledTransform).not.toBe(initialTransform);
});

test("progress bar is not stuck at zero after edit mode round-trip", async () => {
  await openTestFolder();
  await selectFileByName("long.md");

  // Enter edit mode and return
  await page.click('.preview-mode-btn:text-is("Edit")');
  await expect(page.locator(".edit-textarea")).toBeVisible();
  await page.click('.preview-mode-btn:text-is("Preview")');
  await expect(page.locator(".preview-content")).toBeVisible();

  // Scroll to bottom after returning to preview
  await page.locator(".preview-scroll").evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await page.waitForTimeout(100);

  // Progress bar should respond to scroll (not stuck at 0)
  const transform = await page.locator(".progress-bar-fill").evaluate((el) =>
    getComputedStyle(el).transform
  );

  expect(transform).not.toBe("matrix(0, 0, 0, 1, 0, 0)");
});

// ---------------------------------------------------------------------------
// 28. Print produces a PDF without errors
// ---------------------------------------------------------------------------

test("printToPDF succeeds and produces non-empty output", async () => {
  await openTestFolder();
  await selectFileByName("README.md");

  // Use Electron's printToPDF API
  const pdfBuffer = await app.evaluate(async ({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    const pdf = await win.webContents.printToPDF({
      printBackground: false,
      pageSize: "A4",
    });
    return pdf.length;
  });

  expect(pdfBuffer).toBeGreaterThan(0);
});

// ---------------------------------------------------------------------------
// 29. Print styles strip theme colours
// ---------------------------------------------------------------------------

test("print media query forces black text on white background", async () => {
  await openTestFolder();
  await selectFileByName("README.md");

  // Apply a coloured theme first
  await page.click('[aria-label="Open settings"]');
  await expect(page.locator(".settings-panel")).toBeVisible();
  const sepiaSwatch = page.locator('.theme-swatch', { has: page.locator('.swatch-label:text-is("Sepia")') });
  await sepiaSwatch.click();

  // Emulate print media
  await page.emulateMedia({ media: "print" });

  const styles = await page.locator(".preview-content").evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      color: cs.color,
      backgroundColor: cs.backgroundColor,
    };
  });

  // Should be black text on white background regardless of theme
  expect(styles.color).toBe("rgb(0, 0, 0)");
  expect(styles.backgroundColor).toBe("rgb(255, 255, 255)");
});

// ---------------------------------------------------------------------------
// 30. Print honours line-height setting
// ---------------------------------------------------------------------------

test("print media honours the user line-height preference", async () => {
  await openTestFolder();
  await selectFileByName("README.md");

  // Get default print line-height
  await page.emulateMedia({ media: "print" });
  const defaultLH = await page.locator(".preview-content").evaluate((el) =>
    getComputedStyle(el).lineHeight
  );

  // Switch back to screen, change to relaxed
  await page.emulateMedia({ media: "screen" });
  await page.click('[aria-label="Open settings"]');
  await expect(page.locator(".settings-panel")).toBeVisible();
  const body = page.locator(".settings-body");
  await body.evaluate((el) => el.scrollTop = el.scrollHeight);
  await page.click('.segmented-btn:text-is("Relaxed")');
  await page.keyboard.press("Escape");

  // Check print again — should be different from default
  await page.emulateMedia({ media: "print" });
  const relaxedLH = await page.locator(".preview-content").evaluate((el) =>
    getComputedStyle(el).lineHeight
  );

  expect(relaxedLH).not.toBe(defaultLH);
});

// ---------------------------------------------------------------------------
// 31. Print hides chrome elements
// ---------------------------------------------------------------------------

test("print media hides toolbar, sidebar, and edit controls", async () => {
  await openTestFolder();
  await selectFileByName("README.md");

  await page.emulateMedia({ media: "print" });

  await expect(page.locator(".toolbar")).toBeHidden();
  await expect(page.locator(".sidebar")).toBeHidden();
  await expect(page.locator(".preview-header")).toBeHidden();
  await expect(page.locator(".progress-bar-track")).toBeHidden();
});

// ---------------------------------------------------------------------------
// 32. Print from edit mode shows preview content, not blank page
// ---------------------------------------------------------------------------

test("printing from edit mode shows preview content", async () => {
  await openTestFolder();
  await selectFileByName("README.md");

  // Enter edit mode
  await page.click('.preview-mode-btn:text-is("Edit")');
  await expect(page.locator(".edit-textarea")).toBeVisible();

  // Emulate print media
  await page.emulateMedia({ media: "print" });

  // Preview content should be visible (forced by print CSS)
  await expect(page.locator(".preview-content")).toBeVisible();

  // Textarea should be hidden
  await expect(page.locator(".edit-textarea")).toBeHidden();
});

// ---------------------------------------------------------------------------
// 33. Sidebar resize handle exists and is accessible
// ---------------------------------------------------------------------------

test("sidebar resize handle exists and is accessible", async () => {
  const handle = page.locator(".sidebar-resize-handle");
  await expect(handle).toBeVisible();

  await expect(handle).toHaveAttribute("role", "separator");
  await expect(handle).toHaveAttribute("aria-orientation", "vertical");
  await expect(handle).toHaveAttribute("aria-valuemin", "180");
  await expect(handle).toHaveAttribute("aria-valuemax", "500");
  await expect(handle).toHaveAttribute("aria-valuenow", "280");
  await expect(handle).toHaveAttribute("aria-label", "Resize sidebar");
});

// ---------------------------------------------------------------------------
// 34. Sidebar Aa button opens text size popover
// ---------------------------------------------------------------------------

test("sidebar Aa button opens text size popover", async () => {
  // Click the Aa button to open the text size popover
  await page.click(".sidebar-text-size-btn");

  // Popover should appear with Small/Medium/Large options
  const popover = page.locator(".sidebar-text-popover");
  await expect(popover).toBeVisible();

  const items = popover.locator(".toolbar-popover-item");
  await expect(items).toHaveCount(3);
  await expect(items.nth(0)).toHaveText("Small");
  await expect(items.nth(1)).toHaveText("Medium");
  await expect(items.nth(2)).toHaveText("Large");

  // Click "Small" — popover should close
  await items.nth(0).click();
  await expect(popover).toBeHidden();
});

// ---------------------------------------------------------------------------
// 35. Toolbar content width popover
// ---------------------------------------------------------------------------

test("toolbar content width popover shows options and Full sets --content-width to none", async () => {
  // Click the content width toolbar button
  await page.click('[aria-label="Content width"]');

  // Popover should appear with Narrow/Standard/Wide/Full
  const popover = page.locator(".toolbar-popover");
  await expect(popover).toBeVisible();

  const items = popover.locator(".toolbar-popover-item");
  await expect(items).toHaveCount(4);
  await expect(items.nth(0)).toHaveText("Narrow");
  await expect(items.nth(1)).toHaveText("Standard");
  await expect(items.nth(2)).toHaveText("Wide");
  await expect(items.nth(3)).toHaveText("Full");

  // Click "Full"
  await items.nth(3).click();

  // Popover should close
  await expect(popover).toBeHidden();

  // Verify --content-width CSS variable is "none"
  const contentWidth = await page.locator("html").evaluate((el) =>
    el.style.getPropertyValue("--content-width")
  );
  expect(contentWidth).toBe("none");
});

// ---------------------------------------------------------------------------
// 36. Linked font scaling
// ---------------------------------------------------------------------------

test("linked font scaling updates sidebar font size CSS variable", async () => {
  // Read the default --sidebar-font-size
  const defaultSize = await page.locator("html").evaluate((el) =>
    el.style.getPropertyValue("--sidebar-font-size")
  );

  // Increase font with Cmd+=
  await page.keyboard.press(`${modKey()}+=`);

  // --sidebar-font-size should change from its default value
  const increasedSize = await page.locator("html").evaluate((el) =>
    el.style.getPropertyValue("--sidebar-font-size")
  );
  expect(increasedSize).not.toBe(defaultSize);

  // Reset with Cmd+0
  await page.keyboard.press(`${modKey()}+0`);

  // Should return to default
  const resetSize = await page.locator("html").evaluate((el) =>
    el.style.getPropertyValue("--sidebar-font-size")
  );
  expect(resetSize).toBe(defaultSize);
});

// ---------------------------------------------------------------------------
// 37. Settings shows sidebar text and full width controls
// ---------------------------------------------------------------------------

test("settings shows sidebar text and full width controls", async () => {
  await page.click('[aria-label="Open settings"]');
  await expect(page.locator(".settings-panel")).toBeVisible();

  // Scroll to reveal the layout section
  const body = page.locator(".settings-body");
  await body.evaluate((el) => el.scrollTop = el.scrollHeight);

  // "Sidebar Text" segmented control with Small/Medium/Large
  await expect(page.locator('.settings-group-label:text-is("Sidebar Text")')).toBeVisible();
  const sidebarControl = page.locator('[aria-label="Sidebar text size"]');
  await expect(sidebarControl.locator('.segmented-btn:text-is("Small")')).toBeVisible();
  await expect(sidebarControl.locator('.segmented-btn:text-is("Medium")')).toBeVisible();
  await expect(sidebarControl.locator('.segmented-btn:text-is("Large")')).toBeVisible();

  // "Full" option in line width control
  await expect(page.locator('.segmented-btn:text-is("Full")')).toBeVisible();
});

// ---------------------------------------------------------------------------
// 38. Content width Full option sets max-width none
// ---------------------------------------------------------------------------

test("content width Full option in settings sets --content-width to none", async () => {
  await page.click('[aria-label="Open settings"]');
  await expect(page.locator(".settings-panel")).toBeVisible();

  // Scroll to reveal layout controls
  const body = page.locator(".settings-body");
  await body.evaluate((el) => el.scrollTop = el.scrollHeight);

  // Click "Full" in the line width segmented control
  await page.click('.segmented-btn:text-is("Full")');

  // Verify --content-width CSS variable is "none"
  const contentWidth = await page.locator("html").evaluate((el) =>
    el.style.getPropertyValue("--content-width")
  );
  expect(contentWidth).toBe("none");
});

// ---------------------------------------------------------------------------
// 39. Sidebar resize via keyboard — arrow keys change width
// ---------------------------------------------------------------------------

test("sidebar resize handle responds to keyboard arrow keys", async () => {
  const handle = page.locator(".sidebar-resize-handle");
  await handle.focus();

  // Get initial sidebar width
  const initialWidth = await page.locator(".sidebar").evaluate((el) =>
    el.getBoundingClientRect().width
  );

  // Press ArrowRight to increase width by 10px
  await page.keyboard.press("ArrowRight");

  const newWidth = await page.locator("html").evaluate((el) =>
    el.style.getPropertyValue("--sidebar-width")
  );
  expect(newWidth).toBe(`${Math.round(initialWidth) + 10}px`);

  // Press ArrowLeft to decrease back
  await page.keyboard.press("ArrowLeft");

  const restoredWidth = await page.locator("html").evaluate((el) =>
    el.style.getPropertyValue("--sidebar-width")
  );
  expect(restoredWidth).toBe(`${Math.round(initialWidth)}px`);
});

// ---------------------------------------------------------------------------
// 40. CLI directory argument — launching with a path opens that folder
// ---------------------------------------------------------------------------

test("launching with a directory argument opens that folder in sidebar", async () => {
  // Close the default app from beforeEach
  const pid = app.process().pid;
  if (pid) process.kill(pid, "SIGKILL");

  // Launch with testDir as CLI argument
  app = await electron.launch({ args: ["dist/main/main.js", testDir] });
  page = await app.firstWindow();
  await page.waitForLoadState("domcontentloaded");
  page.on("dialog", (dialog) => dialog.dismiss().catch(() => {}));

  // Wait for the file tree to appear — the directory should auto-open
  await page.waitForSelector(".file-tree", { timeout: 5000 });

  // Verify files from testDir are visible — full tree, not just one file
  const treeLabels = page.locator(".tree-label");
  await expect(treeLabels.filter({ hasText: "README.md" })).toBeVisible();
  await expect(treeLabels.filter({ hasText: "docs" })).toBeVisible();
  await expect(treeLabels.filter({ hasText: "long.md" })).toBeVisible();

  // Confirm the "Add Folder" button was NOT clicked — tree appeared via CLI arg alone
  // (The open-folder-btn exists but should not have been needed)
  await expect(page.locator(".open-folder-btn")).toBeVisible();
});

// ---------------------------------------------------------------------------
// 41. CLI file argument — launching with a file path opens parent dir + selects file
// ---------------------------------------------------------------------------

test("second launch with different directory adds folder to existing sidebar", async () => {
  // Close the default app from beforeEach
  const pid = app.process().pid;
  if (pid) process.kill(pid, "SIGKILL");

  // Create a second temp directory with its own markdown file
  const secondDir = fs.mkdtempSync(path.join(os.tmpdir(), "viewmd-e2e-2nd-"));
  fs.writeFileSync(path.join(secondDir, "second.md"), "# Second\n\nFrom second dir.");

  try {
    // Launch first instance with testDir
    app = await electron.launch({ args: ["dist/main/main.js", testDir] });
    page = await app.firstWindow();
    await page.waitForLoadState("domcontentloaded");
    page.on("dialog", (dialog) => dialog.dismiss().catch(() => {}));
    await page.waitForSelector(".file-tree", { timeout: 5000 });

    // Verify first directory's files are visible
    await expect(page.locator(".tree-label").filter({ hasText: "README.md" })).toBeVisible();

    // Simulate a second instance launching with secondDir as argument.
    // Include Chromium-injected flags to verify they are skipped by findPathArg.
    // argv format for non-packaged: [electron, main.js, ...chromiumFlags, userPath]
    await app.evaluate(async ({ app: electronApp }, dirPath) => {
      electronApp.emit("second-instance", {}, [
        process.execPath,
        "dist/main/main.js",
        "--original-process-start-time=12345",
        "--flag-switches-begin",
        "--flag-switches-end",
        dirPath,
      ], process.cwd());
    }, secondDir);

    // Wait for the second folder's file to appear
    await expect(page.locator(".tree-label").filter({ hasText: "second.md" })).toBeVisible({ timeout: 5000 });

    // Both folders should be visible in the sidebar
    await expect(page.locator(".tree-label").filter({ hasText: "README.md" })).toBeVisible();
  } finally {
    fs.rmSync(secondDir, { recursive: true, force: true });
  }
});

test("launching with a file argument opens its parent directory and selects the file", async () => {
  // Close the default app from beforeEach
  const pid = app.process().pid;
  if (pid) process.kill(pid, "SIGKILL");

  // Launch with a specific file path as CLI argument
  const filePath = path.join(testDir, "README.md");
  app = await electron.launch({ args: ["dist/main/main.js", filePath] });
  page = await app.firstWindow();
  await page.waitForLoadState("domcontentloaded");
  page.on("dialog", (dialog) => dialog.dismiss().catch(() => {}));

  // Wait for the file tree AND the preview to appear
  await page.waitForSelector(".file-tree", { timeout: 5000 });
  await page.waitForSelector(".preview-content", { timeout: 5000 });

  // The tree should show the parent directory's contents
  const treeLabels = page.locator(".tree-label");
  await expect(treeLabels.filter({ hasText: "README.md" })).toBeVisible();

  // The file should be selected — preview should show its content
  await expect(page.locator(".preview-content h1")).toHaveText("Hello World");
});

// ---------------------------------------------------------------------------
// 42. Double-click sidebar resize handle resets width to 280px
// ---------------------------------------------------------------------------

test("double-click sidebar resize handle resets width to 280px", async () => {
  const handle = page.locator(".sidebar-resize-handle");

  // First change the sidebar width via keyboard
  await handle.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");

  // Verify width is now 310px (280 + 3*10)
  const widthBefore = await page.locator("html").evaluate((el) =>
    el.style.getPropertyValue("--sidebar-width")
  );
  expect(widthBefore).toBe("310px");

  // Double-click the handle
  await handle.dblclick();

  // Should reset to 280px
  const widthAfter = await page.locator("html").evaluate((el) =>
    el.style.getPropertyValue("--sidebar-width")
  );
  expect(widthAfter).toBe("280px");
});

// ---------------------------------------------------------------------------
// 43. Sidebar resize Home/End keyboard shortcuts
// ---------------------------------------------------------------------------

test("sidebar resize handle Home key sets minimum width and End key sets maximum", async () => {
  const handle = page.locator(".sidebar-resize-handle");
  await handle.focus();

  // Press Home — should go to minimum (180px)
  await page.keyboard.press("Home");
  const minWidth = await page.locator("html").evaluate((el) =>
    el.style.getPropertyValue("--sidebar-width")
  );
  expect(minWidth).toBe("180px");

  // Press End — should go to maximum (500px)
  await page.keyboard.press("End");
  const maxWidth = await page.locator("html").evaluate((el) =>
    el.style.getPropertyValue("--sidebar-width")
  );
  expect(maxWidth).toBe("500px");
});

// ---------------------------------------------------------------------------
// 44. Content width popover dismisses on Escape
// ---------------------------------------------------------------------------

test("content width popover dismisses on Escape key", async () => {
  // Open the content width popover
  await page.click('[aria-label="Content width"]');
  const popover = page.locator(".toolbar-popover");
  await expect(popover).toBeVisible();

  // Press Escape
  await page.keyboard.press("Escape");

  // Popover should close
  await expect(popover).toBeHidden();
});

// ---------------------------------------------------------------------------
// 45. Content width popover dismisses on click-outside
// ---------------------------------------------------------------------------

test("content width popover dismisses on click outside", async () => {
  // Open the content width popover
  await page.click('[aria-label="Content width"]');
  const popover = page.locator(".toolbar-popover");
  await expect(popover).toBeVisible();

  // Click outside the popover — use dispatchEvent to ensure mousedown fires
  await page.locator(".app-body").dispatchEvent("mousedown");

  // Popover should close
  await expect(popover).toBeHidden();
});

// ---------------------------------------------------------------------------
// 46. Sidebar text size popover dismisses on Escape
// ---------------------------------------------------------------------------

test("sidebar text size popover dismisses on Escape key", async () => {
  await page.click(".sidebar-text-size-btn");
  const popover = page.locator(".sidebar-text-popover");
  await expect(popover).toBeVisible();

  await page.keyboard.press("Escape");

  await expect(popover).toBeHidden();
});

// ---------------------------------------------------------------------------
// 47. Sidebar text size popover dismisses on click-outside
// ---------------------------------------------------------------------------

test("sidebar text size popover dismisses on click outside", async () => {
  await page.click(".sidebar-text-size-btn");
  const popover = page.locator(".sidebar-text-popover");
  await expect(popover).toBeVisible();

  // Click outside — on the sidebar content area
  await page.locator(".sidebar-content").click();

  await expect(popover).toBeHidden();
});

// ---------------------------------------------------------------------------
// 48. Linked font scaling — exact values at default 16px
// ---------------------------------------------------------------------------

test("linked font scaling produces exact values at default font size 16px", async () => {
  // At default fontSize=16, zoomFactor=1.0
  // small = max(9, round(12 * 1.0)) = 12px
  // medium = small + 1 = 13px
  // large = small + 3 = 15px

  // Select "Small" sidebar font
  await page.click(".sidebar-text-size-btn");
  const popover = page.locator(".sidebar-text-popover");
  await expect(popover).toBeVisible();
  await popover.locator('.toolbar-popover-item:text-is("Small")').click();

  const smallSize = await page.locator("html").evaluate((el) =>
    el.style.getPropertyValue("--sidebar-font-size")
  );
  expect(smallSize).toBe("12px");

  // Select "Medium"
  await page.click(".sidebar-text-size-btn");
  await page.locator('.sidebar-text-popover .toolbar-popover-item:text-is("Medium")').click();

  const mediumSize = await page.locator("html").evaluate((el) =>
    el.style.getPropertyValue("--sidebar-font-size")
  );
  expect(mediumSize).toBe("13px");

  // Select "Large"
  await page.click(".sidebar-text-size-btn");
  await page.locator('.sidebar-text-popover .toolbar-popover-item:text-is("Large")').click();

  const largeSize = await page.locator("html").evaluate((el) =>
    el.style.getPropertyValue("--sidebar-font-size")
  );
  expect(largeSize).toBe("15px");
});

// ---------------------------------------------------------------------------
// 49. Linked font scaling — exact values after Cmd+= (fontSize=18)
// ---------------------------------------------------------------------------

test("linked font scaling produces correct values after increasing content font size", async () => {
  // Increase from 16 to 18, zoomFactor = 18/16 = 1.125
  // small = max(9, round(12 * 1.125)) = round(13.5) = 14
  // medium = 14 + 1 = 15px
  // large = 14 + 3 = 17px

  // Ensure focus is on the main app body, not a popover
  await page.locator(".app").click();
  await page.keyboard.press(`${modKey()}+=`);
  await expect(page.locator(".toolbar-label")).toHaveText("18px");

  // Select "Small"
  await page.click(".sidebar-text-size-btn");
  await page.locator('.sidebar-text-popover .toolbar-popover-item:text-is("Small")').click();

  const smallSize = await page.locator("html").evaluate((el) =>
    el.style.getPropertyValue("--sidebar-font-size")
  );
  expect(smallSize).toBe("14px");

  // Select "Medium"
  await page.click(".sidebar-text-size-btn");
  await page.locator('.sidebar-text-popover .toolbar-popover-item:text-is("Medium")').click();

  const mediumSize = await page.locator("html").evaluate((el) =>
    el.style.getPropertyValue("--sidebar-font-size")
  );
  expect(mediumSize).toBe("15px");

  // Select "Large"
  await page.click(".sidebar-text-size-btn");
  await page.locator('.sidebar-text-popover .toolbar-popover-item:text-is("Large")').click();

  const largeSize = await page.locator("html").evaluate((el) =>
    el.style.getPropertyValue("--sidebar-font-size")
  );
  expect(largeSize).toBe("17px");

  // Reset font size
  await page.keyboard.press(`${modKey()}+0`);
});

// ---------------------------------------------------------------------------
// 50. Settings sidebar text control changes --sidebar-font-size CSS variable
// ---------------------------------------------------------------------------

test("settings sidebar text control changes --sidebar-font-size CSS variable", async () => {
  await page.click('[aria-label="Open settings"]');
  await expect(page.locator(".settings-panel")).toBeVisible();

  // Scroll to reveal the layout section
  const body = page.locator(".settings-body");
  await body.evaluate((el) => el.scrollTop = el.scrollHeight);

  // Get the initial value (default: medium at 16px = 13px)
  const initialSize = await page.locator("html").evaluate((el) =>
    el.style.getPropertyValue("--sidebar-font-size")
  );
  expect(initialSize).toBe("13px");

  // Click "Small" in the settings sidebar text control
  const sidebarControl = page.locator('[aria-label="Sidebar text size"]');
  await sidebarControl.locator('.segmented-btn:text-is("Small")').click();

  const smallSize = await page.locator("html").evaluate((el) =>
    el.style.getPropertyValue("--sidebar-font-size")
  );
  expect(smallSize).toBe("12px");

  // Click "Large"
  await sidebarControl.locator('.segmented-btn:text-is("Large")').click();

  const largeSize = await page.locator("html").evaluate((el) =>
    el.style.getPropertyValue("--sidebar-font-size")
  );
  expect(largeSize).toBe("15px");
});

// ---------------------------------------------------------------------------
// 51. Sidebar resize handle ARIA valuenow updates on resize
// ---------------------------------------------------------------------------

test("sidebar resize handle ARIA valuenow updates when width changes", async () => {
  const handle = page.locator(".sidebar-resize-handle");

  // Default should be 280
  await expect(handle).toHaveAttribute("aria-valuenow", "280");

  // Change via keyboard
  await handle.focus();
  await page.keyboard.press("ArrowRight");

  // Should now be 290
  await expect(handle).toHaveAttribute("aria-valuenow", "290");

  // Reset
  await handle.dblclick();
  await expect(handle).toHaveAttribute("aria-valuenow", "280");
});

// ---------------------------------------------------------------------------
// 52. Inline images — markdown ![](path) syntax renders via local-img protocol
// ---------------------------------------------------------------------------

test("markdown image syntax renders an img with local-img:// src", async () => {
  await openTestFolder();
  await selectFileByName("images.md");

  const previewContent = page.locator(".preview-content");
  await expect(previewContent).toBeVisible();

  // The markdown-syntax image should be rewritten to local-img://
  const mdImg = previewContent.locator('img[alt="Test"]');
  await expect(mdImg).toBeVisible();
  const src = await mdImg.getAttribute("src");
  expect(src).toMatch(/^local-img:\/\//);
  expect(src).toContain("images");
  expect(src).toContain("test.png");
});

// ---------------------------------------------------------------------------
// 53. Inline images — HTML <img> tags are rewritten to local-img protocol
// ---------------------------------------------------------------------------

test("HTML img tags in markdown are rewritten to local-img:// src", async () => {
  await openTestFolder();
  await selectFileByName("images.md");

  const previewContent = page.locator(".preview-content");
  await expect(previewContent).toBeVisible();

  // The HTML <img> tag should also be rewritten to local-img://
  const htmlImg = previewContent.locator('img[alt="HTML test"]');
  await expect(htmlImg).toBeVisible();
  const src = await htmlImg.getAttribute("src");
  expect(src).toMatch(/^local-img:\/\//);
  expect(src).toContain("images");
  expect(src).toContain("test.png");
});

// ---------------------------------------------------------------------------
// 54. Inline images — local-img protocol actually serves the image (non-zero natural size)
// ---------------------------------------------------------------------------

test("local-img protocol serves images with non-zero dimensions", async () => {
  await openTestFolder();
  await selectFileByName("images.md");

  const previewContent = page.locator(".preview-content");
  await expect(previewContent).toBeVisible();

  // Wait for the markdown image to load
  const mdImg = previewContent.locator('img[alt="Test"]');
  await expect(mdImg).toBeVisible();

  // Wait for the image to actually load (naturalWidth > 0)
  await mdImg.evaluate((img: HTMLImageElement) =>
    img.complete
      ? Promise.resolve()
      : new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
        })
  );

  const naturalWidth = await mdImg.evaluate((img: HTMLImageElement) => img.naturalWidth);
  expect(naturalWidth).toBeGreaterThan(0);
});

// ---------------------------------------------------------------------------
// 55. Inline images — external https:// images are not rewritten
// ---------------------------------------------------------------------------

test("external https:// images are not rewritten to local-img", async () => {
  await openTestFolder();
  await selectFileByName("images.md");

  const previewContent = page.locator(".preview-content");
  await expect(previewContent).toBeVisible();

  const externalImg = previewContent.locator('img[alt="External"]');
  await expect(externalImg).toBeVisible();
  const src = await externalImg.getAttribute("src");
  expect(src).toMatch(/^https:\/\//);
});

// ---------------------------------------------------------------------------
// 56. Startup performance — app loads within budget
// ---------------------------------------------------------------------------

test("app startup completes within 5 seconds", async () => {
  // Close the default app from beforeEach
  const pid = app.process().pid;
  if (pid) process.kill(pid, "SIGKILL");

  // Measure a fresh launch with a directory argument
  const startMs = Date.now();
  app = await electron.launch({ args: ["dist/main/main.js", testDir] });
  page = await app.firstWindow();
  await page.waitForLoadState("domcontentloaded");

  // Wait for the file tree to appear (indicates initial path was processed)
  await page.waitForSelector(".file-tree", { timeout: 5000 });
  const elapsedMs = Date.now() - startMs;

  // Budget: 5 seconds covers cold Electron launch + renderer + initial scan
  expect(elapsedMs).toBeLessThan(5000);
});

// ---------------------------------------------------------------------------
// 57. Startup performance — DOM ready within 3 seconds
// ---------------------------------------------------------------------------

test("DOM is ready within 3 seconds of launch", async () => {
  // Close the default app from beforeEach
  const pid = app.process().pid;
  if (pid) process.kill(pid, "SIGKILL");

  const startMs = Date.now();
  app = await electron.launch({ args: ["dist/main/main.js"] });
  page = await app.firstWindow();
  await page.waitForLoadState("domcontentloaded");
  const elapsedMs = Date.now() - startMs;

  // Budget: 3 seconds for DOM ready (no directory scan involved)
  expect(elapsedMs).toBeLessThan(3000);
});

// ---------------------------------------------------------------------------
// 58. Inline images — protocol-relative URLs are not rewritten
// ---------------------------------------------------------------------------

test("protocol-relative image URLs are not rewritten to local-img", async () => {
  await openTestFolder();
  await selectFileByName("images.md");

  const previewContent = page.locator(".preview-content");
  await expect(previewContent).toBeVisible();

  const protoRelImg = previewContent.locator('img[alt="ProtoRel"]');
  await expect(protoRelImg).toBeVisible();
  const src = await protoRelImg.getAttribute("src");
  expect(src).toMatch(/^\/\//);
  expect(src).not.toContain("local-img");
});

// ---------------------------------------------------------------------------
// 59. Markdown ![](//host/path) protocol-relative URLs are not rewritten
// ---------------------------------------------------------------------------

test("markdown-syntax protocol-relative image URLs are not rewritten", async () => {
  await openTestFolder();
  await selectFileByName("images.md");

  const previewContent = page.locator(".preview-content");
  await expect(previewContent).toBeVisible();

  const mdProtoRelImg = previewContent.locator('img[alt="MdProtoRel"]');
  await expect(mdProtoRelImg).toBeVisible();
  const src = await mdProtoRelImg.getAttribute("src");
  expect(src).toMatch(/^\/\//);
  expect(src).not.toContain("local-img");
});

// ---------------------------------------------------------------------------
// 60. Pre-encoded markdown image URL is not double-encoded
// ---------------------------------------------------------------------------

test("markdown-syntax pre-encoded image URL is not double-encoded", async () => {
  await openTestFolder();
  await selectFileByName("images.md");

  const previewContent = page.locator(".preview-content");
  await expect(previewContent).toBeVisible();

  const encodedImg = previewContent.locator('img[alt="MdEncoded"]');
  await expect(encodedImg).toBeVisible();
  const src = await encodedImg.getAttribute("src");
  expect(src).toContain("local-img://");
  // %20 should appear (space encoded), but %2520 (double-encoded) must not
  expect(src).toContain("my%20file.png");
  expect(src).not.toContain("%2520");
});

// ---------------------------------------------------------------------------
// 61. HTML export has scrollable overflow (not clipped)
// ---------------------------------------------------------------------------

test("HTML export includes scroll override styles", async () => {
  await openTestFolder();
  await selectFileByName("README.md");

  // Mock the save dialog to write to a temp file
  const exportPath = path.join(testDir, "export-test.html");
  await app.evaluate(async ({ dialog }, savePath) => {
    dialog.showSaveDialog = async () => ({
      canceled: false,
      filePath: savePath,
    });
  }, exportPath);

  // Click the HTML export button
  await page.click('.preview-copy-btn:text-is("HTML")');

  // Wait for the file to be written
  await page.waitForTimeout(1000);

  const htmlContent = fs.readFileSync(exportPath, "utf-8");
  // The standalone override style block should be present
  expect(htmlContent).toContain("height: auto !important");
  expect(htmlContent).toContain("overflow: auto !important");
});

// ---------------------------------------------------------------------------
// 62. PDF print media forces white background on body
// ---------------------------------------------------------------------------

test("PDF print media forces white background on body even with coloured theme", async () => {
  await openTestFolder();
  await selectFileByName("README.md");

  // Apply Sepia theme (has coloured background)
  await page.click('[aria-label="Open settings"]');
  await expect(page.locator(".settings-panel")).toBeVisible();
  const sepiaSwatch = page.locator('.theme-swatch', { has: page.locator('.swatch-label:text-is("Sepia")') });
  await sepiaSwatch.click();
  await page.keyboard.press("Escape");

  // Emulate print media
  await page.emulateMedia({ media: "print" });

  // Body should be white regardless of Sepia theme
  const bodyBg = await page.locator("body").evaluate((el) =>
    getComputedStyle(el).backgroundColor
  );
  expect(bodyBg).toBe("rgb(255, 255, 255)");
});

// ---------------------------------------------------------------------------
// 63. DOCX export embeds images as base64 (no file:// references)
// ---------------------------------------------------------------------------

test("DOCX export embeds images as base64 data URIs", async () => {
  await openTestFolder();
  await selectFileByName("images.md");

  // Wait for preview to render
  await expect(page.locator(".preview-content")).toBeVisible();

  // Mock the save dialog
  const exportPath = path.join(testDir, "export-test.docx");
  await app.evaluate(async ({ dialog }, savePath) => {
    dialog.showSaveDialog = async () => ({
      canceled: false,
      filePath: savePath,
    });
  }, exportPath);

  // Click the DOCX export button
  await page.click('.preview-copy-btn:text-is("DOCX")');

  // Wait for the file to be written
  await page.waitForTimeout(2000);

  // DOCX from html-docx-js is a ZIP containing word/afchunk.mht.
  // html-docx-js converts data: URIs into MHTML multipart boundaries with
  // synthetic Content-Location headers (file:///C:/fake/...), so the final
  // MHT won't contain literal "data:image/png;base64," strings. Instead
  // verify: (1) the base64 image bytes are embedded, (2) no real filesystem
  // file:// URLs survive (only the synthetic C:/fake/ ones from html-docx-js).
  const { execSync } = require("child_process");
  const mhtContent = execSync(`unzip -p "${exportPath}" word/afchunk.mht`, { encoding: "utf-8" });
  // PNG base64 starts with iVBORw0KGgo (magic bytes 0x89504e47)
  expect(mhtContent).toContain("iVBORw0KGgo");
  // No real filesystem paths — only html-docx-js synthetic C:/fake/ paths allowed
  const realFileUrls = mhtContent.match(/file:\/\/[^"'\s\r\n]+/g) || [];
  const leakedPaths = realFileUrls.filter((u: string) => !u.includes("/C:/fake/"));
  expect(leakedPaths).toEqual([]);
});
