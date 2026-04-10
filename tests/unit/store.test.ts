import { describe, it, expect, beforeEach, vi } from "vitest";
import { useAppStore, THEMES } from "../../src/renderer/store";

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
  });
  vi.clearAllMocks();
}

const sampleTree = [
  { name: "README.md", path: "/projects/alpha/README.md", type: "file" as const },
  { name: "CHANGELOG.md", path: "/projects/alpha/CHANGELOG.md", type: "file" as const },
];

const anotherTree = [
  { name: "notes.md", path: "/projects/beta/notes.md", type: "file" as const },
];

describe("useAppStore", () => {
  beforeEach(() => {
    resetStore();
  });

  // ---------------------------------------------------------------
  // addProject
  // ---------------------------------------------------------------
  describe("addProject", () => {
    it("adds a project with correct id, rootPath, name, and tree", () => {
      useAppStore.getState().addProject("/projects/alpha", sampleTree);

      const { projects } = useAppStore.getState();
      expect(projects).toHaveLength(1);
      expect(projects[0].id).toBe("/projects/alpha");
      expect(projects[0].rootPath).toBe("/projects/alpha");
      expect(projects[0].name).toBe("alpha");
      expect(projects[0].tree).toEqual(sampleTree);
      expect(projects[0].isExpanded).toBe(true);
    });

    it("prevents duplicate projects with the same rootPath", () => {
      useAppStore.getState().addProject("/projects/alpha", sampleTree);
      useAppStore.getState().addProject("/projects/alpha", sampleTree);

      expect(useAppStore.getState().projects).toHaveLength(1);
    });

    it("allows projects with different rootPaths", () => {
      useAppStore.getState().addProject("/projects/alpha", sampleTree);
      useAppStore.getState().addProject("/projects/beta", anotherTree);

      expect(useAppStore.getState().projects).toHaveLength(2);
    });

    it("extracts name from the last path segment", () => {
      useAppStore.getState().addProject("/Users/andy/deep/nested/folder", []);

      expect(useAppStore.getState().projects[0].name).toBe("folder");
    });

    it("extracts name from Windows-style backslash path", () => {
      useAppStore.getState().addProject("C:\\Users\\andy\\docs", []);

      expect(useAppStore.getState().projects[0].name).toBe("docs");
    });

    it("uses full path as name when split produces nothing", () => {
      // Edge case: if split somehow yields empty last segment, falls back
      useAppStore.getState().addProject("standalone", []);

      expect(useAppStore.getState().projects[0].name).toBe("standalone");
    });
  });

  // ---------------------------------------------------------------
  // removeProject
  // ---------------------------------------------------------------
  describe("removeProject", () => {
    it("removes the specified project from the list", () => {
      useAppStore.getState().addProject("/projects/alpha", sampleTree);
      useAppStore.getState().addProject("/projects/beta", anotherTree);

      useAppStore.getState().removeProject("/projects/alpha");

      const { projects } = useAppStore.getState();
      expect(projects).toHaveLength(1);
      expect(projects[0].rootPath).toBe("/projects/beta");
    });

    it("clears selectedFile if it belonged to the removed project", () => {
      useAppStore.getState().addProject("/projects/alpha", sampleTree);
      useAppStore.setState({ selectedFile: "/projects/alpha/README.md" });

      useAppStore.getState().removeProject("/projects/alpha");

      expect(useAppStore.getState().selectedFile).toBeNull();
    });

    it("clears markdownContent when selectedFile is cleared", () => {
      useAppStore.getState().addProject("/projects/alpha", sampleTree);
      useAppStore.setState({
        selectedFile: "/projects/alpha/README.md",
        markdownContent: "# Hello",
      });

      useAppStore.getState().removeProject("/projects/alpha");

      expect(useAppStore.getState().markdownContent).toBe("");
    });

    it("preserves selectedFile if it belongs to a different project", () => {
      useAppStore.getState().addProject("/projects/alpha", sampleTree);
      useAppStore.getState().addProject("/projects/beta", anotherTree);
      useAppStore.setState({
        selectedFile: "/projects/beta/notes.md",
        markdownContent: "# Notes",
      });

      useAppStore.getState().removeProject("/projects/alpha");

      expect(useAppStore.getState().selectedFile).toBe("/projects/beta/notes.md");
      expect(useAppStore.getState().markdownContent).toBe("# Notes");
    });

    it("calls window.api.removeRoot with the project rootPath", () => {
      useAppStore.getState().addProject("/projects/alpha", sampleTree);

      useAppStore.getState().removeProject("/projects/alpha");

      expect(window.api.removeRoot).toHaveBeenCalledWith("/projects/alpha");
    });

    it("does nothing if project id does not exist", () => {
      useAppStore.getState().addProject("/projects/alpha", sampleTree);

      useAppStore.getState().removeProject("/nonexistent");

      expect(useAppStore.getState().projects).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------
  // setEditMode
  // ---------------------------------------------------------------
  describe("setEditMode", () => {
    it("entering edit mode copies markdownContent to editContent", () => {
      useAppStore.setState({
        markdownContent: "# Title",
        selectedFile: "/projects/alpha/README.md",
      });

      useAppStore.getState().setEditMode(true);

      const state = useAppStore.getState();
      expect(state.editMode).toBe(true);
      expect(state.editContent).toBe("# Title");
      expect(state.editDirty).toBe(false);
      expect(state.editFilePath).toBe("/projects/alpha/README.md");
    });

    it("preserves editContent when editDirty is true AND editFilePath matches selectedFile", () => {
      useAppStore.setState({
        markdownContent: "# Original",
        selectedFile: "/projects/alpha/README.md",
        editContent: "# Modified draft",
        editDirty: true,
        editFilePath: "/projects/alpha/README.md",
      });

      useAppStore.getState().setEditMode(true);

      const state = useAppStore.getState();
      expect(state.editMode).toBe(true);
      expect(state.editContent).toBe("# Modified draft");
      expect(state.editDirty).toBe(true);
    });

    it("resets editContent when editFilePath does not match selectedFile", () => {
      useAppStore.setState({
        markdownContent: "# New file content",
        selectedFile: "/projects/beta/notes.md",
        editContent: "# Old draft for different file",
        editDirty: true,
        editFilePath: "/projects/alpha/README.md",
      });

      useAppStore.getState().setEditMode(true);

      const state = useAppStore.getState();
      expect(state.editMode).toBe(true);
      expect(state.editContent).toBe("# New file content");
      expect(state.editDirty).toBe(false);
      expect(state.editFilePath).toBe("/projects/beta/notes.md");
    });

    it("resets editContent when editDirty is false even if editFilePath matches", () => {
      useAppStore.setState({
        markdownContent: "# Updated content",
        selectedFile: "/projects/alpha/README.md",
        editContent: "# Stale",
        editDirty: false,
        editFilePath: "/projects/alpha/README.md",
      });

      useAppStore.getState().setEditMode(true);

      const state = useAppStore.getState();
      expect(state.editContent).toBe("# Updated content");
      expect(state.editDirty).toBe(false);
    });

    it("exiting edit mode sets editMode to false", () => {
      useAppStore.setState({ editMode: true });

      useAppStore.getState().setEditMode(false);

      expect(useAppStore.getState().editMode).toBe(false);
    });

    it("exiting edit mode does not clear editContent or editDirty", () => {
      useAppStore.setState({
        editMode: true,
        editContent: "# Draft",
        editDirty: true,
      });

      useAppStore.getState().setEditMode(false);

      const state = useAppStore.getState();
      expect(state.editMode).toBe(false);
      expect(state.editContent).toBe("# Draft");
      expect(state.editDirty).toBe(true);
    });
  });

  // ---------------------------------------------------------------
  // setEditContent
  // ---------------------------------------------------------------
  describe("setEditContent", () => {
    it("updates editContent", () => {
      useAppStore.getState().setEditContent("new content");

      expect(useAppStore.getState().editContent).toBe("new content");
    });

    it("sets editDirty to true when content differs from markdownContent", () => {
      useAppStore.setState({ markdownContent: "# Original" });

      useAppStore.getState().setEditContent("# Modified");

      expect(useAppStore.getState().editDirty).toBe(true);
    });

    it("sets editDirty to false when content matches markdownContent (undo back to original)", () => {
      useAppStore.setState({
        markdownContent: "# Original",
        editDirty: true,
      });

      useAppStore.getState().setEditContent("# Original");

      expect(useAppStore.getState().editDirty).toBe(false);
    });

    it("updates editFilePath to the current selectedFile", () => {
      useAppStore.setState({
        selectedFile: "/projects/alpha/README.md",
        editFilePath: null,
      });

      useAppStore.getState().setEditContent("anything");

      expect(useAppStore.getState().editFilePath).toBe(
        "/projects/alpha/README.md"
      );
    });

    it("tracks dirty state correctly across multiple edits", () => {
      useAppStore.setState({ markdownContent: "abc" });

      useAppStore.getState().setEditContent("abc changed");
      expect(useAppStore.getState().editDirty).toBe(true);

      useAppStore.getState().setEditContent("abc");
      expect(useAppStore.getState().editDirty).toBe(false);

      useAppStore.getState().setEditContent("abc again");
      expect(useAppStore.getState().editDirty).toBe(true);
    });
  });

  // ---------------------------------------------------------------
  // updateProjectTree
  // ---------------------------------------------------------------
  describe("updateProjectTree", () => {
    const updatedTree = [
      { name: "NEW.md", path: "/projects/alpha/NEW.md", type: "file" as const },
    ];

    beforeEach(() => {
      useAppStore.getState().addProject("/projects/alpha", sampleTree);
    });

    it("replaces a project's tree", () => {
      useAppStore
        .getState()
        .updateProjectTree("/projects/alpha", updatedTree);

      const project = useAppStore.getState().projects[0];
      expect(project.tree).toEqual(updatedTree);
    });

    it("does not modify other projects", () => {
      useAppStore.getState().addProject("/projects/beta", anotherTree);

      useAppStore
        .getState()
        .updateProjectTree("/projects/alpha", updatedTree);

      const beta = useAppStore
        .getState()
        .projects.find((p) => p.id === "/projects/beta");
      expect(beta?.tree).toEqual(anotherTree);
    });

    it("rewrites selectedFile when oldPath matches exactly", () => {
      useAppStore.setState({
        selectedFile: "/projects/alpha/README.md",
      });

      useAppStore
        .getState()
        .updateProjectTree(
          "/projects/alpha",
          updatedTree,
          "/projects/alpha/README.md",
          "/projects/alpha/RENAMED.md"
        );

      expect(useAppStore.getState().selectedFile).toBe(
        "/projects/alpha/RENAMED.md"
      );
    });

    it("rewrites selectedFile with prefix match (nested path)", () => {
      useAppStore.setState({
        selectedFile: "/projects/alpha/docs/guide.md",
      });

      useAppStore
        .getState()
        .updateProjectTree(
          "/projects/alpha",
          updatedTree,
          "/projects/alpha/docs",
          "/projects/alpha/documentation"
        );

      expect(useAppStore.getState().selectedFile).toBe(
        "/projects/alpha/documentation/guide.md"
      );
    });

    it("rewrites expandedDirs entries when oldPath matches", () => {
      useAppStore.setState({
        expandedDirs: new Set([
          "/projects/alpha/docs",
          "/projects/alpha/docs/sub",
          "/projects/beta/other",
        ]),
      });

      useAppStore
        .getState()
        .updateProjectTree(
          "/projects/alpha",
          updatedTree,
          "/projects/alpha/docs",
          "/projects/alpha/documentation"
        );

      const dirs = useAppStore.getState().expandedDirs;
      expect(dirs.has("/projects/alpha/documentation")).toBe(true);
      expect(dirs.has("/projects/alpha/documentation/sub")).toBe(true);
      expect(dirs.has("/projects/beta/other")).toBe(true);
      expect(dirs.has("/projects/alpha/docs")).toBe(false);
    });

    it("rewrites editFilePath when it matches oldPath", () => {
      useAppStore.setState({
        editFilePath: "/projects/alpha/README.md",
      });

      useAppStore
        .getState()
        .updateProjectTree(
          "/projects/alpha",
          updatedTree,
          "/projects/alpha/README.md",
          "/projects/alpha/RENAMED.md"
        );

      expect(useAppStore.getState().editFilePath).toBe(
        "/projects/alpha/RENAMED.md"
      );
    });

    it("rewrites editFilePath with prefix match", () => {
      useAppStore.setState({
        editFilePath: "/projects/alpha/old-dir/file.md",
      });

      useAppStore
        .getState()
        .updateProjectTree(
          "/projects/alpha",
          updatedTree,
          "/projects/alpha/old-dir",
          "/projects/alpha/new-dir"
        );

      expect(useAppStore.getState().editFilePath).toBe(
        "/projects/alpha/new-dir/file.md"
      );
    });

    it("handles Windows path separators (backslash) in prefix matching", () => {
      useAppStore.setState({
        selectedFile: "C:\\projects\\alpha\\docs\\guide.md",
      });

      useAppStore
        .getState()
        .updateProjectTree(
          "/projects/alpha",
          updatedTree,
          "C:\\projects\\alpha\\docs",
          "C:\\projects\\alpha\\documentation"
        );

      expect(useAppStore.getState().selectedFile).toBe(
        "C:\\projects\\alpha\\documentation\\guide.md"
      );
    });

    it("does not modify state when no oldPath/newPath provided", () => {
      useAppStore.setState({
        selectedFile: "/projects/alpha/README.md",
        expandedDirs: new Set(["/projects/alpha/docs"]),
        editFilePath: "/projects/alpha/README.md",
      });

      useAppStore
        .getState()
        .updateProjectTree("/projects/alpha", updatedTree);

      const state = useAppStore.getState();
      expect(state.selectedFile).toBe("/projects/alpha/README.md");
      expect(state.expandedDirs.has("/projects/alpha/docs")).toBe(true);
      expect(state.editFilePath).toBe("/projects/alpha/README.md");
    });

    it("does not rewrite selectedFile when it does not match oldPath", () => {
      useAppStore.setState({
        selectedFile: "/projects/beta/notes.md",
      });

      useAppStore
        .getState()
        .updateProjectTree(
          "/projects/alpha",
          updatedTree,
          "/projects/alpha/README.md",
          "/projects/alpha/RENAMED.md"
        );

      expect(useAppStore.getState().selectedFile).toBe(
        "/projects/beta/notes.md"
      );
    });

    it("does not rewrite editFilePath when it is null", () => {
      useAppStore.setState({ editFilePath: null });

      useAppStore
        .getState()
        .updateProjectTree(
          "/projects/alpha",
          updatedTree,
          "/projects/alpha/README.md",
          "/projects/alpha/RENAMED.md"
        );

      expect(useAppStore.getState().editFilePath).toBeNull();
    });
  });

  // ---------------------------------------------------------------
  // toggleDir
  // ---------------------------------------------------------------
  describe("toggleDir", () => {
    it("adds a directory to expandedDirs", () => {
      useAppStore.getState().toggleDir("/projects/alpha/docs");

      expect(
        useAppStore.getState().expandedDirs.has("/projects/alpha/docs")
      ).toBe(true);
    });

    it("removes a directory from expandedDirs on second call", () => {
      useAppStore.getState().toggleDir("/projects/alpha/docs");
      useAppStore.getState().toggleDir("/projects/alpha/docs");

      expect(
        useAppStore.getState().expandedDirs.has("/projects/alpha/docs")
      ).toBe(false);
    });

    it("only toggles the specified directory, leaving others untouched", () => {
      useAppStore.getState().toggleDir("/projects/alpha/docs");
      useAppStore.getState().toggleDir("/projects/alpha/src");

      const dirs = useAppStore.getState().expandedDirs;
      expect(dirs.has("/projects/alpha/docs")).toBe(true);
      expect(dirs.has("/projects/alpha/src")).toBe(true);

      useAppStore.getState().toggleDir("/projects/alpha/docs");

      const updatedDirs = useAppStore.getState().expandedDirs;
      expect(updatedDirs.has("/projects/alpha/docs")).toBe(false);
      expect(updatedDirs.has("/projects/alpha/src")).toBe(true);
    });
  });

  // ---------------------------------------------------------------
  // setRenamingPath
  // ---------------------------------------------------------------
  describe("setRenamingPath", () => {
    it("sets renamingPath to a file path", () => {
      useAppStore.getState().setRenamingPath("/projects/alpha/README.md");

      expect(useAppStore.getState().renamingPath).toBe(
        "/projects/alpha/README.md"
      );
    });

    it("clears renamingPath when set to null", () => {
      useAppStore.getState().setRenamingPath("/projects/alpha/README.md");
      useAppStore.getState().setRenamingPath(null);

      expect(useAppStore.getState().renamingPath).toBeNull();
    });
  });

  // ---------------------------------------------------------------
  // contentWidth
  // ---------------------------------------------------------------
  describe("contentWidth", () => {
    it("defaults to 'standard'", () => {
      expect(useAppStore.getState().contentWidth).toBe("standard");
    });

    it("setContentWidth changes the value", () => {
      useAppStore.getState().setContentWidth("wide");

      expect(useAppStore.getState().contentWidth).toBe("wide");
    });

    it("accepts 'narrow'", () => {
      useAppStore.getState().setContentWidth("narrow");

      expect(useAppStore.getState().contentWidth).toBe("narrow");
    });

    it("accepts 'standard'", () => {
      useAppStore.getState().setContentWidth("wide");
      useAppStore.getState().setContentWidth("standard");

      expect(useAppStore.getState().contentWidth).toBe("standard");
    });

    it("accepts 'wide'", () => {
      useAppStore.getState().setContentWidth("wide");

      expect(useAppStore.getState().contentWidth).toBe("wide");
    });

    it("accepts 'full'", () => {
      useAppStore.getState().setContentWidth("full");

      expect(useAppStore.getState().contentWidth).toBe("full");
    });
  });

  // ---------------------------------------------------------------
  // lineHeight
  // ---------------------------------------------------------------
  describe("lineHeight", () => {
    it("defaults to 'optimal'", () => {
      expect(useAppStore.getState().lineHeight).toBe("optimal");
    });

    it("setLineHeight changes the value", () => {
      useAppStore.getState().setLineHeight("relaxed");

      expect(useAppStore.getState().lineHeight).toBe("relaxed");
    });

    it("accepts 'compact'", () => {
      useAppStore.getState().setLineHeight("compact");

      expect(useAppStore.getState().lineHeight).toBe("compact");
    });

    it("accepts 'optimal'", () => {
      useAppStore.getState().setLineHeight("compact");
      useAppStore.getState().setLineHeight("optimal");

      expect(useAppStore.getState().lineHeight).toBe("optimal");
    });

    it("accepts 'relaxed'", () => {
      useAppStore.getState().setLineHeight("relaxed");

      expect(useAppStore.getState().lineHeight).toBe("relaxed");
    });
  });

  // ---------------------------------------------------------------
  // focusMode
  // ---------------------------------------------------------------
  describe("focusMode", () => {
    it("defaults to false", () => {
      expect(useAppStore.getState().focusMode).toBe(false);
    });

    it("toggleFocusMode toggles to true", () => {
      useAppStore.getState().toggleFocusMode();

      expect(useAppStore.getState().focusMode).toBe(true);
    });

    it("double toggle returns to false", () => {
      useAppStore.getState().toggleFocusMode();
      useAppStore.getState().toggleFocusMode();

      expect(useAppStore.getState().focusMode).toBe(false);
    });
  });

  // ---------------------------------------------------------------
  // warmFilter
  // ---------------------------------------------------------------
  describe("warmFilter", () => {
    it("defaults to false", () => {
      expect(useAppStore.getState().warmFilter).toBe(false);
    });

    it("toggleWarmFilter toggles to true", () => {
      useAppStore.getState().toggleWarmFilter();

      expect(useAppStore.getState().warmFilter).toBe(true);
    });

    it("double toggle returns to false", () => {
      useAppStore.getState().toggleWarmFilter();
      useAppStore.getState().toggleWarmFilter();

      expect(useAppStore.getState().warmFilter).toBe(false);
    });
  });

  // ---------------------------------------------------------------
  // sidebarFontSize
  // ---------------------------------------------------------------
  describe("sidebarFontSize", () => {
    it("defaults to 'medium'", () => {
      expect(useAppStore.getState().sidebarFontSize).toBe("medium");
    });

    it("setSidebarFontSize changes the value", () => {
      useAppStore.getState().setSidebarFontSize("large");

      expect(useAppStore.getState().sidebarFontSize).toBe("large");
    });

    it("accepts 'small'", () => {
      useAppStore.getState().setSidebarFontSize("small");

      expect(useAppStore.getState().sidebarFontSize).toBe("small");
    });

    it("accepts 'medium'", () => {
      useAppStore.getState().setSidebarFontSize("large");
      useAppStore.getState().setSidebarFontSize("medium");

      expect(useAppStore.getState().sidebarFontSize).toBe("medium");
    });

    it("accepts 'large'", () => {
      useAppStore.getState().setSidebarFontSize("large");

      expect(useAppStore.getState().sidebarFontSize).toBe("large");
    });
  });

  // ---------------------------------------------------------------
  // sidebarWidth
  // ---------------------------------------------------------------
  describe("sidebarWidth", () => {
    it("defaults to 280", () => {
      expect(useAppStore.getState().sidebarWidth).toBe(280);
    });

    it("setSidebarWidth changes the value", () => {
      useAppStore.getState().setSidebarWidth(350);

      expect(useAppStore.getState().sidebarWidth).toBe(350);
    });

    it("clamps to minimum of 180", () => {
      useAppStore.getState().setSidebarWidth(100);

      expect(useAppStore.getState().sidebarWidth).toBe(180);
    });

    it("clamps to maximum of 500", () => {
      useAppStore.getState().setSidebarWidth(600);

      expect(useAppStore.getState().sidebarWidth).toBe(500);
    });

    it("accepts boundary value 180", () => {
      useAppStore.getState().setSidebarWidth(180);

      expect(useAppStore.getState().sidebarWidth).toBe(180);
    });

    it("accepts boundary value 500", () => {
      useAppStore.getState().setSidebarWidth(500);

      expect(useAppStore.getState().sidebarWidth).toBe(500);
    });

    it("resetSidebarWidth resets to 280", () => {
      useAppStore.getState().setSidebarWidth(400);
      expect(useAppStore.getState().sidebarWidth).toBe(400);

      useAppStore.getState().resetSidebarWidth();

      expect(useAppStore.getState().sidebarWidth).toBe(280);
    });
  });

  // ---------------------------------------------------------------
  // linked sidebar font scaling formula
  // ---------------------------------------------------------------
  describe("linked sidebar font scaling", () => {
    // The formula from App.tsx useSidebarLayout():
    //   const SIDEBAR_FONT_BASE = { small: 12, medium: 13, large: 15 };
    //   const zoomFactor = fontSize / 16;
    //   const smallPx = Math.max(9, Math.round(12 * zoomFactor));
    //   sizes = { small: smallPx, medium: smallPx + 1, large: smallPx + 3 };

    const SIDEBAR_FONT_BASE = { small: 12, medium: 13, large: 15 };

    function computeSidebarFontSize(
      fontSize: number,
      sidebarFontSize: "small" | "medium" | "large"
    ): number {
      const zoomFactor = fontSize / 16;
      const smallPx = Math.max(9, Math.round(SIDEBAR_FONT_BASE.small * zoomFactor));
      const sizes = { small: smallPx, medium: smallPx + 1, large: smallPx + 3 };
      return sizes[sidebarFontSize];
    }

    it("at default 16px: small=12, medium=13, large=15", () => {
      expect(computeSidebarFontSize(16, "small")).toBe(12);
      expect(computeSidebarFontSize(16, "medium")).toBe(13);
      expect(computeSidebarFontSize(16, "large")).toBe(15);
    });

    it("at 18px (zoom 1.125): small=14, medium=15, large=17", () => {
      expect(computeSidebarFontSize(18, "small")).toBe(14);
      expect(computeSidebarFontSize(18, "medium")).toBe(15);
      expect(computeSidebarFontSize(18, "large")).toBe(17);
    });

    it("at 10px minimum: small=max(9, round(12*0.625))=max(9,8)=9, medium=10, large=12", () => {
      expect(computeSidebarFontSize(10, "small")).toBe(9);
      expect(computeSidebarFontSize(10, "medium")).toBe(10);
      expect(computeSidebarFontSize(10, "large")).toBe(12);
    });

    it("at 32px maximum: small=24, medium=25, large=27", () => {
      expect(computeSidebarFontSize(32, "small")).toBe(24);
      expect(computeSidebarFontSize(32, "medium")).toBe(25);
      expect(computeSidebarFontSize(32, "large")).toBe(27);
    });

    it("medium is always small+1 and large is always small+3", () => {
      for (const fontSize of [10, 12, 14, 16, 18, 20, 24, 28, 32]) {
        const small = computeSidebarFontSize(fontSize, "small");
        const medium = computeSidebarFontSize(fontSize, "medium");
        const large = computeSidebarFontSize(fontSize, "large");
        expect(medium).toBe(small + 1);
        expect(large).toBe(small + 3);
      }
    });

    it("small is never below 9px", () => {
      // Even at the minimum content font size of 10
      expect(computeSidebarFontSize(10, "small")).toBeGreaterThanOrEqual(9);
    });

    it("store fontSize increase/decrease affects the formula inputs correctly", () => {
      // Increase font size from 16 to 18
      useAppStore.getState().increaseFontSize();
      expect(useAppStore.getState().fontSize).toBe(18);

      // Verify the formula input
      expect(computeSidebarFontSize(18, "medium")).toBe(15);

      // Decrease back
      useAppStore.getState().decreaseFontSize();
      expect(useAppStore.getState().fontSize).toBe(16);
      expect(computeSidebarFontSize(16, "medium")).toBe(13);
    });
  });

  // ---------------------------------------------------------------
  // sidebar width and reset interaction
  // ---------------------------------------------------------------
  describe("sidebar width reset interaction", () => {
    it("double-click reset after keyboard resize returns to 280", () => {
      useAppStore.getState().setSidebarWidth(350);
      expect(useAppStore.getState().sidebarWidth).toBe(350);

      useAppStore.getState().resetSidebarWidth();
      expect(useAppStore.getState().sidebarWidth).toBe(280);
    });

    it("setSidebarWidth with increments of 10 simulates arrow keys", () => {
      const current = useAppStore.getState().sidebarWidth;
      useAppStore.getState().setSidebarWidth(current + 10);
      expect(useAppStore.getState().sidebarWidth).toBe(290);

      useAppStore.getState().setSidebarWidth(290 - 10);
      expect(useAppStore.getState().sidebarWidth).toBe(280);
    });

    it("Home key equivalent sets minimum (180)", () => {
      useAppStore.getState().setSidebarWidth(180);
      expect(useAppStore.getState().sidebarWidth).toBe(180);
    });

    it("End key equivalent sets maximum (500)", () => {
      useAppStore.getState().setSidebarWidth(500);
      expect(useAppStore.getState().sidebarWidth).toBe(500);
    });
  });

  // ---------------------------------------------------------------
  // contentWidth "full" value
  // ---------------------------------------------------------------
  describe("contentWidth full mapping", () => {
    it("sets to 'full' and store reflects it", () => {
      useAppStore.getState().setContentWidth("full");
      expect(useAppStore.getState().contentWidth).toBe("full");
    });

    it("can round-trip through all values including full", () => {
      const values: Array<"narrow" | "standard" | "wide" | "full"> = [
        "narrow", "standard", "wide", "full",
      ];
      for (const v of values) {
        useAppStore.getState().setContentWidth(v);
        expect(useAppStore.getState().contentWidth).toBe(v);
      }
    });
  });

  // ---------------------------------------------------------------
  // THEMES — reading group
  // ---------------------------------------------------------------
  describe("THEMES reading group", () => {
    it("contains 'sepia' with group 'reading'", () => {
      const sepia = THEMES.find((t) => t.id === "sepia");
      expect(sepia).toBeDefined();
      expect(sepia!.group).toBe("reading");
    });

    it("contains 'sage' with group 'reading'", () => {
      const sage = THEMES.find((t) => t.id === "sage");
      expect(sage).toBeDefined();
      expect(sage!.group).toBe("reading");
    });

    it("contains 'twilight-reader' with group 'reading'", () => {
      const twilight = THEMES.find((t) => t.id === "twilight-reader");
      expect(twilight).toBeDefined();
      expect(twilight!.group).toBe("reading");
    });
  });

  describe("outlineWidth", () => {
    it("setOutlineWidth clamps to min 160", () => {
      useAppStore.getState().setOutlineWidth(100);
      expect(useAppStore.getState().outlineWidth).toBe(160);
    });

    it("setOutlineWidth clamps to max 400", () => {
      useAppStore.getState().setOutlineWidth(500);
      expect(useAppStore.getState().outlineWidth).toBe(400);
    });

    it("setOutlineWidth accepts values within range", () => {
      useAppStore.getState().setOutlineWidth(250);
      expect(useAppStore.getState().outlineWidth).toBe(250);
    });

    it("resetOutlineWidth resets to 200", () => {
      useAppStore.getState().setOutlineWidth(350);
      useAppStore.getState().resetOutlineWidth();
      expect(useAppStore.getState().outlineWidth).toBe(200);
    });

    it("width persists across toggleOutline on/off", () => {
      useAppStore.getState().setOutlineWidth(300);
      useAppStore.getState().toggleOutline(); // off
      useAppStore.getState().toggleOutline(); // on
      expect(useAppStore.getState().outlineWidth).toBe(300);
    });
  });

  describe("toggleOutline", () => {
    it("toggles outlineVisible from true to false", () => {
      useAppStore.getState().toggleOutline();
      expect(useAppStore.getState().outlineVisible).toBe(false);
    });

    it("toggles outlineVisible from false to true", () => {
      useAppStore.setState({ outlineVisible: false });
      useAppStore.getState().toggleOutline();
      expect(useAppStore.getState().outlineVisible).toBe(true);
    });
  });

  describe("customCSS", () => {
    it("setCustomCSS sets both path and content", () => {
      useAppStore.getState().setCustomCSS("/path/to/theme.css", "body { color: red; }");
      const state = useAppStore.getState();
      expect(state.customCSSPath).toBe("/path/to/theme.css");
      expect(state.customCSSContent).toBe("body { color: red; }");
    });

    it("clearCustomCSS resets both to null/empty", () => {
      useAppStore.getState().setCustomCSS("/path/to/theme.css", "body { color: red; }");
      useAppStore.getState().clearCustomCSS();
      const state = useAppStore.getState();
      expect(state.customCSSPath).toBeNull();
      expect(state.customCSSContent).toBe("");
    });
  });

  describe("tabs", () => {
    it("selectFile opens a tab and sets activeTab", () => {
      useAppStore.getState().selectFile("/project/readme.md");
      const state = useAppStore.getState();
      expect(state.selectedFile).toBe("/project/readme.md");
      expect(state.activeTab).toBe("/project/readme.md");
      expect(state.openTabs).toHaveLength(1);
      expect(state.openTabs[0].filePath).toBe("/project/readme.md");
      expect(state.openTabs[0].scrollPosition).toBe(0);
    });

    it("selectFile does not duplicate tabs", () => {
      useAppStore.getState().selectFile("/project/readme.md");
      useAppStore.getState().selectFile("/project/readme.md");
      expect(useAppStore.getState().openTabs).toHaveLength(1);
    });

    it("selectFile opens multiple tabs for different files", () => {
      useAppStore.getState().selectFile("/project/readme.md");
      useAppStore.getState().selectFile("/project/notes.md");
      const state = useAppStore.getState();
      expect(state.openTabs).toHaveLength(2);
      expect(state.activeTab).toBe("/project/notes.md");
    });

    it("openTab adds to openTabs and sets activeTab", () => {
      useAppStore.getState().openTab("/project/readme.md");
      const state = useAppStore.getState();
      expect(state.activeTab).toBe("/project/readme.md");
      expect(state.openTabs).toHaveLength(1);
    });

    it("closeTab removes the tab", () => {
      useAppStore.getState().selectFile("/project/a.md");
      useAppStore.getState().selectFile("/project/b.md");
      useAppStore.getState().closeTab("/project/a.md");
      const state = useAppStore.getState();
      expect(state.openTabs).toHaveLength(1);
      expect(state.openTabs[0].filePath).toBe("/project/b.md");
    });

    it("closeTab selects adjacent tab when closing active tab", () => {
      useAppStore.getState().selectFile("/project/a.md");
      useAppStore.getState().selectFile("/project/b.md");
      useAppStore.getState().selectFile("/project/c.md");
      // Active is c.md, close it
      useAppStore.getState().closeTab("/project/c.md");
      const state = useAppStore.getState();
      expect(state.activeTab).toBe("/project/b.md");
      expect(state.selectedFile).toBe("/project/b.md");
    });

    it("closeTab clears selection when last tab is closed", () => {
      useAppStore.getState().selectFile("/project/a.md");
      useAppStore.getState().closeTab("/project/a.md");
      const state = useAppStore.getState();
      expect(state.openTabs).toHaveLength(0);
      expect(state.activeTab).toBeNull();
      expect(state.selectedFile).toBeNull();
    });

    it("closeTab does nothing for unknown file", () => {
      useAppStore.getState().selectFile("/project/a.md");
      useAppStore.getState().closeTab("/project/nonexistent.md");
      expect(useAppStore.getState().openTabs).toHaveLength(1);
    });

    it("setTabScrollPosition updates scroll position for a tab", () => {
      useAppStore.getState().selectFile("/project/readme.md");
      useAppStore.getState().setTabScrollPosition("/project/readme.md", 500);
      expect(useAppStore.getState().openTabs[0].scrollPosition).toBe(500);
    });

    it("setTabScrollPosition does not affect other tabs", () => {
      useAppStore.getState().selectFile("/project/a.md");
      useAppStore.getState().selectFile("/project/b.md");
      useAppStore.getState().setTabScrollPosition("/project/a.md", 100);
      expect(useAppStore.getState().openTabs[1].scrollPosition).toBe(0);
    });
  });

  describe("removeProject with tabs", () => {
    it("removes tabs belonging to the removed project", () => {
      useAppStore.getState().addProject("/project", []);
      useAppStore.getState().selectFile("/project/readme.md");
      useAppStore.getState().selectFile("/project/notes.md");
      useAppStore.getState().removeProject("/project");
      expect(useAppStore.getState().openTabs).toHaveLength(0);
      expect(useAppStore.getState().activeTab).toBeNull();
    });

    it("preserves tabs from other projects", () => {
      useAppStore.getState().addProject("/project-a", []);
      useAppStore.getState().addProject("/project-b", []);
      useAppStore.getState().selectFile("/project-a/readme.md");
      useAppStore.getState().selectFile("/project-b/notes.md");
      useAppStore.getState().removeProject("/project-a");
      const state = useAppStore.getState();
      expect(state.openTabs).toHaveLength(1);
      expect(state.openTabs[0].filePath).toBe("/project-b/notes.md");
    });
  });

  describe("updateProjectTree with tabs", () => {
    it("remaps tab filePaths when a file is renamed", () => {
      useAppStore.getState().addProject("/project", []);
      useAppStore.getState().selectFile("/project/old.md");
      useAppStore.getState().updateProjectTree("/project", [], "/project/old.md", "/project/new.md");
      const state = useAppStore.getState();
      expect(state.openTabs[0].filePath).toBe("/project/new.md");
      expect(state.activeTab).toBe("/project/new.md");
    });

    it("remaps nested tab paths when a directory is renamed", () => {
      useAppStore.getState().addProject("/project", []);
      useAppStore.getState().selectFile("/project/docs/readme.md");
      useAppStore.getState().updateProjectTree("/project", [], "/project/docs", "/project/notes");
      expect(useAppStore.getState().openTabs[0].filePath).toBe("/project/notes/readme.md");
    });

    it("does not remap tabs when no oldPath/newPath provided", () => {
      useAppStore.getState().addProject("/project", []);
      useAppStore.getState().selectFile("/project/readme.md");
      useAppStore.getState().updateProjectTree("/project", []);
      expect(useAppStore.getState().openTabs[0].filePath).toBe("/project/readme.md");
    });
  });

  describe("toggleStyleCheck", () => {
    it("toggles styleCheckEnabled from false to true", () => {
      useAppStore.getState().toggleStyleCheck();
      expect(useAppStore.getState().styleCheckEnabled).toBe(true);
    });

    it("toggles styleCheckEnabled from true to false", () => {
      useAppStore.setState({ styleCheckEnabled: true });
      useAppStore.getState().toggleStyleCheck();
      expect(useAppStore.getState().styleCheckEnabled).toBe(false);
    });
  });
});
