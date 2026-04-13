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

function BrokenLinkIcon() {
  return (
    <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 7L7 5" />
      <path d="M3.5 8.5a2.12 2.12 0 01-3-3L3 3" />
      <path d="M8.5 3.5a2.12 2.12 0 013 3L9 9" />
      <line x1="2" y1="10" x2="10" y2="2" strokeDasharray="2 2" />
    </svg>
  );
}

interface LinkItemProps {
  filePath: string;
  context?: { line: number; text: string }[];
  broken?: boolean;
  stale?: boolean;
  onNavigate: (filePath: string) => void;
}

function LinkItem({ filePath, context, broken, stale, onNavigate }: LinkItemProps) {
  const dir = getRelativeDir(filePath);

  return (
    <button
      className={`link-item${broken ? " broken" : ""}${stale ? " stale" : ""}`}
      onClick={broken ? undefined : () => onNavigate(filePath)}
      title={broken ? `File not found: ${filePath}` : filePath}
      disabled={broken}
    >
      {broken ? <BrokenLinkIcon /> : <LinkIcon />}
      <span className={`link-item-filename${broken ? " link-item-strikethrough" : ""}`}>
        {getFileName(filePath)}
      </span>
      {dir && <span className="link-item-dir">{dir}/</span>}
      {stale && <span className="link-item-stale-dot" title="Content changed since last viewed" />}
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
  const selectedFile = useAppStore((s) => s.selectedFile);
  const linksFilterActive = useAppStore((s) => s.linksFilterActive);
  const toggleLinksFilter = useAppStore((s) => s.toggleLinksFilter);

  const handleNavigate = useCallback((filePath: string) => {
    // Use selectFile + openTab only — MarkdownPreview's useEffect handles
    // reading the file content and the dirty-draft save/discard guard.
    const store = useAppStore.getState();
    store.openTab(filePath);
    store.selectFile(filePath);
  }, []);

  if (!linkGraph || !selectedFile) {
    return (
      <div className="links-panel-empty">
        <p>No link data available</p>
      </div>
    );
  }

  const { outgoing, incoming, outgoingContexts, incomingContexts, outgoingStatus, staleTargets } = linkGraph;
  const totalLinks = outgoing.length + incoming.length;

  return (
    <div className="links-panel-body">
      {totalLinks > 0 && (
        <div className="links-filter-toggle">
          <button
            className={`links-filter-btn${linksFilterActive ? " active" : ""}`}
            onClick={toggleLinksFilter}
            aria-pressed={linksFilterActive}
            title="Filter sidebar to show only linked files"
          >
            {linksFilterActive ? "Showing linked files" : "Filter to linked files"}
          </button>
        </div>
      )}
      <div className="links-section">
        <div className="links-section-header">
          Outgoing ({outgoing.length})
        </div>
        {outgoing.length === 0 ? (
          <div className="links-empty">No outgoing links</div>
        ) : (
          outgoing.map((p: string) => (
            <LinkItem
              key={p}
              filePath={p}
              context={outgoingContexts?.[p]}
              broken={outgoingStatus?.[p]?.exists === false}
              stale={staleTargets?.[p] === true}
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
          incoming.map((p: string) => (
            <LinkItem
              key={p}
              filePath={p}
              context={incomingContexts?.[p]}
              onNavigate={handleNavigate}
            />
          ))
        )}
      </div>
    </div>
  );
}
