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
});
