import { useAppStore } from "../store";
import { FileTree } from "./FileTree";
import { useCallback } from "react";
import { ChevronIcon, ProjectIcon, AddFolderIcon } from "./Icons";

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
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <line x1="2" y1="2" x2="10" y2="10" />
            <line x1="10" y1="2" x2="2" y2="10" />
          </svg>
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
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
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
