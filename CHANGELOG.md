# Changelog

## [1.3.1] - 2026-04-04

### Added

- **File count badges** — each folder in the file tree shows a pill badge with the total number of markdown files it contains (including nested subdirectories). Count is stable during search filtering and memoized for performance.

## [1.3.0] - 2026-04-04

### Added

- **Edit/Preview mode** — toggle between viewing rendered markdown and editing raw markdown in a textarea (`Cmd/Ctrl+E`). Explicit save with `Cmd/Ctrl+S`, dirty indicator, and unsaved changes guard on file switch and window close.
- **Right-click rename** — right-click any file in the tree to rename it. Also available via F2 keyboard shortcut. Validates filenames (path separators, leading dots, reserved Windows names, markdown extension enforcement).
- **Drag and drop move** — drag markdown files between directories or across projects. Visual drop indicator on both files and directories. Cross-device moves handled via atomic copy+delete fallback.
- **Copy to clipboard** — copy raw markdown content via button in the preview header.
- **Tab key support** — Tab inserts 2 spaces in the editor, Shift+Tab outdents.
- **Keyboard shortcut suppression** — global shortcuts are suppressed while editing to prevent accidental actions.
- **Test suite** — 89 Vitest unit tests (validation, store state machine) and 17 Playwright Electron E2E tests covering all major flows.

### Changed

- Store now tracks `editFilePath` to explicitly bind drafts to their file, preventing cross-file data corruption.
- `removeProject` now notifies the main process to clean up `allowedRoots`.
- IPC handlers for rename and move enforce markdown file extensions on source files.
- Case-only renames supported on case-insensitive filesystems (macOS, Windows).
- Preview renders unsaved draft content when dirty.

### Security

- `rename-file` rejects path separators, leading dots, reserved Windows names, and non-markdown extensions.
- `move-file` validates both source and destination paths, enforces markdown extension on source.
- `write-file` restricted to markdown files only.
- Custom MIME type (`application/x-viewmd-path`) for drag and drop prevents external drag injection.
- Failed saves preserve dirty state — drafts are never silently discarded.

## [1.2.0] - 2026-04-04

### Added

- Linux builds (AppImage + deb)
- Application icon (roo mascot) for all platforms
- README branding and Linux documentation

### Fixed

- Author email for Linux deb package maintainer
- Transparent icon corners for dark theme compatibility
