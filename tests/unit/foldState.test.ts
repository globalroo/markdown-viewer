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
});
