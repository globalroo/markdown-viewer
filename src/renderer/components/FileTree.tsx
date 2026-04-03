import { useAppStore } from "../store";
import { useCallback, useMemo } from "react";

function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
  if (!query) return nodes;
  const lower = query.toLowerCase();

  return nodes
    .map((node) => {
      if (node.type === "file") {
        return node.name.toLowerCase().includes(lower) ? node : null;
      }
      const filteredChildren = filterTree(node.children || [], query);
      if (filteredChildren.length > 0) {
        return { ...node, children: filteredChildren };
      }
      if (node.name.toLowerCase().includes(lower)) {
        return node;
      }
      return null;
    })
    .filter(Boolean) as TreeNode[];
}

function TreeItem({ node, depth }: { node: TreeNode; depth: number }) {
  const { expandedDirs, toggleDir, selectedFile, selectFile } = useAppStore();
  const isExpanded = expandedDirs.has(node.path);
  const isSelected = selectedFile === node.path;

  const handleClick = useCallback(() => {
    if (node.type === "directory") {
      toggleDir(node.path);
    } else {
      selectFile(node.path);
    }
  }, [node.path, node.type, toggleDir, selectFile]);

  return (
    <>
      <button
        className={`tree-item ${isSelected ? "selected" : ""}`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        onClick={handleClick}
        title={node.path}
      >
        <span className="tree-icon">
          {node.type === "directory" ? (isExpanded ? "▼" : "▶") : "📄"}
        </span>
        <span className="tree-label">{node.name}</span>
      </button>
      {node.type === "directory" && isExpanded && node.children && (
        <div className="tree-children">
          {node.children.map((child) => (
            <TreeItem key={child.path} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </>
  );
}

export function FileTree({
  tree,
  searchQuery,
}: {
  tree: TreeNode[];
  searchQuery: string;
}) {
  const filteredTree = useMemo(
    () => filterTree(tree, searchQuery),
    [tree, searchQuery]
  );

  if (filteredTree.length === 0 && searchQuery) {
    return <div className="tree-empty">No matches</div>;
  }

  if (filteredTree.length === 0) {
    return <div className="tree-empty">No markdown files found</div>;
  }

  return (
    <div className="file-tree">
      {filteredTree.map((node) => (
        <TreeItem key={node.path} node={node} depth={0} />
      ))}
    </div>
  );
}
