# Changelog

## [1.6.3] - 2026-04-11

### Fixed

- **PDF export links** — PDF export no longer appends raw URLs in brackets after link text. Links are clickable in PDFs so the URL display was redundant and wrapped badly across lines. Paper printing via Cmd+P still shows URLs for readability.

## [1.6.2] - 2026-04-11

### Fixed

- **HTML export scroll** — exported HTML no longer clips content below the fold. Standalone override resets `height: auto; overflow: auto` after the app CSS.
- **PDF export background** — PDF output now has a clean white background regardless of active reading theme. Added `background: #fff !important` to `@media print` on `html, body, #root`.
- **DOCX/HTML image embedding** — images are now embedded as base64 data URIs instead of referencing `file://` paths. Word no longer prompts for filesystem permissions. New `embedLocalImages` utility in the main process reads files and validates against `isPathAllowed`.
- **Export URL encoding** — `local-img://` to `file://` conversion now uses a simple protocol swap instead of decode+reconstruct, preventing breakage on filenames containing `#` or `?`.

### Changed

- **"Style" renamed to "Prose"** — writing quality checker button renamed to avoid confusion with font/typography styling. Duplicate button removed from the preview header.
- **Settings icon** — replaced sun/rays icon with a proper gear cog for clarity.
- **Contents toggle** — toolbar button now shows an active/pressed state when the contents panel is open. Label changed from "Outline" to "Contents" for consistency with the panel header. Icon changed to a table-of-contents bullet list.

### Added

- 12 unit tests for `embedLocalImages` (MIME types, security gate, fallbacks, encoding).
- 3 E2E tests for export fixes (HTML scroll, PDF white background, DOCX image embedding).

## [1.6.1] - 2026-04-11

### Fixed

- **HTML image rendering** — raw HTML `<img>` tags in markdown (e.g. `<img src="build/icon.png">`) were not rewritten to the `local-img://` protocol, so images failed to load. Both the markdown renderer and the HTML rewriter now use a shared `resolveLocalImageSrc()` utility.
- **Double-encoding prevention** — pre-encoded URLs (e.g. `my%20file.png`) are decoded before re-encoding, preventing `%20` from becoming `%2520`.
- **Protocol-relative URLs** — `//cdn.example.com/image.png` in both markdown `![]()` and HTML `<img>` syntax is now left unchanged instead of being incorrectly rewritten to `local-img://`.
- **CLI wrapper** — the macOS CLI wrapper now resolves relative paths to absolute before launching the binary directly, fixing `viewmd .` path resolution. Removed `exec` before backgrounded process.

### Added

- **Cross-platform install script** (`scripts/install.sh`) — automates app installation and CLI setup for macOS, Linux (deb + AppImage), and Windows (guidance). Supports `--build` flag. Checks `/Applications` writability for sudo, verifies `dpkg` availability on Linux.
- **Image rendering E2E tests** — 8 new Playwright tests verifying markdown image syntax, HTML `<img>` tag rewriting, protocol serving (naturalWidth > 0), protocol-relative URL passthrough, and double-encoding prevention for both syntaxes.
- **Startup performance tests** — 2 new E2E tests enforcing startup budgets (5s with directory arg, 3s for DOM ready).
- **Image rewrite unit tests** — 17 tests for `resolveLocalImageSrc()` and the HTML regex matcher, importing the real production function.

## [1.6.0] - 2026-04-10

### Added

- **PDF export** — export rendered markdown as PDF via `printToPDF`.
- **DOCX export** — export rendered markdown as Word document via `html-docx-js`.
- **HTML export** — export rendered markdown as standalone HTML with embedded styles.

## [1.5.1] - 2026-04-08

### Added

- **Single-instance CLI** — running `viewmd .` from a second directory adds the folder to the existing sidebar instead of launching a new window. Uses Electron's `requestSingleInstanceLock` with `second-instance` event forwarding.
- **Robust argv parsing** — `findPathArg()` helper skips Chromium-injected `--flags` and resolves relative paths against the correct working directory.
- **README install docs** — complete install and CLI setup instructions for macOS, Windows, and Linux.

## [1.5.0] - 2026-04-08

### Added

- **Sidebar font size control** — Small / Medium / Large via `Aa` button in the sidebar header or Settings > Layout. Driven by `--sidebar-font-size` CSS variable.
- **Resizable sidebar** — drag handle with pointer capture for smooth 60fps resize. Keyboard accessible (Arrow keys for 10px steps, Home/End for min/max). Double-click resets to 280px. Full ARIA `separator` role.
- **Linked font scaling** — `Cmd/Ctrl+/-` now scales both content and sidebar text proportionally. Sidebar Small/Medium/Large becomes a base density preference; zoom scales on top. Offset-based formula guarantees all three presets remain distinct at every zoom level.
- **Full-width content** — new "Full" option in content width (toolbar popover or Settings > Layout > Line Width) removes the `max-width` constraint so content fills the pane in full-screen. Print styles unaffected.
- **Toolbar content width popover** — columns icon button on the toolbar with Narrow / Standard / Wide / Full options.
- **CLI directory open** — `viewmd .` (or any directory/file path) opens that folder in the sidebar automatically on launch. Pull-based IPC replaces the race-prone push-on-`did-finish-load` pattern.
- **Comprehensive test coverage** — 134 unit tests + 52 E2E tests covering all new features including resize keyboard/drag, popover dismiss, linked scaling exact values, CLI launch, and second-instance forwarding.

### Changed

- Settings "Reading Layout" section renamed to "Layout" to accommodate sidebar controls alongside content width and line spacing.

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
