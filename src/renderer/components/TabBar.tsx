import { useCallback } from "react";
import { useAppStore } from "../store";

export function TabBar() {
  const openTabs = useAppStore((s) => s.openTabs);
  const activeTab = useAppStore((s) => s.activeTab);
  const editDirty = useAppStore((s) => s.editDirty);
  const editFilePath = useAppStore((s) => s.editFilePath);
  const selectFile = useAppStore((s) => s.selectFile);
  const closeTab = useAppStore((s) => s.closeTab);

  const handleTabClick = useCallback(
    (filePath: string) => {
      selectFile(filePath);
    },
    [selectFile]
  );

  const handleMiddleClick = useCallback(
    (e: React.MouseEvent, filePath: string) => {
      if (e.button === 1) {
        e.preventDefault();
        closeTab(filePath);
      }
    },
    [closeTab]
  );

  const handleCloseClick = useCallback(
    (e: React.MouseEvent, filePath: string) => {
      e.stopPropagation();
      closeTab(filePath);
    },
    [closeTab]
  );

  if (openTabs.length === 0) return null;

  return (
    <div className="tab-bar">
      {openTabs.map((tab) => {
        const fileName = tab.filePath.split(/[/\\]/).pop() || "";
        const isActive = tab.filePath === activeTab;
        const isDirty = editDirty && editFilePath === tab.filePath;
        return (
          <button
            key={tab.filePath}
            className={`tab ${isActive ? "active" : ""}`}
            onClick={() => handleTabClick(tab.filePath)}
            onMouseDown={(e) => handleMiddleClick(e, tab.filePath)}
            title={tab.filePath}
          >
            <span className="tab-label">
              {fileName}
              {isDirty && <span className="tab-dirty"> ●</span>}
            </span>
            <span
              className="tab-close"
              onClick={(e) => handleCloseClick(e, tab.filePath)}
              role="button"
              aria-label={`Close ${fileName}`}
            >
              ×
            </span>
          </button>
        );
      })}
    </div>
  );
}
