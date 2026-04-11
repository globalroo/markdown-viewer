import { useCallback } from "react";
import { useAppStore } from "../store";

function LinkIcon() {
  return (
    <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 7L7 5" />
      <path d="M3.5 8.5a2.12 2.12 0 01-3-3L3 3" />
      <path d="M8.5 3.5a2.12 2.12 0 013 3L9 9" />
    </svg>
  );
}

function getFileName(filePath: string): string {
  return filePath.split(/[/\\]/).pop() || filePath;
}

function getRelativeDir(filePath: string): string {
  const parts = filePath.split(/[/\\]/);
  if (parts.length <= 2) return "";
  return parts.slice(-2, -1)[0];
}

interface LinkItemProps {
  filePath: string;
  context?: { line: number; text: string }[];
  onNavigate: (filePath: string) => void;
}

function LinkItem({ filePath, context, onNavigate }: LinkItemProps) {
  const dir = getRelativeDir(filePath);

  return (
    <button
      className="link-item"
      onClick={() => onNavigate(filePath)}
      title={filePath}
    >
      <LinkIcon />
      <span className="link-item-filename">{getFileName(filePath)}</span>
      {dir && <span className="link-item-dir">{dir}/</span>}
      {context && context.length > 0 && (
        <span className="link-item-context" title={context[0].text}>
          L{context[0].line}
        </span>
      )}
    </button>
  );
}

export function LinksPanel() {
  const linkGraph = useAppStore((s) => s.linkGraph);
  const selectFile = useAppStore((s) => s.selectFile);
  const selectedFile = useAppStore((s) => s.selectedFile);

  const handleNavigate = useCallback(async (filePath: string) => {
    try {
      const content = await window.api.readFile(filePath);
      const store = useAppStore.getState();
      store.selectFile(filePath);
      store.setMarkdownContent(content);
      store.openTab(filePath);
    } catch {
      // File may not exist (broken link)
    }
  }, []);

  if (!linkGraph || !selectedFile) {
    return (
      <div className="links-panel-empty">
        <p>No link data available</p>
      </div>
    );
  }

  const { outgoing, incoming, outgoingContexts, incomingContexts } = linkGraph;

  return (
    <div className="links-panel-body">
      <div className="links-section">
        <div className="links-section-header">
          Outgoing ({outgoing.length})
        </div>
        {outgoing.length === 0 ? (
          <div className="links-empty">No outgoing links</div>
        ) : (
          outgoing.map((path: string) => (
            <LinkItem
              key={path}
              filePath={path}
              context={outgoingContexts?.[path]}
              onNavigate={handleNavigate}
            />
          ))
        )}
      </div>
      <div className="links-section">
        <div className="links-section-header">
          Incoming ({incoming.length})
        </div>
        {incoming.length === 0 ? (
          <div className="links-empty">No incoming links</div>
        ) : (
          incoming.map((path: string) => (
            <LinkItem
              key={path}
              filePath={path}
              context={incomingContexts?.[path]}
              onNavigate={handleNavigate}
            />
          ))
        )}
      </div>
    </div>
  );
}
