# Changelog

## [1.7.2] - 2026-04-13

### Fixed

- **React #300 crash on close-all-tabs** — `LinksPanel` called two `useAppStore` subscriptions after an early return, so the hook count flipped between 4 and 6 as `selectedFile` transitioned. React 19 production throws minified error #300 ("Rendered fewer hooks than expected") on hook-count mismatches; dev only warns, which is why the crash only reproduced in the packaged DMG. Moved both subscriptions above the early return so the hook count is invariant across renders.
- **Silent e2e test skip masked the bug** — `close-all-tabs.test.ts` already had a scenario exercising the Links panel during close-all, but the selector (`.segmented-btn:text-is("Links")`) targeted the wrong CSS class (Settings controls, not the outline Links button). The `if (count > 0)` guard silently skipped the click for months. Fixed selector to `.outline-segment`, removed the silent-skip guard, and added a `toBeVisible` assertion so future class renames fail loudly.
- **Real stale-closure bugs surfaced by the new lint gate**:
  - `CollapsiblePreview.toggle` missed `searchExpanded` in its deps — the callback retained a stale `false` value, allowing fold-state mutation during search-expanded mode (which the comment explicitly forbids).
  - `CollapsiblePreview.links` `|| {}` fallback allocated a fresh object every render, invalidating the `preambleHtml` useMemo deps on every render. Wrapped in its own `useMemo` to stabilise the reference.
  - `FileTree.handleDrop` missed `dropTargetPath` in its deps.
  - `MarkdownPreview.handleExport{HTML,DOCX}` had redundant `sectionModel` deps.
  - `Sidebar` search-results click handler had a redundant `selectFile` dep from an unused subscription.

### Added

- **ESLint gate** — new flat config (`eslint.config.mjs`) with `eslint-plugin-react-hooks`. The `rules-of-hooks` rule catches the conditional-hook-call class of bug statically, at lint time, before any runtime reproduction is needed. `exhaustive-deps` is also enabled as `error` (after clearing the existing backlog), catching stale-closure bugs in the same pass.
- **CI workflow** (`.github/workflows/ci.yml`) — runs lint, typecheck/build, and unit tests on every PR and push to main. Replaces the previous release-only CI.
- **LinksPanel regression unit test** — verified to hard-fail on the pre-fix code via React's "Rendered more hooks than during the previous render" invariant, so future regressions of the same class produce a loud, immediate failure rather than a silent production crash.
- **Focused React #300 e2e test** — dedicated `close-all-tabs.test.ts` entry that opens the Links panel and closes all tabs, asserting no console errors or React hook warnings. Named unambiguously so future readers can identify the guarded scenario at a glance.

### Changed

- **Console listeners in close-all e2e tests** now collect React-hook-related `console.warn` messages in addition to `console.error`, closing the gap where dev-mode hook warnings were ignored.
- **Dead imports removed** — `buildLinkIndex` (main.ts), `memo` (FileTree.tsx), `useCallback`/`useState`/`FontId` (Settings.tsx), `toggleStyleCheck` subscription (MarkdownPreview.tsx), `selectFile` subscription (LinksPanel.tsx, Sidebar.tsx).

## [1.7.1] - 2026-04-13

### Added

- **Error boundary** — React crashes now show the error message, stack trace, and a recovery button instead of a blank white screen. Logs the error to console for debugging.
- **Close-all-tabs E2E test suite** — 10 Playwright tests covering: closing 15 tabs one-by-one, edit mode, rapid close, collapsible mode, mixed fold states across files, links panel active, style check, outline visible, mermaid/math/wiki-link content, sepia theme, and post-close recovery.

### Fixed

- **Edit state reset on last tab close** — closing the final tab now fully resets `editMode`, `editContent`, `editDirty`, and `editFilePath` to prevent orphaned edit state.
- **Cmd+W always prevented** — `preventDefault()` fires unconditionally on Cmd/Ctrl+W (ahead of the settings/editing guards) so Electron never falls through to "Close Window". Tab closure is whitelisted inside the editor textarea so Cmd+W still closes the active tab while editing.
- **Print from edit mode** — replaced the inline `display: none` on `.preview-content` with a `.preview-content-hidden` CSS class so the `@media print` override (`display: block !important`) reliably wins the cascade. Fixes flaky print-mode E2E test and blank-preview behaviour when printing from edit mode.

## [1.7.0] - 2026-04-12

### Added

- **Collapsible document view** — opt-in preview mode that renders headings as an always-visible expandable/collapsible tree. Default starts collapsed for instant document overview. Keyboard navigation (j/k move, Enter/Space expand, Escape collapse, [ ] collapse/expand all). Cmd+F auto-expands all sections for native find, Escape restores previous state.
- **Fold state persistence** — expanded/collapsed state saved per document across sessions. Debounced writes with LRU cap (300 documents). Heading ID transfer via LCS diff preserves state across document edits.
- **Link intelligence** — main-process link index parses all markdown files for forward/backlinks (standard links + wiki-links). Async chunked build prevents UI freeze on large projects. Incremental updates on file change, rename, move.
- **Links panel** — right-side panel showing outgoing and incoming links for the selected file. Click to navigate. Segmented control switches between Contents (outline) and Links views.
- **Broken/stale link detection** — outgoing links show visual indicators: dimmed + strikethrough for missing targets, orange dot for files modified since last viewed.
- **Connected files filter** — filter sidebar file tree to show only documents linked to/from the selected file. 1-hop and 2-hop depth selector. Dismissible pill in sidebar. Auto-expands ancestor directories.
- **Right panel font scaling** — outline and links panel text scales proportionally with A+/A- font size controls via container-level em inheritance.
- **Left-border spine** — heading rows in collapsible mode show accent-colored left border fading by depth level for instant hierarchy recognition.
- **Comprehensive test suite** — 74 E2E tests (Playwright) + 235 unit tests (Vitest) = 309 total, covering all new features, edge cases, layout verification, and regression scenarios.

### Fixed

- **Path traversal prevention** — link index validates resolved paths against allowed project roots using realpathSync canonicalization. Prevents filesystem information disclosure via malicious relative links.
- **Atomic JSON writes** — fold-state.json and user-config.json use write-tmp-then-rename pattern to prevent corruption on process crash. Failed writes retry automatically.
- **Edit mode performance** — HTML rendering skipped when preview is hidden during editing. Section model still rebuilds so document outline stays in sync.
- **Export in edit mode** — HTML/DOCX export renders from current draft on demand instead of stale last-previewed content. Works correctly after save (editMode vs editDirty).
- **Safe navigation** — all file navigation (links panel, wiki-links, content search) goes through the dirty-draft save/discard guard.
- **Style check in collapsible mode** — MutationObserver re-applies prose highlights when collapsible sections expand.
- **DOMPurify config** — shared sanitization config extracted to prevent drift between standard and collapsible preview.
- **Search/Escape interaction** — fold mutations locked during Cmd+F search-expanded state to prevent accidental persistence of transient state.

### Changed

- **Document outline** — now derives headings from shared section model (token-annotated heading IDs) instead of DOM scraping. IntersectionObserver tracks headings by ID for mode-agnostic active heading highlight.
- **Heading hierarchy in collapsible mode** — compressed document typography (L1=1.6em/700 → L6=0.95em/600) with 0.88em body text for clear scanability. Content indentation aligns with own heading level.
- **Shared wiki-link regex** — extracted to src/shared/linkPatterns.ts, used by both renderer and main process.

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
