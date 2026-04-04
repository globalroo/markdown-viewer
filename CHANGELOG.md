# Changelog

## [1.4.1] - 2026-04-04

### Added

- **Elegant print output** — comprehensive print styles producing well-typeset documents. 11pt body, booktabs tables, smart link URLs, orphans/widows control.
- Typography preferences (line height, font) carry into print.
- Theme colours stripped for B&W printer compatibility.
- Syntax highlighting stripped in print (comments preserved in italic grey).
- Printing from edit mode now shows preview content instead of blank page.
- 5 new E2E print tests (140 total).

## [1.4.0] - 2026-04-04

### Added

- **Reading comfort themes** — Sepia (warm parchment), Sage (light green, backed by 2025 peer-reviewed study), Twilight Reader (warm dark). All WCAG AA contrast verified.
- **Typography controls** — adjustable line width (Narrow/Standard/Wide) and line spacing (Compact/Optimal/Relaxed) in Settings.
- **Focus mode** — `Cmd/Ctrl+Shift+F` hides all chrome for distraction-free reading. Escape to exit.
- **Warm filter** — subtle sepia CSS filter toggle for evening reading. Reduces blue light.
- **Reading progress bar** — thin compositor-friendly bar tracking scroll position. Hidden in edit mode and focus mode.
- 20 new unit tests + 8 new E2E tests (133 total).

### Fixed

- Settings dialog scroll jank on Intel Mac — removed `backdrop-filter: blur()`, added `contain: paint` for compositor-isolated scrolling.
- Progress bar re-derives position correctly when exiting edit mode.

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
