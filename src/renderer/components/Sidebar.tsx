import { useAppStore } from "../store";
import { FileTree } from "./FileTree";
import { useCallback } from "react";

function ProjectSection({ project }: { project: { id: string; rootPath: string; name: string; tree: TreeNode[]; isExpanded: boolean } }) {
  const { toggleProject, removeProject, searchQuery } = useAppStore();

  return (
    <div className="project-section">
      <div className="project-header">
        <button
          className="project-toggle"
          onClick={() => toggleProject(project.id)}
          title={project.rootPath}
        >
          <span className="tree-icon">{project.isExpanded ? "▼" : "▶"}</span>
          <span className="project-name">📁 {project.name}</span>
        </button>
        <button
          className="project-remove"
          onClick={() => removeProject(project.id)}
          title="Remove project"
        >
          ×
        </button>
      </div>
      {project.isExpanded && (
        <div className="project-tree">
          <FileTree tree={project.tree} searchQuery={searchQuery} />
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
        <button className="open-folder-btn" onClick={handleAddFolder} title="Add Project Folder (⌘O)">
          + Add Folder
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
            >
              ×
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
            <p className="shortcut-hint">⌘O / Ctrl+O</p>
          </div>
        )}
      </div>
    </aside>
  );
}
