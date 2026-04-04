import { useAppStore } from "../store";
import { FileTree } from "./FileTree";
import { useCallback, useState } from "react";
import { ChevronIcon, ProjectIcon, AddFolderIcon } from "./Icons";

const DRAG_MIME = "application/x-viewmd-path";

function ProjectSection({ project }: { project: { id: string; rootPath: string; name: string; tree: TreeNode[]; isExpanded: boolean } }) {
  const { toggleProject, removeProject, searchQuery } = useAppStore();
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    setIsDragOver(false);
    const raw = e.dataTransfer.getData(DRAG_MIME);
    if (!raw) return;
    e.preventDefault();

    try {
      const { path: sourcePath, projectRootPath: sourceRoot } = JSON.parse(raw);

      // Guard: no drop on own parent
      const sourceDir = sourcePath.replace(/[/\\][^/\\]+$/, "");
      if (sourceDir === project.rootPath) return;

      const { newPath } = await window.api.moveFile(sourcePath, project.rootPath);

      const state = useAppStore.getState();

      // Re-scan source project
      const sourceProject = state.projects.find((p) => p.rootPath === sourceRoot);
      if (sourceProject) {
        const newTree = await window.api.scanDirectory(sourceRoot);
        state.updateProjectTree(sourceProject.id, newTree, sourcePath, newPath);
      }

      // Re-scan destination project if different
      if (sourceRoot !== project.rootPath) {
        const newTree = await window.api.scanDirectory(project.rootPath);
        state.updateProjectTree(project.id, newTree);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Move failed";
      alert(msg);
    }
  }, [project.rootPath, project.id]);

  return (
    <div className="project-section">
      <div
        className={`project-header ${isDragOver ? "drag-over" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <button
          className="project-toggle"
          onClick={() => toggleProject(project.id)}
          title={project.rootPath}
        >
          <span className="tree-icon">
            <ChevronIcon expanded={project.isExpanded} />
          </span>
          <span className="tree-icon-secondary">
            <ProjectIcon open={project.isExpanded} />
          </span>
          <span className="project-name">{project.name}</span>
        </button>
        <button
          className="project-remove"
          onClick={() => removeProject(project.id)}
          title="Remove project"
          aria-label={`Remove ${project.name}`}
        >
          <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <line x1="2" y1="2" x2="10" y2="10" />
            <line x1="10" y1="2" x2="2" y2="10" />
          </svg>
        </button>
      </div>
      {project.isExpanded && (
        <div className="project-tree">
          <FileTree tree={project.tree} searchQuery={searchQuery} projectRootPath={project.rootPath} />
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const { projects, searchQuery, setSearchQuery, sidebarVisible } = useAppStore();

  const handleAddFolder = useCallback(async () => {
    const result = await window.api.openFolder();
    if (result) {
      useAppStore.getState().addProject(result.rootPath, result.tree);
    }
  }, []);

  if (!sidebarVisible) return null;

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <button className="open-folder-btn" onClick={handleAddFolder} title="Add Project Folder">
          <AddFolderIcon /> Add Folder
        </button>
      </div>

      {projects.length > 0 && (
        <div className="search-container">
          <input
            type="text"
            className="search-input"
            placeholder="Filter files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="search-clear"
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
            >
              <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <line x1="1" y1="1" x2="9" y2="9" />
                <line x1="9" y1="1" x2="1" y2="9" />
              </svg>
            </button>
          )}
        </div>
      )}

      <div className="sidebar-content">
        {projects.map((project) => (
          <ProjectSection key={project.id} project={project} />
        ))}

        {projects.length === 0 && (
          <div className="sidebar-empty">
            <p>Add a folder to browse markdown files</p>
            <p className="shortcut-hint">
              {navigator.platform.includes("Mac") ? "⌘" : "Ctrl+"}O
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
