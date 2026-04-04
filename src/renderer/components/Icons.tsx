export function FolderIcon({ open }: { open?: boolean }) {
  if (open) {
    return (
      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 14h10l2-6H4L2 14z" />
        <path d="M2 14V3a1 1 0 011-1h3.5l2 2H13a1 1 0 011 1v2" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 13V3a1 1 0 011-1h3.5l2 2H13a1 1 0 011 1v8a1 1 0 01-1 1H3a1 1 0 01-1-1z" />
    </svg>
  );
}

export function FileIcon() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 1h5l4 4v9a1 1 0 01-1 1H4a1 1 0 01-1-1V2a1 1 0 011-1z" />
      <polyline points="9,1 9,5 13,5" />
      <line x1="5" y1="8" x2="11" y2="8" />
      <line x1="5" y1="10.5" x2="9" y2="10.5" />
    </svg>
  );
}

export function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      aria-hidden="true"
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
        transition: "transform 0.15s ease",
      }}
    >
      <polyline points="3,1.5 7,5 3,8.5" />
    </svg>
  );
}

export function ProjectIcon({ open }: { open?: boolean }) {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="2" width="14" height="12" rx="2" />
      <line x1="1" y1="6" x2="15" y2="6" />
      {open && (
        <>
          <line x1="5" y1="9" x2="11" y2="9" />
          <line x1="5" y1="11.5" x2="9" y2="11.5" />
        </>
      )}
    </svg>
  );
}

export function AddFolderIcon() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 13V3a1 1 0 011-1h3.5l2 2H13a1 1 0 011 1v8a1 1 0 01-1 1H3a1 1 0 01-1-1z" />
      <line x1="8" y1="7" x2="8" y2="12" />
      <line x1="5.5" y1="9.5" x2="10.5" y2="9.5" />
    </svg>
  );
}

export function RevealIcon() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h10a1 1 0 001-1v-3" />
      <polyline points="9,1 15,1 15,7" />
      <line x1="15" y1="1" x2="7" y2="9" />
    </svg>
  );
}
