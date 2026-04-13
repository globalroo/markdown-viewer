import { useAppStore } from "../store";
import { useCallback, useMemo, useState, useRef, useEffect } from "react";
import { ChevronIcon, FolderIcon, FileIcon } from "./Icons";
import { ContextMenu } from "./ContextMenu";

function countFiles(nodes: TreeNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.type === "file") count++;
    else if (node.children) count += countFiles(node.children);
  }
  return count;
}

function buildCountMap(nodes: TreeNode[], map: Map<string, number>): void {
  for (const node of nodes) {
    if (node.type === "directory" && node.children) {
      map.set(node.path, countFiles(node.children));
      buildCountMap(node.children, map);
    }
  }
}

function filterTree(nodes: TreeNode[], query: string, connectedPaths?: Set<string>): TreeNode[] {
  if (!query && !connectedPaths) return nodes;
  const lower = query ? query.toLowerCase() : "";

  return nodes
    .map((node) => {
      if (node.type === "file") {
        const matchesQuery = !query || node.name.toLowerCase().includes(lower);
        const matchesConnected = !connectedPaths || connectedPaths.has(node.path);
        return matchesQuery && matchesConnected ? node : null;
      }
      const filteredChildren = filterTree(node.children || [], query, connectedPaths);
      if (filteredChildren.length > 0) {
        return { ...node, children: filteredChildren };
      }
      if (query && node.name.toLowerCase().includes(lower)) {
        // Directory name matches search, but still apply connected paths filter
        if (connectedPaths) {
          const connectedChildren = filterTree(node.children || [], "", connectedPaths);
          return connectedChildren.length > 0 ? { ...node, children: connectedChildren } : null;
        }
        return node;
      }
      return null;
    })
    .filter(Boolean) as TreeNode[];
}

function RenameInput({
  node,
  projectRootPath,
  onDone,
}: {
  node: TreeNode;
  projectRootPath: string;
  onDone: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(node.name);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      // Select filename stem (before last dot)
      const dotIdx = node.name.lastIndexOf(".");
      if (dotIdx > 0) {
        inputRef.current.setSelectionRange(0, dotIdx);
      } else {
        inputRef.current.select();
      }
    }
  }, [node.name]);

  const handleSubmit = useCallback(async () => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === node.name) {
      onDone();
      return;
    }

    try {
      const { newPath } = await window.api.renameFile(node.path, trimmed);
      // Find project and re-scan tree
      const state = useAppStore.getState();
      const project = state.projects.find((p) => p.rootPath === projectRootPath);
      if (project) {
        const newTree = await window.api.scanDirectory(projectRootPath);
        state.updateProjectTree(project.id, newTree, node.path, newPath);
      }
      onDone();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Rename failed";
      setError(msg);
    }
  }, [value, node.path, node.name, projectRootPath, onDone]);

  return (
    <span className="tree-rename-wrapper">
      <input
        ref={inputRef}
        className="tree-rename-input"
        value={value}
        onChange={(e) => { setValue(e.target.value); setError(null); }}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit();
          if (e.key === "Escape") onDone();
          e.stopPropagation();
        }}
        onBlur={handleSubmit}
        title={error || undefined}
        style={error ? { borderColor: "var(--error, #e55)" } : undefined}
      />
    </span>
  );
}

function TreeItem({
  node,
  depth,
  projectRootPath,
  fileCountMap,
}: {
  node: TreeNode;
  depth: number;
  projectRootPath: string;
  fileCountMap: Map<string, number>;
}) {
  const { expandedDirs, toggleDir, selectedFile, selectFile, renamingPath, setRenamingPath } = useAppStore();
  const isExpanded = expandedDirs.has(node.path);
  const isSelected = selectedFile === node.path;
  const isRenaming = renamingPath === node.path;

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const DRAG_MIME = "application/x-viewmd-path";

  const handleClick = useCallback(() => {
    if (node.type === "directory") {
      toggleDir(node.path);
    } else {
      selectFile(node.path);
    }
  }, [node.path, node.type, toggleDir, selectFile]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (node.type !== "file") return;
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, [node.type]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "F2" && node.type === "file" && isSelected) {
      e.preventDefault();
      setRenamingPath(node.path);
    }
  }, [node.path, node.type, isSelected, setRenamingPath]);

  const handleDragStart = useCallback((e: React.DragEvent) => {
    if (node.type !== "file") {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData(DRAG_MIME, JSON.stringify({ path: node.path, projectRootPath }));
    e.dataTransfer.effectAllowed = "move";
  }, [node.type, node.path, projectRootPath]);

  // For files, the drop target is the containing directory
  const dropTargetPath = node.type === "directory" ? node.path : node.path.replace(/[/\\][^/\\]+$/, "");

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
      if (sourceDir === dropTargetPath) return;

      // Guard: don't drop on self
      if (sourcePath === node.path) return;

      const { newPath } = await window.api.moveFile(sourcePath, dropTargetPath);

      const state = useAppStore.getState();

      // Re-scan source project
      const sourceProject = state.projects.find((p) => p.rootPath === sourceRoot);
      if (sourceProject) {
        const newTree = await window.api.scanDirectory(sourceRoot);
        state.updateProjectTree(sourceProject.id, newTree, sourcePath, newPath);
      }

      // Re-scan destination project if different
      if (sourceRoot !== projectRootPath) {
        const destProject = state.projects.find((p) => p.rootPath === projectRootPath);
        if (destProject) {
          const newTree = await window.api.scanDirectory(projectRootPath);
          state.updateProjectTree(destProject.id, newTree);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Move failed";
      alert(msg);
    }
  }, [node.path, dropTargetPath, projectRootPath]);

  return (
    <>
      <button
        className={`tree-item ${isSelected ? "selected" : ""} ${isDragOver ? "drag-over" : ""}`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onKeyDown={handleKeyDown}
        draggable={node.type === "file"}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        title={node.path}
      >
        <span className="tree-icon">
          {node.type === "directory" ? (
            <>
              <ChevronIcon expanded={isExpanded} />
            </>
          ) : (
            <FileIcon />
          )}
        </span>
        {node.type === "directory" && (
          <span className="tree-icon-secondary">
            <FolderIcon open={isExpanded} />
          </span>
        )}
        {isRenaming ? (
          <RenameInput
            node={node}
            projectRootPath={projectRootPath}
            onDone={() => setRenamingPath(null)}
          />
        ) : (
          <span className="tree-label">{node.name}</span>
        )}
        {node.type === "directory" && fileCountMap.has(node.path) && (
          <span className="tree-count-badge" aria-label={`${fileCountMap.get(node.path)} files`}>
            {fileCountMap.get(node.path)}
          </span>
        )}
      </button>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={[
            {
              label: "Rename",
              onClick: () => setRenamingPath(node.path),
            },
          ]}
          onClose={() => setContextMenu(null)}
        />
      )}

      {node.type === "directory" && isExpanded && node.children && (
        <div className="tree-children">
          {node.children.map((child) => (
            <TreeItem key={child.path} node={child} depth={depth + 1} projectRootPath={projectRootPath} fileCountMap={fileCountMap} />
          ))}
        </div>
      )}
    </>
  );
}

export function FileTree({
  tree,
  searchQuery,
  projectRootPath,
  connectedPaths,
}: {
  tree: TreeNode[];
  searchQuery: string;
  projectRootPath: string;
  connectedPaths?: Set<string>;
}) {
  const filteredTree = useMemo(
    () => filterTree(tree, searchQuery, connectedPaths),
    [tree, searchQuery, connectedPaths]
  );

  // Compute counts from the ORIGINAL tree so badges are stable during search
  const fileCountMap = useMemo(() => {
    const map = new Map<string, number>();
    buildCountMap(tree, map);
    return map;
  }, [tree]);

  if (filteredTree.length === 0 && searchQuery) {
    return <div className="tree-empty">No matches</div>;
  }

  if (filteredTree.length === 0) {
    return <div className="tree-empty">No markdown files found</div>;
  }

  return (
    <div className="file-tree">
      {filteredTree.map((node) => (
        <TreeItem key={node.path} node={node} depth={0} projectRootPath={projectRootPath} fileCountMap={fileCountMap} />
      ))}
    </div>
  );
}
