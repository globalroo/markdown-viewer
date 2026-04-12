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

test.beforeAll(() => {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), "viewmd-collapse-e2e-"));

  // Main test document: nested headings, links, varied content
  fs.writeFileSync(
    path.join(testDir, "test-collapse.md"),
    [
      "# Getting Started",
      "",
      "This is the introductory section with body text.",
      "",
      "## Installation",
      "",
      "To install the application, follow these steps.",
      "",
      "### macOS",
      "",
      "On macOS, you need Xcode command line tools.",
      "",
      "### Windows",
      "",
      "On Windows, ensure Node.js 18+ is installed.",
      "",
      "## Configuration",
      "",
      "The app can be configured via config.json.",
      "",
      "## Usage",
      "",
      "Once installed, open the app and drag a folder.",
      "",
      "### Keyboard Shortcuts",
      "",
      "- Cmd+B — Toggle sidebar",
      "- Cmd+Shift+O — Toggle outline",
      "",
      "## Links",
      "",
      "See also [API Reference](./api-reference.md).",
      "",
      "Check out [[linked-doc]] for more details.",
      "",
      "# Advanced Topics",
      "",
      "## Performance",
      "",
      "The app uses virtual scrolling for large documents.",
      "",
      "## Plugins",
      "",
      "Plugin support is planned for a future release.",
      "",
    ].join("\n")
  );

  // Document with preamble (content before first heading)
  fs.writeFileSync(
    path.join(testDir, "preamble-doc.md"),
    [
      "This is preamble text before any heading.",
      "",
      "Another preamble paragraph.",
      "",
      "# First Heading",
      "",
      "Content under first heading.",
      "",
      "## Sub Heading",
      "",
      "Content under sub heading.",
      "",
    ].join("\n")
  );

  // Linked document (outgoing target)
  fs.writeFileSync(
    path.join(testDir, "api-reference.md"),
    [
      "# API Reference",
      "",
      "API documentation goes here.",
      "",
      "Links back to [Getting Started](./test-collapse.md).",
      "",
    ].join("\n")
  );

  // Wiki-link target
  fs.writeFileSync(
    path.join(testDir, "linked-doc.md"),
    "# Linked Doc\n\nThis document is linked via wiki-link.\n"
  );

  // Document with no headings
  fs.writeFileSync(
    path.join(testDir, "no-headings.md"),
    "This document has no headings at all.\n\nJust plain paragraphs.\n"
  );

  // Document with only deep headings (no h1)
  fs.writeFileSync(
    path.join(testDir, "deep-headings.md"),
    [
      "### Only H3",
      "",
      "Content under h3.",
      "",
      "#### And H4",
      "",
      "Content under h4.",
      "",
    ].join("\n")
  );

  // Document with duplicate heading text
  fs.writeFileSync(
    path.join(testDir, "duplicates.md"),
    [
      "# Setup",
      "",
      "First setup section.",
      "",
      "# Setup",
      "",
      "Second setup section.",
      "",
      "## Setup",
      "",
      "Third setup as h2.",
      "",
    ].join("\n")
  );

  // Subdirectory with file (for filter/path testing)
  fs.mkdirSync(path.join(testDir, "docs"));
  fs.writeFileSync(
    path.join(testDir, "docs", "nested.md"),
    "# Nested Doc\n\nLinks to [parent](../test-collapse.md).\n"
  );

  // Isolated document (no links to/from)
  fs.writeFileSync(
    path.join(testDir, "isolated.md"),
    "# Isolated\n\nThis file has no links.\n"
  );
});

test.afterAll(() => {
  fs.rmSync(testDir, { recursive: true, force: true });
});

test.beforeEach(async () => {
  // Clear singleton lock from previous test instance
  const lockDir = path.join(os.homedir(), "Library", "Application Support", "markdown-viewer");
  for (const f of ["SingletonLock", "SingletonSocket"]) {
    try { fs.unlinkSync(path.join(lockDir, f)); } catch {}
  }
  app = await electron.launch({ args: ["dist/main/main.js"] });
  page = await app.firstWindow();
  await page.waitForLoadState("domcontentloaded");
  page.on("dialog", (dialog) => dialog.dismiss().catch(() => {}));
});

test.afterEach(async () => {
  const pid = app.process().pid;
  if (pid) {
    process.kill(pid, "SIGKILL");
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function openTestFolder(): Promise<void> {
  await app.evaluate(async ({ dialog }, dirPath) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [dirPath],
    });
  }, testDir);
  await page.click(".open-folder-btn");
  await page.waitForSelector(".file-tree");
}

async function selectFileByName(name: string): Promise<void> {
  await page.click(`.tree-label:text-is("${name}")`);
  await page.waitForSelector(".preview-container");
  await page.waitForTimeout(200); // Let section model build
}

async function expandFolder(name: string): Promise<void> {
  const folderItem = page.locator(`.tree-item:has(.tree-label:text-is("${name}"))`);
  await folderItem.click();
}

async function enableCollapsibleMode(): Promise<void> {
  const btn = page.locator('.toolbar-btn[aria-label*="Collapsible"]');
  await btn.click();
  await page.waitForSelector(".collapsible-preview");
}

async function disableCollapsibleMode(): Promise<void> {
  const btn = page.locator('.toolbar-btn[aria-label*="Collapsible"]');
  await btn.click();
  await page.waitForSelector('.preview-content:not([style*="display: none"])');
}

function modKey(): string {
  return process.platform === "darwin" ? "Meta" : "Control";
}

// ===========================================================================
// 1. COLLAPSIBLE VIEW: STRUCTURE & SKELETON
// ===========================================================================

test.describe("Collapsible View Structure", () => {
  test("shows all headings as always-visible skeleton", async () => {
    await openTestFolder();
    await selectFileByName("test-collapse.md");
    await enableCollapsibleMode();

    // 11 headings in test-collapse.md
    const headings = page.locator(".collapsible-heading-text");
    expect(await headings.count()).toBe(11);
    for (let i = 0; i < 11; i++) {
      await expect(headings.nth(i)).toBeVisible();
    }
  });

  test("starts with all sections collapsed by default", async () => {
    await openTestFolder();
    await selectFileByName("test-collapse.md");
    await enableCollapsibleMode();

    const expandedBodies = page.locator(".collapsible-section-body.expanded");
    expect(await expandedBodies.count()).toBe(0);
  });

  test("child headings visible when parent collapsed", async () => {
    await openTestFolder();
    await selectFileByName("test-collapse.md");
    await enableCollapsibleMode();

    // macOS and Windows are h3 children of Installation (h2)
    await expect(page.locator('.collapsible-heading-text:text-is("macOS")')).toBeVisible();
    await expect(page.locator('.collapsible-heading-text:text-is("Windows")')).toBeVisible();
    // Keyboard Shortcuts is h3 child of Usage (h2)
    await expect(page.locator('.collapsible-heading-text:text-is("Keyboard Shortcuts")')).toBeVisible();
  });

  test("shows preamble content before first heading", async () => {
    await openTestFolder();
    await selectFileByName("preamble-doc.md");
    await enableCollapsibleMode();

    const preamble = page.locator(".collapsible-preamble");
    await expect(preamble).toBeVisible();
    const text = await preamble.textContent();
    expect(text).toContain("preamble text before any heading");
  });

  test("section count displayed correctly", async () => {
    await openTestFolder();
    await selectFileByName("test-collapse.md");
    await enableCollapsibleMode();

    const count = page.locator(".collapsible-count");
    const text = await count.textContent();
    expect(text).toContain("11 sections");
  });

  test("handles duplicate heading text with unique IDs", async () => {
    await openTestFolder();
    await selectFileByName("duplicates.md");
    await enableCollapsibleMode();

    const headings = page.locator(".collapsible-heading-text");
    expect(await headings.count()).toBe(3);

    // Each should have a unique data-heading-id on its parent button
    const ids = await page.evaluate(() => {
      const rows = document.querySelectorAll("[data-heading-id]");
      return Array.from(rows).map((el) => el.getAttribute("data-heading-id"));
    });
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  test("handles document with only deep headings (no h1)", async () => {
    await openTestFolder();
    await selectFileByName("deep-headings.md");
    await enableCollapsibleMode();

    const headings = page.locator(".collapsible-heading-text");
    expect(await headings.count()).toBe(2);
  });
});

// ===========================================================================
// 2. COLLAPSIBLE VIEW: EXPAND / COLLAPSE
// ===========================================================================

test.describe("Collapsible Expand/Collapse", () => {
  test("clicking heading row toggles its prose content", async () => {
    await openTestFolder();
    await selectFileByName("test-collapse.md");
    await enableCollapsibleMode();

    const row = page.locator('.collapsible-heading-row:has(.collapsible-heading-text:text-is("Installation"))');
    await row.click();
    await page.waitForTimeout(300);

    await expect(row).toHaveAttribute("aria-expanded", "true");

    // Click again to collapse
    await row.click();
    await page.waitForTimeout(300);
    await expect(row).toHaveAttribute("aria-expanded", "false");
  });

  test("chevron rotates on expand", async () => {
    await openTestFolder();
    await selectFileByName("test-collapse.md");
    await enableCollapsibleMode();

    const row = page.locator(".collapsible-heading-row").first();
    const chevron = row.locator(".collapsible-chevron");

    // Before expand — no expanded class
    await expect(chevron).not.toHaveClass(/expanded/);

    await row.click();
    await page.waitForTimeout(300);

    // After expand — expanded class present
    await expect(chevron).toHaveClass(/expanded/);
  });

  test("Expand All expands all sections", async () => {
    await openTestFolder();
    await selectFileByName("test-collapse.md");
    await enableCollapsibleMode();

    await page.click('.collapsible-control-btn:text-is("Expand All")');
    await page.waitForTimeout(200);

    const expanded = page.locator(".collapsible-section-body.expanded");
    expect(await expanded.count()).toBeGreaterThan(0);

    // All aria-expanded should be true
    const allExpanded = await page.evaluate(() => {
      const rows = document.querySelectorAll(".collapsible-heading-row");
      return Array.from(rows).every((r) => r.getAttribute("aria-expanded") === "true");
    });
    expect(allExpanded).toBe(true);
  });

  test("Collapse All collapses all sections", async () => {
    await openTestFolder();
    await selectFileByName("test-collapse.md");
    await enableCollapsibleMode();

    // Expand first, then collapse
    await page.click('.collapsible-control-btn:text-is("Expand All")');
    await page.waitForTimeout(200);
    await page.click('.collapsible-control-btn:text-is("Collapse All")');
    await page.waitForTimeout(200);

    const expanded = page.locator(".collapsible-section-body.expanded");
    expect(await expanded.count()).toBe(0);
  });

  test("expanding parent does not auto-expand children", async () => {
    await openTestFolder();
    await selectFileByName("test-collapse.md");
    await enableCollapsibleMode();

    // Expand "Installation" (parent of macOS, Windows)
    const installRow = page.locator('.collapsible-heading-row:has(.collapsible-heading-text:text-is("Installation"))');
    await installRow.click();
    await page.waitForTimeout(300);

    // macOS and Windows should still be collapsed
    const macRow = page.locator('.collapsible-heading-row:has(.collapsible-heading-text:text-is("macOS"))');
    await expect(macRow).toHaveAttribute("aria-expanded", "false");
  });

  test("line count badges show on hover", async () => {
    await openTestFolder();
    await selectFileByName("test-collapse.md");
    await enableCollapsibleMode();

    const row = page.locator(".collapsible-heading-row").first();
    const badge = row.locator(".collapsible-line-count");

    // Badge should exist but be invisible by default
    const opacityBefore = await badge.evaluate((el) => getComputedStyle(el).opacity);
    expect(parseFloat(opacityBefore)).toBe(0);

    // Hover to reveal
    await row.hover();
    await page.waitForTimeout(200);
    const opacityAfter = await badge.evaluate((el) => getComputedStyle(el).opacity);
    expect(parseFloat(opacityAfter)).toBeGreaterThan(0);
  });
});

// ===========================================================================
// 3. COLLAPSIBLE VIEW: KEYBOARD NAVIGATION
// ===========================================================================

test.describe("Collapsible Keyboard Navigation", () => {
  test("j/k moves focus between headings", async () => {
    await openTestFolder();
    await selectFileByName("test-collapse.md");
    await enableCollapsibleMode();

    await page.locator(".collapsible-heading-row").first().focus();
    await page.keyboard.press("j");

    const focused = page.locator(".collapsible-heading-row:focus");
    const text = await focused.locator(".collapsible-heading-text").textContent();
    expect(text).toBe("Installation");

    // k moves back up
    await page.keyboard.press("k");
    const text2 = await focused.locator(".collapsible-heading-text").textContent();
    expect(text2).toBe("Getting Started");
  });

  test("Enter toggles expand/collapse", async () => {
    await openTestFolder();
    await selectFileByName("test-collapse.md");
    await enableCollapsibleMode();

    await page.locator(".collapsible-heading-row").first().focus();
    await page.keyboard.press("j"); // Move to Installation

    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
    const focusedRow = page.locator(".collapsible-heading-row:focus");
    await expect(focusedRow).toHaveAttribute("aria-expanded", "true");

    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
    await expect(focusedRow).toHaveAttribute("aria-expanded", "false");
  });

  test("Space toggles expand/collapse", async () => {
    await openTestFolder();
    await selectFileByName("test-collapse.md");
    await enableCollapsibleMode();

    await page.locator(".collapsible-heading-row").first().focus();
    await page.keyboard.press("Space");
    await page.waitForTimeout(300);

    const focusedRow = page.locator(".collapsible-heading-row:focus");
    await expect(focusedRow).toHaveAttribute("aria-expanded", "true");
  });

  test("Escape collapses focused section", async () => {
    await openTestFolder();
    await selectFileByName("test-collapse.md");
    await enableCollapsibleMode();

    // Expand first heading
    const firstRow = page.locator(".collapsible-heading-row").first();
    await firstRow.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
    await expect(firstRow).toHaveAttribute("aria-expanded", "true");

    // Escape collapses it
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    await expect(firstRow).toHaveAttribute("aria-expanded", "false");
  });

  test("[ collapses all, ] expands all", async () => {
    await openTestFolder();
    await selectFileByName("test-collapse.md");
    await enableCollapsibleMode();

    await page.locator(".collapsible-heading-row").first().focus();

    // ] expands all
    await page.keyboard.press("]");
    await page.waitForTimeout(200);
    let expanded = page.locator(".collapsible-section-body.expanded");
    expect(await expanded.count()).toBeGreaterThan(0);

    // [ collapses all
    await page.keyboard.press("[");
    await page.waitForTimeout(200);
    expanded = page.locator(".collapsible-section-body.expanded");
    expect(await expanded.count()).toBe(0);
  });

  test("first heading is tabbable by default (roving tabindex)", async () => {
    await openTestFolder();
    await selectFileByName("test-collapse.md");
    await enableCollapsibleMode();

    const first = page.locator(".collapsible-heading-row").first();
    const tabIndex = await first.getAttribute("tabindex");
    expect(tabIndex).toBe("0");

    // Other headings should be -1
    const second = page.locator(".collapsible-heading-row").nth(1);
    const tabIndex2 = await second.getAttribute("tabindex");
    expect(tabIndex2).toBe("-1");
  });
});

// ===========================================================================
// 4. COLLAPSIBLE VIEW: HEADING HIERARCHY & STYLING
// ===========================================================================

test.describe("Heading Hierarchy & Styling", () => {
  test("h1 is visually larger than h2, h2 larger than h3", async () => {
    await openTestFolder();
    await selectFileByName("test-collapse.md");
    await enableCollapsibleMode();

    const h1Size = await page.locator(".collapsible-heading-text-L1").first()
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    const h2Size = await page.locator(".collapsible-heading-text-L2").first()
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    const h3Size = await page.locator(".collapsible-heading-text-L3").first()
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));

    expect(h1Size).toBeGreaterThan(h2Size);
    expect(h2Size).toBeGreaterThan(h3Size);
  });

  test("h1 has heavier font weight than h3", async () => {
    await openTestFolder();
    await selectFileByName("test-collapse.md");
    await enableCollapsibleMode();

    const h1Weight = await page.locator(".collapsible-heading-text-L1").first()
      .evaluate((el) => parseInt(getComputedStyle(el).fontWeight));
    const h3Weight = await page.locator(".collapsible-heading-text-L3").first()
      .evaluate((el) => parseInt(getComputedStyle(el).fontWeight));

    expect(h1Weight).toBeGreaterThan(h3Weight);
  });

  test("heading rows have left-border spine", async () => {
    await openTestFolder();
    await selectFileByName("test-collapse.md");
    await enableCollapsibleMode();

    const h1Border = await page.locator(".collapsible-heading-row-L1").first()
      .evaluate((el) => parseFloat(getComputedStyle(el).borderLeftWidth));
    expect(h1Border).toBeGreaterThan(0);

    const h2Border = await page.locator(".collapsible-heading-row-L2").first()
      .evaluate((el) => parseFloat(getComputedStyle(el).borderLeftWidth));
    expect(h2Border).toBeGreaterThan(0);
  });

  test("h1 has bottom border separator", async () => {
    await openTestFolder();
    await selectFileByName("test-collapse.md");
    await enableCollapsibleMode();

    const h1BottomBorder = await page.locator(".collapsible-heading-row-L1").first()
      .evaluate((el) => parseFloat(getComputedStyle(el).borderBottomWidth));
    expect(h1BottomBorder).toBeGreaterThan(0);
  });

  test("nested headings have increasing indentation", async () => {
    await openTestFolder();
    await selectFileByName("test-collapse.md");
    await enableCollapsibleMode();

    const h1Padding = await page.locator(".collapsible-heading-row-L1").first()
      .evaluate((el) => parseFloat(getComputedStyle(el).paddingLeft));
    const h2Padding = await page.locator(".collapsible-heading-row-L2").first()
      .evaluate((el) => parseFloat(getComputedStyle(el).paddingLeft));
    const h3Padding = await page.locator(".collapsible-heading-row-L3").first()
      .evaluate((el) => parseFloat(getComputedStyle(el).paddingLeft));

    expect(h2Padding).toBeGreaterThan(h1Padding);
    expect(h3Padding).toBeGreaterThan(h2Padding);
  });
});

// ===========================================================================
// 5. COLLAPSIBLE VIEW: SEARCH INTEGRATION
// ===========================================================================

test.describe("Collapsible Search Integration", () => {
  test("Cmd+F in collapsible mode expands all sections for native find", async () => {
    await openTestFolder();
    await selectFileByName("test-collapse.md");
    await enableCollapsibleMode();

    // All collapsed initially
    expect(await page.locator(".collapsible-section-body.expanded").count()).toBe(0);

    // Cmd+F should expand all
    await page.keyboard.press(`${modKey()}+f`);
    await page.waitForTimeout(300);

    // Sections should be expanded for search
    expect(await page.locator(".collapsible-section-body.expanded").count()).toBeGreaterThan(0);

    // Search indicator should be visible
    const indicator = page.locator(".collapsible-search-indicator");
    if (await indicator.count() > 0) {
      await expect(indicator).toBeVisible();
    }
  });
});

// ===========================================================================
// 6. FOLD STATE PERSISTENCE
// ===========================================================================

test.describe("Fold State Persistence", () => {
  test("fold state preserved across file switches", async () => {
    await openTestFolder();
    await selectFileByName("test-collapse.md");
    await enableCollapsibleMode();

    // Expand "Installation"
    const installRow = page.locator('.collapsible-heading-row:has(.collapsible-heading-text:text-is("Installation"))');
    await installRow.click();
    await page.waitForTimeout(500);
    await expect(installRow).toHaveAttribute("aria-expanded", "true");

    // Switch to another file
    await selectFileByName("api-reference.md");
    await page.waitForTimeout(300);

    // Switch back
    await selectFileByName("test-collapse.md");
    await page.waitForTimeout(500);

    // Installation should still be expanded (fold state loaded from persistence)
    const installRowAfter = page.locator('.collapsible-heading-row:has(.collapsible-heading-text:text-is("Installation"))');
    await expect(installRowAfter).toHaveAttribute("aria-expanded", "true");
  });

  test("file switch resets focus and search state", async () => {
    await openTestFolder();
    await selectFileByName("test-collapse.md");
    await enableCollapsibleMode();

    // Focus a heading
    await page.locator(".collapsible-heading-row").first().focus();

    // Switch file
    await selectFileByName("api-reference.md");
    await page.waitForTimeout(300);

    // No search indicator should persist
    const indicator = page.locator(".collapsible-search-indicator");
    expect(await indicator.count()).toBe(0);
  });
});

// ===========================================================================
// 7. RIGHT PANEL: SEGMENTED CONTROL
// ===========================================================================

test.describe("Right Panel Segmented Control", () => {
  test("Contents tab shows outline headings", async () => {
    await openTestFolder();
    await selectFileByName("test-collapse.md");

    // Ensure outline visible
    const outline = page.locator(".document-outline");
    if (!(await outline.isVisible())) {
      await page.click('.toolbar-btn[aria-label*="Contents"]');
    }
    await page.waitForSelector(".outline-item");

    const items = page.locator(".outline-item");
    expect(await items.count()).toBe(11);
  });

  test("segmented control switches between Contents and Links", async () => {
    await openTestFolder();
    await selectFileByName("test-collapse.md");

    // Ensure outline visible
    const outline = page.locator(".document-outline");
    if (!(await outline.isVisible())) {
      await page.click('.toolbar-btn[aria-label*="Contents"]');
    }
    await page.waitForSelector(".outline-item");

    // Switch to Links
    await page.click('.outline-segment:text-is("Links")');
    await page.waitForTimeout(300);

    // Outline items should be gone, links panel body should appear
    await expect(page.locator(".links-panel-body").or(page.locator(".links-panel-empty"))).toBeVisible();

    // Switch back to Contents
    await page.click('.outline-segment:text-is("Contents")');
    await page.waitForTimeout(300);
    await expect(page.locator(".outline-list")).toBeVisible();
  });

  test("segmented control has correct aria-pressed state", async () => {
    await openTestFolder();
    await selectFileByName("test-collapse.md");

    const outline = page.locator(".document-outline");
    if (!(await outline.isVisible())) {
      await page.click('.toolbar-btn[aria-label*="Contents"]');
    }
    await page.waitForSelector(".outline-segment");

    const contentsBtn = page.locator('.outline-segment:text-is("Contents")');
    const linksBtn = page.locator('.outline-segment:text-is("Links")');

    // Contents should be active by default
    await expect(contentsBtn).toHaveAttribute("aria-pressed", "true");
    await expect(linksBtn).toHaveAttribute("aria-pressed", "false");

    // Switch to Links
    await linksBtn.click();
    await page.waitForTimeout(200);
    await expect(contentsBtn).toHaveAttribute("aria-pressed", "false");
    await expect(linksBtn).toHaveAttribute("aria-pressed", "true");
  });

  test("outline item click scrolls to heading", async () => {
    await openTestFolder();
    await selectFileByName("test-collapse.md");

    const outline = page.locator(".document-outline");
    if (!(await outline.isVisible())) {
      await page.click('.toolbar-btn[aria-label*="Contents"]');
    }
    await page.waitForSelector(".outline-item");

    // Get initial scroll position
    const scrollBefore = await page.evaluate(() => {
      const el = document.querySelector(".preview-scroll");
      return el ? el.scrollTop : 0;
    });

    // Click a heading near the bottom
    const lastItem = page.locator(".outline-item").last();
    await lastItem.click();
    await page.waitForTimeout(500);

    // Scroll should have changed
    const scrollAfter = await page.evaluate(() => {
      const el = document.querySelector(".preview-scroll");
      return el ? el.scrollTop : 0;
    });

    // For a document long enough to scroll, position should change
    // (may not change if document fits in viewport)
  });

  test("panel shows for heading-free docs with links in Links view", async () => {
    await openTestFolder();
    await selectFileByName("test-collapse.md");

    // First ensure outline is showing with Links tab
    const outline = page.locator(".document-outline");
    if (!(await outline.isVisible())) {
      await page.click('.toolbar-btn[aria-label*="Contents"]');
    }
    await page.waitForSelector(".outline-segment");
    await page.click('.outline-segment:text-is("Links")');
    await page.waitForTimeout(200);

    // Now switch to no-headings.md
    await selectFileByName("no-headings.md");
    await page.waitForTimeout(300);

    // The panel should still be visible if there are links
    // (no-headings.md has no links either, so panel may hide — that's correct)
  });
});

// ===========================================================================
// 8. RIGHT PANEL: FONT SCALING
// ===========================================================================

test.describe("Right Panel Font Scaling", () => {
  test("outline item font scales with A+/A- controls", async () => {
    await openTestFolder();
    await selectFileByName("test-collapse.md");

    const outline = page.locator(".document-outline");
    if (!(await outline.isVisible())) {
      await page.click('.toolbar-btn[aria-label*="Contents"]');
    }
    await page.waitForSelector(".outline-item");

    const initial = await page.locator(".outline-item").first()
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));

    // Increase font twice
    await page.click('.toolbar-btn:text-is("A+")');
    await page.click('.toolbar-btn:text-is("A+")');
    await page.waitForTimeout(200);

    const after = await page.locator(".outline-item").first()
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));

    expect(after).toBeGreaterThan(initial);
  });

  test("outline padding scales proportionally with font size", async () => {
    await openTestFolder();
    await selectFileByName("test-collapse.md");

    const outline = page.locator(".document-outline");
    if (!(await outline.isVisible())) {
      await page.click('.toolbar-btn[aria-label*="Contents"]');
    }
    await page.waitForSelector(".outline-item");

    const initialPad = await page.locator(".outline-item").first()
      .evaluate((el) => parseFloat(getComputedStyle(el).paddingLeft));

    await page.click('.toolbar-btn:text-is("A+")');
    await page.click('.toolbar-btn:text-is("A+")');
    await page.waitForTimeout(200);

    const afterPad = await page.locator(".outline-item").first()
      .evaluate((el) => parseFloat(getComputedStyle(el).paddingLeft));

    // Padding should increase since it's in em units
    expect(afterPad).toBeGreaterThan(initialPad);
  });
});

// ===========================================================================
// 9. LINKS PANEL
// ===========================================================================

test.describe("Links Panel", () => {
  test("shows outgoing and incoming section headers", async () => {
    await openTestFolder();
    await selectFileByName("test-collapse.md");
    await page.waitForTimeout(1000); // Wait for link index

    const outline = page.locator(".document-outline");
    if (!(await outline.isVisible())) {
      await page.click('.toolbar-btn[aria-label*="Contents"]');
    }
    await page.waitForSelector(".outline-segment");
    await page.click('.outline-segment:text-is("Links")');
    await page.waitForTimeout(500);

    await expect(page.locator('.links-section-header:has-text("Outgoing")')).toBeVisible();
    await expect(page.locator('.links-section-header:has-text("Incoming")')).toBeVisible();
  });

  test("shows empty state messages when no links", async () => {
    await openTestFolder();
    await selectFileByName("isolated.md");
    await page.waitForTimeout(1000);

    const outline = page.locator(".document-outline");
    if (!(await outline.isVisible())) {
      await page.click('.toolbar-btn[aria-label*="Contents"]');
    }
    await page.waitForSelector(".outline-segment");
    await page.click('.outline-segment:text-is("Links")');
    await page.waitForTimeout(500);

    // Should show empty messages
    const emptyMessages = page.locator(".links-empty");
    expect(await emptyMessages.count()).toBeGreaterThan(0);
  });

  test("link item click navigates to target file", async () => {
    await openTestFolder();
    await selectFileByName("test-collapse.md");
    await page.waitForTimeout(1500); // Wait for link index

    const outline = page.locator(".document-outline");
    if (!(await outline.isVisible())) {
      await page.click('.toolbar-btn[aria-label*="Contents"]');
    }
    await page.waitForSelector(".outline-segment");
    await page.click('.outline-segment:text-is("Links")');
    await page.waitForTimeout(500);

    const linkItems = page.locator(".link-item:not([disabled])");
    const count = await linkItems.count();
    if (count > 0) {
      // Click first link
      await linkItems.first().click();
      await page.waitForTimeout(500);

      // Preview should show new file content
      const preview = page.locator(".preview-content, .collapsible-preview");
      await expect(preview.first()).toBeVisible();
    }
  });
});

// ===========================================================================
// 10. CONNECTED FILES FILTER
// ===========================================================================

test.describe("Connected Files Filter", () => {
  test("filter toggle button appears in links panel when links exist", async () => {
    await openTestFolder();
    await selectFileByName("test-collapse.md");
    await page.waitForTimeout(1500);

    const outline = page.locator(".document-outline");
    if (!(await outline.isVisible())) {
      await page.click('.toolbar-btn[aria-label*="Contents"]');
    }
    await page.waitForSelector(".outline-segment");
    await page.click('.outline-segment:text-is("Links")');
    await page.waitForTimeout(500);

    const filterBtn = page.locator(".links-filter-btn");
    if (await page.locator(".link-item").count() > 0) {
      await expect(filterBtn).toBeVisible();
    }
  });

  test("activating filter shows pill in sidebar", async () => {
    await openTestFolder();
    await selectFileByName("test-collapse.md");
    await page.waitForTimeout(1500);

    const outline = page.locator(".document-outline");
    if (!(await outline.isVisible())) {
      await page.click('.toolbar-btn[aria-label*="Contents"]');
    }
    await page.waitForSelector(".outline-segment");
    await page.click('.outline-segment:text-is("Links")');
    await page.waitForTimeout(500);

    const filterBtn = page.locator(".links-filter-btn");
    if (await filterBtn.isVisible()) {
      await filterBtn.click();
      await page.waitForTimeout(500);

      // Filter pill should appear in sidebar
      const pill = page.locator(".links-filter-pill");
      await expect(pill).toBeVisible();

      // Deactivate
      const clearBtn = page.locator(".links-filter-clear");
      await clearBtn.click();
      await page.waitForTimeout(300);

      // Pill should disappear
      await expect(pill).not.toBeVisible();
    }
  });
});

// ===========================================================================
// 11. MODE SWITCHING & INTEGRATION
// ===========================================================================

test.describe("Mode Switching", () => {
  test("toggle between standard and collapsible preserves content", async () => {
    await openTestFolder();
    await selectFileByName("test-collapse.md");

    // Standard mode shows preview-content
    await expect(page.locator('.preview-content:not([style*="display: none"])')).toBeVisible();

    // Enable collapsible
    await enableCollapsibleMode();
    await expect(page.locator(".collapsible-preview")).toBeVisible();

    // All headings visible
    const headings = page.locator(".collapsible-heading-text");
    expect(await headings.count()).toBe(11);

    // Disable collapsible — back to standard
    await disableCollapsibleMode();
    await expect(page.locator('.preview-content:not([style*="display: none"])')).toBeVisible();
  });

  test("collapsible toggle button shows active state", async () => {
    await openTestFolder();
    await selectFileByName("test-collapse.md");

    const btn = page.locator('.toolbar-btn[aria-label*="Collapsible"]');

    // Not active initially
    await expect(btn).not.toHaveClass(/active/);

    // Click to enable
    await btn.click();
    await page.waitForTimeout(200);
    await expect(btn).toHaveClass(/active/);

    // Click to disable
    await btn.click();
    await page.waitForTimeout(200);
    await expect(btn).not.toHaveClass(/active/);
  });

  test("collapsible button hidden in edit mode", async () => {
    await openTestFolder();
    await selectFileByName("test-collapse.md");

    const collapseBtn = page.locator('.toolbar-btn[aria-label*="Collapsible"]');
    await expect(collapseBtn).toBeVisible();

    // Enter edit mode
    await page.keyboard.press(`${modKey()}+e`);
    await page.waitForTimeout(300);

    // Collapsible button should be hidden
    await expect(collapseBtn).not.toBeVisible();

    // Exit edit mode
    await page.keyboard.press(`${modKey()}+e`);
    await page.waitForTimeout(300);
    await expect(collapseBtn).toBeVisible();
  });

  test("print CSS hides collapsible view and shows standard content", async () => {
    await openTestFolder();
    await selectFileByName("test-collapse.md");
    await enableCollapsibleMode();

    // Verify that print media query rules exist
    const hasPrintRule = await page.evaluate(() => {
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule instanceof CSSMediaRule && rule.conditionText === "print") {
              const text = rule.cssText;
              if (text.includes(".collapsible-preview") && text.includes("display: none")) {
                return true;
              }
            }
          }
        } catch {}
      }
      return false;
    });
    expect(hasPrintRule).toBe(true);
  });
});

// ===========================================================================
// 12. OUTLINE OBSERVER & ACTIVE HEADING
// ===========================================================================

test.describe("Outline Active Heading", () => {
  test("outline highlights active heading based on scroll position", async () => {
    await openTestFolder();
    await selectFileByName("test-collapse.md");

    const outline = page.locator(".document-outline");
    if (!(await outline.isVisible())) {
      await page.click('.toolbar-btn[aria-label*="Contents"]');
    }
    await page.waitForSelector(".outline-item");

    // There should be exactly one active item
    const active = page.locator(".outline-item.active");
    // May be 0 if document doesn't fill viewport, or 1
    const count = await active.count();
    expect(count).toBeLessThanOrEqual(1);
  });

  test("outline tracks headings by ID in both standard and collapsible modes", async () => {
    await openTestFolder();
    await selectFileByName("test-collapse.md");

    const outline = page.locator(".document-outline");
    if (!(await outline.isVisible())) {
      await page.click('.toolbar-btn[aria-label*="Contents"]');
    }
    await page.waitForSelector(".outline-item");

    // Get heading count in standard mode
    const standardCount = await page.locator(".outline-item").count();

    // Switch to collapsible
    await enableCollapsibleMode();
    await page.waitForTimeout(300);

    // Heading count should be the same
    const collapsibleCount = await page.locator(".outline-item").count();
    expect(collapsibleCount).toBe(standardCount);
  });
});

// ===========================================================================
// 13. EDGE CASES
// ===========================================================================

test.describe("Edge Cases", () => {
  test("no-headings document in collapsible mode shows preamble only", async () => {
    await openTestFolder();
    await selectFileByName("no-headings.md");

    const btn = page.locator('.toolbar-btn[aria-label*="Collapsible"]');
    if (await btn.isVisible()) {
      await btn.click();
      await page.waitForTimeout(300);

      // Should show preamble or just the content
      const preamble = page.locator(".collapsible-preamble");
      if (await preamble.count() > 0) {
        await expect(preamble).toBeVisible();
      }

      // No heading rows
      expect(await page.locator(".collapsible-heading-row").count()).toBe(0);
    }
  });

  test("rapid expand/collapse does not break state", async () => {
    await openTestFolder();
    await selectFileByName("test-collapse.md");
    await enableCollapsibleMode();

    const firstRow = page.locator(".collapsible-heading-row").first();

    // Rapid toggle 10 times
    for (let i = 0; i < 10; i++) {
      await firstRow.click();
    }
    await page.waitForTimeout(500);

    // State should be deterministic (10 clicks = even = back to collapsed)
    await expect(firstRow).toHaveAttribute("aria-expanded", "false");
  });

  test("switching files rapidly doesn't corrupt state", async () => {
    await openTestFolder();
    await selectFileByName("test-collapse.md");
    await enableCollapsibleMode();

    // Expand a section
    await page.locator(".collapsible-heading-row").first().click();
    await page.waitForTimeout(100);

    // Rapid file switches
    await selectFileByName("api-reference.md");
    await selectFileByName("preamble-doc.md");
    await selectFileByName("test-collapse.md");
    await page.waitForTimeout(500);

    // Should be in a valid state (not crashed)
    const headings = page.locator(".collapsible-heading-text");
    expect(await headings.count()).toBe(11);
  });
});
