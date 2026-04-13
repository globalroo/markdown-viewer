import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import { useAppStore } from "../../src/renderer/store";

// jsdom polyfills for browser APIs
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = MockResizeObserver as any;

// jsdom elements don't have scrollTo
Element.prototype.scrollTo = vi.fn() as any;

class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.IntersectionObserver = MockIntersectionObserver as any;

window.matchMedia = vi.fn().mockImplementation((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

// Extend the global mock with APIs that App/MarkdownPreview/Sidebar need
const mockApi = (window as any).api;
mockApi.getCustomCSS = vi.fn().mockResolvedValue(null);
mockApi.getLinkGraph = vi.fn().mockResolvedValue({ outgoing: [], incoming: [] });
mockApi.getConnectedPaths = vi.fn().mockResolvedValue([]);
mockApi.searchContent = vi.fn().mockResolvedValue([]);
mockApi.exportHTML = vi.fn().mockResolvedValue(undefined);
mockApi.exportPDF = vi.fn().mockResolvedValue(undefined);
mockApi.exportDOCX = vi.fn().mockResolvedValue(undefined);
mockApi.loadCustomCSS = vi.fn().mockResolvedValue(null);
mockApi.clearCustomCSS = vi.fn().mockResolvedValue(undefined);
mockApi.loadFoldState = vi.fn().mockResolvedValue(null);
mockApi.saveFoldState = vi.fn().mockResolvedValue(undefined);
mockApi.onFileChanged = vi.fn().mockReturnValue(() => {});
mockApi.onLinkGraphChanged = vi.fn().mockReturnValue(() => {});
mockApi.onTreeChanged = vi.fn().mockReturnValue(() => {});

// Lazy-import App so mocks are in place before module evaluation
let App: any;

const initialState = useAppStore.getState();

function resetStore() {
  useAppStore.setState({
    ...initialState,
    projects: [],
    expandedDirs: new Set<string>(),
    selectedFile: null,
    markdownContent: "",
    editMode: false,
    editContent: "",
    editDirty: false,
    editFilePath: null,
    renamingPath: null,
    searchQuery: "",
    fontSize: 16,
    sidebarVisible: true,
    settingsOpen: false,
    contentWidth: "standard",
    lineHeight: "optimal",
    focusMode: false,
    warmFilter: false,
    sidebarFontSize: "medium",
    sidebarWidth: 280,
    outlineVisible: true,
    outlineWidth: 200,
    customCSSPath: null,
    customCSSContent: "",
    openTabs: [],
    activeTab: null,
    styleCheckEnabled: false,
    sectionModel: null,
    previewMode: "standard",
    rightPanelView: "outline",
    linkGraph: null,
    linksFilterActive: false,
    linksFilterHops: 1,
  });
  vi.clearAllMocks();
  // Re-stub the event listener mocks (clearAllMocks resets them)
  mockApi.onFileOpened.mockReturnValue(() => {});
  mockApi.onDirectoryOpened.mockReturnValue(() => {});
  mockApi.onFileChanged.mockReturnValue(() => {});
  mockApi.onLinkGraphChanged.mockReturnValue(() => {});
  mockApi.onTreeChanged.mockReturnValue(() => {});
  mockApi.getInitialPath.mockResolvedValue(null);
  mockApi.getCustomCSS.mockResolvedValue(null);
  mockApi.getLinkGraph.mockResolvedValue({ outgoing: [], incoming: [] });
  mockApi.readFile.mockResolvedValue("# Test\n\nSome content.");
}

const FILE_PATHS = Array.from({ length: 15 }, (_, i) => `/project/file-${i + 1}.md`);

describe("close all tabs crash", () => {
  beforeEach(async () => {
    resetStore();
    // Dynamic import so mocks are ready
    const mod = await import("../../src/renderer/App");
    App = mod.App;
  });

  afterEach(() => {
    cleanup();
  });

  it("closing 15 tabs one by one does not crash the app", async () => {
    // Open all 15 tabs
    act(() => {
      for (const fp of FILE_PATHS) {
        useAppStore.getState().openTab(fp);
      }
    });

    // Render the App with tabs open
    const { container } = render(<App />);

    // Wait for async effects (file reads, link graph, etc.)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // Verify tabs are showing
    expect(useAppStore.getState().openTabs).toHaveLength(15);

    // Close tabs one by one, from the active tab
    for (let i = 15; i > 0; i--) {
      const state = useAppStore.getState();
      const tabToClose = state.activeTab!;

      await act(async () => {
        useAppStore.getState().closeTab(tabToClose);
        // Allow effects to flush
        await new Promise((r) => setTimeout(r, 10));
      });

      const after = useAppStore.getState();
      expect(after.openTabs).toHaveLength(i - 1);

      if (i - 1 === 0) {
        expect(after.activeTab).toBeNull();
        expect(after.selectedFile).toBeNull();
      } else {
        expect(after.activeTab).not.toBeNull();
        expect(after.selectedFile).not.toBeNull();
      }
    }

    // After all tabs closed, the empty state should render
    // (if React crashed, this query would fail or the container would be empty)
    expect(container.querySelector(".preview-empty")).toBeTruthy();
    expect(screen.getByText("viewmd")).toBeTruthy();
    expect(screen.getByText(/Select a file/)).toBeTruthy();

    // Toolbar should still be present
    expect(container.querySelector(".toolbar")).toBeTruthy();
  });

  it("closing last tab while in edit mode does not crash", async () => {
    // Open a file and enter edit mode
    act(() => {
      useAppStore.getState().openTab("/project/file-1.md");
      useAppStore.getState().setEditMode(true);
      useAppStore.getState().setEditContent("modified content");
    });

    const { container } = render(<App />);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // Close the only tab while in edit mode with dirty state
    await act(async () => {
      useAppStore.getState().closeTab("/project/file-1.md");
      await new Promise((r) => setTimeout(r, 10));
    });

    const state = useAppStore.getState();
    expect(state.openTabs).toHaveLength(0);
    expect(state.activeTab).toBeNull();
    expect(state.selectedFile).toBeNull();

    // App should show empty state, not crash
    expect(container.querySelector(".preview-empty")).toBeTruthy();
    expect(container.querySelector(".toolbar")).toBeTruthy();
  });

  it("rapidly closing many tabs does not leave inconsistent state", async () => {
    // Open 15 tabs
    act(() => {
      for (const fp of FILE_PATHS) {
        useAppStore.getState().openTab(fp);
      }
    });

    render(<App />);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // Close all tabs in rapid succession (no awaiting between closes)
    act(() => {
      for (let i = FILE_PATHS.length - 1; i >= 0; i--) {
        const state = useAppStore.getState();
        if (state.activeTab) {
          useAppStore.getState().closeTab(state.activeTab);
        }
      }
    });

    // Flush async effects
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    const finalState = useAppStore.getState();
    expect(finalState.openTabs).toHaveLength(0);
    expect(finalState.activeTab).toBeNull();
    expect(finalState.selectedFile).toBeNull();
    expect(finalState.markdownContent).toBe("");

    // Verify no crash — empty state renders
    expect(screen.getByText("viewmd")).toBeTruthy();
  });
});
