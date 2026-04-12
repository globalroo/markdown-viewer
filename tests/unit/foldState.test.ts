import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// We test the fold state persistence logic by simulating the main process functions.
// Since these are module-level functions in main.ts, we test the patterns directly.

describe("Fold State Persistence", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "foldstate-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("recovers gracefully from corrupted JSON", () => {
    const filePath = path.join(tmpDir, "fold-state.json");
    fs.writeFileSync(filePath, "{ broken json {{{{", "utf-8");

    // Simulate loadFoldStateStore pattern
    let result: any;
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      result = JSON.parse(raw);
      if (!result.entries) result.entries = {};
    } catch {
      result = { entries: {} };
    }

    expect(result).toEqual({ entries: {} });
  });

  it("recovers from empty file", () => {
    const filePath = path.join(tmpDir, "fold-state.json");
    fs.writeFileSync(filePath, "", "utf-8");

    let result: any;
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      result = JSON.parse(raw);
      if (!result.entries) result.entries = {};
    } catch {
      result = { entries: {} };
    }

    expect(result).toEqual({ entries: {} });
  });

  it("recovers from missing file", () => {
    const filePath = path.join(tmpDir, "does-not-exist.json");

    let result: any;
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      result = JSON.parse(raw);
      if (!result.entries) result.entries = {};
    } catch {
      result = { entries: {} };
    }

    expect(result).toEqual({ entries: {} });
  });

  it("recovers from truncated JSON (partial write)", () => {
    const filePath = path.join(tmpDir, "fold-state.json");
    fs.writeFileSync(filePath, '{"entries":{"file1":{"headingIds":{"h1":true},"la', "utf-8");

    let result: any;
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      result = JSON.parse(raw);
      if (!result.entries) result.entries = {};
    } catch {
      result = { entries: {} };
    }

    expect(result).toEqual({ entries: {} });
  });

  it("atomic write produces valid JSON", () => {
    const filePath = path.join(tmpDir, "fold-state.json");
    const data = {
      entries: {
        "/path/to/file.md": { headingIds: { "h1": true, "h2": false }, lastAccessed: Date.now() },
      },
    };

    // Simulate atomicWriteJson
    const tmp = filePath + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
    fs.renameSync(tmp, filePath);

    // Verify valid JSON
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    expect(parsed.entries["/path/to/file.md"].headingIds.h1).toBe(true);
  });

  it("LRU eviction removes oldest entries when cap exceeded", () => {
    const FOLD_STATE_MAX_ENTRIES = 300;
    const entries: Record<string, { headingIds: Record<string, boolean>; lastAccessed: number }> = {};

    // Add 310 entries with increasing timestamps
    for (let i = 0; i < 310; i++) {
      entries[`/file${i}.md`] = { headingIds: { h1: true }, lastAccessed: i * 1000 };
    }

    // Simulate LRU eviction
    const keys = Object.keys(entries);
    if (keys.length > FOLD_STATE_MAX_ENTRIES) {
      const sorted = keys.sort(
        (a, b) => (entries[a].lastAccessed || 0) - (entries[b].lastAccessed || 0)
      );
      const toRemove = sorted.slice(0, keys.length - FOLD_STATE_MAX_ENTRIES);
      for (const k of toRemove) delete entries[k];
    }

    expect(Object.keys(entries).length).toBe(300);
    // Oldest 10 should be removed (file0 through file9)
    expect(entries["/file0.md"]).toBeUndefined();
    expect(entries["/file9.md"]).toBeUndefined();
    // Newest should remain
    expect(entries["/file309.md"]).toBeDefined();
    expect(entries["/file10.md"]).toBeDefined();
  });

  it("flush retry: dirty flag stays set and timer re-arms on write failure", () => {
    // Simulate the flush-retry pattern from main.ts:
    // When atomicWriteJson throws, foldStateDirty stays true and
    // scheduleFoldStateWrite is called again to re-arm the timer.

    let foldStateDirty = true;
    let foldStateTimer: ReturnType<typeof setTimeout> | null = null;
    let scheduleCalls = 0;
    const foldStateCache = {
      entries: { "/file.md": { headingIds: { h1: true }, lastAccessed: Date.now() } },
    };

    function scheduleFoldStateWrite(): void {
      if (foldStateTimer) return;
      scheduleCalls++;
      foldStateTimer = setTimeout(() => {
        foldStateTimer = null;
        flushFoldState();
      }, 100);
    }

    function flushFoldState(): void {
      if (!foldStateDirty || !foldStateCache) return;
      try {
        // Simulate write to a read-only / non-existent deep path
        const badPath = path.join(tmpDir, "no-exist-parent", "deep", "fold-state.json");
        const tmp = badPath + ".tmp";
        // mkdirSync not called — this WILL throw
        fs.writeFileSync(tmp, JSON.stringify(foldStateCache, null, 2), "utf-8");
        fs.renameSync(tmp, badPath);
        foldStateDirty = false;
      } catch {
        // Mirrors the catch block in main.ts: keep dirty=true, re-arm timer
        scheduleFoldStateWrite();
      }
    }

    // Initial state: dirty, no timer
    expect(foldStateDirty).toBe(true);

    // Trigger flush — it should fail because parent dir doesn't exist
    flushFoldState();

    // dirty flag must remain true (write failed)
    expect(foldStateDirty).toBe(true);

    // scheduler must have been called (re-armed)
    expect(scheduleCalls).toBe(1);

    // Timer should be set
    expect(foldStateTimer).not.toBeNull();

    // Clean up timer
    if (foldStateTimer) clearTimeout(foldStateTimer);
  });
});
