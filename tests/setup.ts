import "@testing-library/jest-dom/vitest";

// Mock window.api for renderer tests
const mockApi: Record<string, any> = {
  openFolder: vi.fn().mockResolvedValue(null),
  scanDirectory: vi.fn().mockResolvedValue([]),
  readFile: vi.fn().mockResolvedValue(""),
  showInFolder: vi.fn().mockResolvedValue(undefined),
  renameFile: vi.fn().mockResolvedValue({ newPath: "" }),
  moveFile: vi.fn().mockResolvedValue({ newPath: "" }),
  writeFile: vi.fn().mockResolvedValue(undefined),
  removeRoot: vi.fn().mockResolvedValue(undefined),
  getInitialPath: vi.fn().mockResolvedValue(null),
  onFileOpened: vi.fn().mockReturnValue(() => {}),
  onDirectoryOpened: vi.fn().mockReturnValue(() => {}),
};

Object.defineProperty(window, "api", {
  value: mockApi,
  writable: true,
});

// Mock navigator.clipboard
Object.defineProperty(navigator, "clipboard", {
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
  writable: true,
});
