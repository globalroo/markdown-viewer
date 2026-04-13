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

const FILE_COUNT = 15;

test.beforeAll(() => {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), "viewmd-close-tabs-e2e-"));

  // Create 15 markdown files — rich content with inter-file links, mermaid,
  // math, task lists, and wiki-links to exercise all rendering paths
  for (let i = 1; i <= FILE_COUNT; i++) {
    const prev = String(((i - 2 + FILE_COUNT) % FILE_COUNT) + 1).padStart(2, "0");
    const next = String((i % FILE_COUNT) + 1).padStart(2, "0");

    let content = [
      `# File ${i}`,
      "",
      `Content for file number ${i}.`,
      "",
      `## Navigation`,
      "",
      `Previous: [File ${prev}](./file-${prev}.md)`,
      `Next: [File ${next}](./file-${next}.md)`,
      "",
      `## Section A`,
      "",
      `Some text with a link to [another file](./file-${next}.md#section-b).`,
      "",
      `## Section B`,
      "",
      `More text. Also see [[file-${prev}]] via wiki-link.`,
      "",
    ].join("\n");

    // Every 3rd file gets a mermaid diagram
    if (i % 3 === 0) {
      content += [
        "## Diagram",
        "",
        "```mermaid",
        "stateDiagram-v2",
        "    [*] --> Active",
        "    Active --> Inactive",
        "    Inactive --> Active",
        "    Inactive --> [*]",
        "```",
        "",
      ].join("\n");
    }

    // Every other file gets a flowchart mermaid diagram
    if (i % 3 === 1) {
      content += [
        "## Flow",
        "",
        "```mermaid",
        "graph TD",
        `    A[Start] --> B{Check ${i}}`,
        "    B -->|Yes| C[OK]",
        "    B -->|No| D[Error]",
        "```",
        "",
      ].join("\n");
    }

    // Every 4th file gets a KaTeX math block
    if (i % 4 === 0) {
      content += `## Math\n\nInline: $E = mc^2$\n\n$$\\int_0^\\infty e^{-x} dx = 1$$\n\n`;
    }

    // A couple of files get task lists
    if (i === 7 || i === 14) {
      content += `## Tasks\n\n- [x] Done\n- [ ] Not done\n- [ ] Also not done\n\n`;
    }

    // Every file gets a code block (syntax highlighting)
    content += [
      "## Code",
      "",
      "```javascript",
      `function hello${i}() {`,
      `  console.log("file ${i}");`,
      "}",
      "```",
      "",
    ].join("\n");

    fs.writeFileSync(
      path.join(testDir, `file-${String(i).padStart(2, "0")}.md`),
      content
    );
  }
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
}

async function getTabCount(): Promise<number> {
  return page.locator(".tab").count();
}

async function closeActiveTab(): Promise<void> {
  const activeTab = page.locator(".tab.active .tab-close");
  await activeTab.click();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("close all tabs", () => {
  test("closing 15 tabs one by one via × button shows empty state", async () => {
    // Collect console errors
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await openTestFolder();

    // Open all 15 files as tabs
    for (let i = 1; i <= FILE_COUNT; i++) {
      await selectFileByName(`file-${String(i).padStart(2, "0")}.md`);
    }

    expect(await getTabCount()).toBe(FILE_COUNT);

    // Close tabs one by one
    for (let i = FILE_COUNT; i > 0; i--) {
      await closeActiveTab();

      if (i > 1) {
        // Still tabs open — preview should be showing
        await expect(page.locator(".preview-container")).toBeVisible({ timeout: 2000 });
        expect(await getTabCount()).toBe(i - 1);
      }
    }

    // All tabs closed — empty state should render
    await expect(page.locator(".preview-empty")).toBeVisible({ timeout: 3000 });
    await expect(page.locator(".preview-empty h2")).toHaveText("viewmd");
    await expect(page.locator(".preview-empty p")).toContainText("Select a file");

    // Toolbar should still be present
    await expect(page.locator(".toolbar")).toBeVisible();

    // Tab bar should be gone
    await expect(page.locator(".tab-bar")).not.toBeVisible();

    // No console errors during the process
    const relevant = consoleErrors.filter(
      (e) => !e.includes("Electron Security Warning")
    );
    expect(relevant).toEqual([]);
  });

  test("closing last tab in edit mode shows empty state", async () => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await openTestFolder();
    await selectFileByName("file-01.md");

    // Enter edit mode
    await page.click(".preview-mode-btn:text-is('Edit')");
    await expect(page.locator("textarea")).toBeVisible();

    // Type something to make it dirty
    await page.locator("textarea").fill("modified content");

    // Close the tab (should dismiss the dirty guard)
    await closeActiveTab();

    // Empty state should render
    await expect(page.locator(".preview-empty")).toBeVisible({ timeout: 3000 });
    await expect(page.locator(".toolbar")).toBeVisible();

    const relevant = consoleErrors.filter(
      (e) => !e.includes("Electron Security Warning")
    );
    expect(relevant).toEqual([]);
  });

  test("rapidly closing all tabs does not crash", async () => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await openTestFolder();

    // Open 10 files
    for (let i = 1; i <= 10; i++) {
      await selectFileByName(`file-${String(i).padStart(2, "0")}.md`);
    }
    expect(await getTabCount()).toBe(10);

    // Close all tabs as fast as possible (no waitForSelector between closes)
    for (let i = 0; i < 10; i++) {
      const closeBtn = page.locator(".tab.active .tab-close");
      if ((await closeBtn.count()) === 0) break;
      await closeBtn.click();
    }

    // Wait for the dust to settle
    await page.waitForTimeout(500);

    // Should show empty state, not blank screen
    await expect(page.locator(".preview-empty")).toBeVisible({ timeout: 3000 });
    await expect(page.locator(".toolbar")).toBeVisible();

    const relevant = consoleErrors.filter(
      (e) => !e.includes("Electron Security Warning")
    );
    expect(relevant).toEqual([]);
  });

  test("closing all tabs in collapsible mode shows empty state", async () => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await openTestFolder();

    // Open several files
    for (let i = 1; i <= 8; i++) {
      await selectFileByName(`file-${String(i).padStart(2, "0")}.md`);
    }

    // Switch to collapsible mode
    await page.click('[aria-label="Collapsible view off"]');
    await expect(page.locator(".collapsible-preview")).toBeVisible({ timeout: 2000 });

    // Close all tabs one by one
    for (let i = 8; i > 0; i--) {
      await closeActiveTab();
    }

    await expect(page.locator(".preview-empty")).toBeVisible({ timeout: 3000 });
    await expect(page.locator(".toolbar")).toBeVisible();

    const relevant = consoleErrors.filter(
      (e) => !e.includes("Electron Security Warning")
    );
    expect(relevant).toEqual([]);
  });

  test("closing tabs after toggling collapse states on multiple files", async () => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await openTestFolder();

    // Open 10 files
    for (let i = 1; i <= 10; i++) {
      await selectFileByName(`file-${String(i).padStart(2, "0")}.md`);
    }

    // Enable collapsible mode
    await page.click('[aria-label="Collapsible view off"]');
    await expect(page.locator(".collapsible-preview")).toBeVisible({ timeout: 2000 });

    // Browse several tabs, expand/collapse sections to build up fold state
    // File 03 (has mermaid) — collapse some sections
    await page.locator(".tab", { hasText: "file-03" }).click();
    await page.waitForTimeout(300);
    const chevrons03 = page.locator(".collapsible-heading .collapse-chevron");
    if ((await chevrons03.count()) > 1) {
      await chevrons03.nth(1).click(); // collapse second section
      await page.waitForTimeout(100);
    }

    // File 06 (has mermaid) — collapse first section
    await page.locator(".tab", { hasText: "file-06" }).click();
    await page.waitForTimeout(300);
    const chevrons06 = page.locator(".collapsible-heading .collapse-chevron");
    if ((await chevrons06.count()) > 0) {
      await chevrons06.nth(0).click();
      await page.waitForTimeout(100);
    }

    // File 09 (has mermaid) — collapse all
    await page.locator(".tab", { hasText: "file-09" }).click();
    await page.waitForTimeout(300);
    const chevronsAll = page.locator(".collapsible-heading .collapse-chevron");
    const count = await chevronsAll.count();
    for (let j = 0; j < Math.min(count, 4); j++) {
      await chevronsAll.nth(j).click();
      await page.waitForTimeout(50);
    }

    // Switch back to file-01, then start closing tabs
    await page.locator(".tab", { hasText: "file-01" }).click();
    await page.waitForTimeout(200);

    // Close all tabs
    for (let i = 10; i > 0; i--) {
      await closeActiveTab();
      if (i > 1) await page.waitForTimeout(100);
    }

    await expect(page.locator(".preview-empty")).toBeVisible({ timeout: 3000 });
    await expect(page.locator(".toolbar")).toBeVisible();

    const relevant = consoleErrors.filter(
      (e) => !e.includes("Electron Security Warning")
    );
    expect(relevant).toEqual([]);
  });

  test("closing all tabs with outline visible shows empty state", async () => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await openTestFolder();

    // Open files — these have headings so the outline will populate
    for (let i = 1; i <= 5; i++) {
      await selectFileByName(`file-${String(i).padStart(2, "0")}.md`);
    }

    // Ensure outline is visible (it should already be with headings)
    const outlinePanel = page.locator(".outline-panel");
    if (!(await outlinePanel.isVisible())) {
      await page.keyboard.press("Meta+Shift+o");
    }

    // Close all tabs
    for (let i = 5; i > 0; i--) {
      await closeActiveTab();
    }

    await expect(page.locator(".preview-empty")).toBeVisible({ timeout: 3000 });
    await expect(page.locator(".toolbar")).toBeVisible();

    const relevant = consoleErrors.filter(
      (e) => !e.includes("Electron Security Warning")
    );
    expect(relevant).toEqual([]);
  });

  test("closing tabs with collapsible mode + style check + outline active", async () => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await openTestFolder();

    // Open 10 files
    for (let i = 1; i <= 10; i++) {
      await selectFileByName(`file-${String(i).padStart(2, "0")}.md`);
    }

    // Enable collapsible mode
    await page.click('[aria-label="Collapsible view off"]');
    await expect(page.locator(".collapsible-preview")).toBeVisible({ timeout: 2000 });

    // Enable style check
    await page.click('[aria-label="Prose check off"]');

    // Close all tabs rapidly
    for (let i = 0; i < 10; i++) {
      const closeBtn = page.locator(".tab.active .tab-close");
      if ((await closeBtn.count()) === 0) break;
      await closeBtn.click();
    }

    await page.waitForTimeout(500);

    await expect(page.locator(".preview-empty")).toBeVisible({ timeout: 3000 });
    await expect(page.locator(".toolbar")).toBeVisible();

    const relevant = consoleErrors.filter(
      (e) => !e.includes("Electron Security Warning")
    );
    expect(relevant).toEqual([]);
  });

  test("kitchen sink: theme + collapsible + mermaid + links + outline, close all tabs", async () => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await openTestFolder();

    // Switch to sepia theme (non-default)
    await page.keyboard.press("Meta+,");
    await expect(page.locator(".settings-panel")).toBeVisible();
    await page.click('[aria-label="Sepia theme"]');
    await page.keyboard.press("Escape");

    // Open all 15 files (includes mermaid, math, wiki-links, task lists)
    for (let i = 1; i <= FILE_COUNT; i++) {
      await selectFileByName(`file-${String(i).padStart(2, "0")}.md`);
    }

    // Wait for mermaid diagrams to render on the active file
    await page.waitForTimeout(1000);

    // Enable collapsible mode
    await page.click('[aria-label="Collapsible view off"]');
    await expect(page.locator(".collapsible-preview")).toBeVisible({ timeout: 2000 });

    // Browse through a few tabs so they all have rendered content
    await page.locator(".tab", { hasText: "file-03" }).click();
    await page.waitForTimeout(300);
    await page.locator(".tab", { hasText: "file-06" }).click();
    await page.waitForTimeout(300);
    await page.locator(".tab", { hasText: "file-09" }).click();
    await page.waitForTimeout(300);
    await page.locator(".tab", { hasText: "file-12" }).click();
    await page.waitForTimeout(300);
    await page.locator(".tab", { hasText: "file-15" }).click();
    await page.waitForTimeout(300);

    expect(await getTabCount()).toBe(FILE_COUNT);

    // Close all tabs one by one
    for (let i = FILE_COUNT; i > 0; i--) {
      await closeActiveTab();
      // Brief pause to let async effects (mermaid, link graph) settle
      if (i > 1) {
        await page.waitForTimeout(100);
      }
    }

    // Empty state should render — not a blank screen
    await expect(page.locator(".preview-empty")).toBeVisible({ timeout: 3000 });
    await expect(page.locator(".preview-empty h2")).toHaveText("viewmd");
    await expect(page.locator(".toolbar")).toBeVisible();

    // Tab bar should be gone
    await expect(page.locator(".tab-bar")).not.toBeVisible();

    const relevant = consoleErrors.filter(
      (e) => !e.includes("Electron Security Warning")
    );
    expect(relevant).toEqual([]);
  });

  test("collapsible + links panel + mixed fold states across files, close all", async () => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await openTestFolder();

    // Open 12 files
    for (let i = 1; i <= 12; i++) {
      await selectFileByName(`file-${String(i).padStart(2, "0")}.md`);
    }

    // Enable collapsible mode
    await page.click('[aria-label="Collapsible view off"]');
    await expect(page.locator(".collapsible-preview")).toBeVisible({ timeout: 2000 });

    // Switch right panel to Links view
    const linksBtn = page.locator('.segmented-btn:text-is("Links")');
    if ((await linksBtn.count()) > 0) {
      await linksBtn.click();
      await page.waitForTimeout(200);
    }

    // Browse files and toggle collapse states to create non-default fold state
    // File 03 — expand all then collapse a couple
    await page.locator(".tab", { hasText: "file-03" }).click();
    await page.waitForTimeout(400);
    let chevrons = page.locator(".collapsible-heading .collapse-chevron");
    let count = await chevrons.count();
    // Collapse sections 1 and 2 (leave others expanded)
    for (let j = 0; j < Math.min(count, 2); j++) {
      await chevrons.nth(j).click();
      await page.waitForTimeout(100);
    }

    // File 06 — collapse all sections
    await page.locator(".tab", { hasText: "file-06" }).click();
    await page.waitForTimeout(400);
    chevrons = page.locator(".collapsible-heading .collapse-chevron");
    count = await chevrons.count();
    for (let j = 0; j < count; j++) {
      await chevrons.nth(j).click();
      await page.waitForTimeout(50);
    }

    // File 09 — expand some, collapse others (interleaved)
    await page.locator(".tab", { hasText: "file-09" }).click();
    await page.waitForTimeout(400);
    chevrons = page.locator(".collapsible-heading .collapse-chevron");
    count = await chevrons.count();
    for (let j = 0; j < count; j++) {
      if (j % 2 === 0) {
        await chevrons.nth(j).click();
        await page.waitForTimeout(50);
      }
    }

    // File 12 — leave at default (all collapsed)
    await page.locator(".tab", { hasText: "file-12" }).click();
    await page.waitForTimeout(400);

    // Go back to file 03 to trigger fold state load
    await page.locator(".tab", { hasText: "file-03" }).click();
    await page.waitForTimeout(400);

    // Now close all 12 tabs one by one
    for (let i = 12; i > 0; i--) {
      await closeActiveTab();
      if (i > 1) await page.waitForTimeout(150);
    }

    // Empty state should render — not blank
    await expect(page.locator(".preview-empty")).toBeVisible({ timeout: 3000 });
    await expect(page.locator(".preview-empty h2")).toHaveText("viewmd");
    await expect(page.locator(".toolbar")).toBeVisible();

    const relevant = consoleErrors.filter(
      (e) => !e.includes("Electron Security Warning")
    );
    expect(relevant).toEqual([]);
  });

  test("app is functional after closing all tabs (can reopen files)", async () => {
    await openTestFolder();

    // Open a few tabs
    await selectFileByName("file-01.md");
    await selectFileByName("file-02.md");
    await selectFileByName("file-03.md");

    // Close all
    for (let i = 0; i < 3; i++) {
      await closeActiveTab();
    }

    await expect(page.locator(".preview-empty")).toBeVisible({ timeout: 3000 });

    // Now reopen a file — app should work normally
    await selectFileByName("file-01.md");
    await expect(page.locator(".preview-container")).toBeVisible({ timeout: 2000 });
    await expect(page.locator(".preview-content h1")).toHaveText("File 1");
    expect(await getTabCount()).toBe(1);
  });
});
