<p align="center">
  <img src="build/icon.png" alt="viewmd" width="128" height="128">
</p>

<h1 align="center">viewmd</h1>

<p align="center">
  A fast, cross-platform desktop app for discovering and reading markdown files in repositories and project directories.
  <br><br>
  Open any folder, instantly see every markdown file in a searchable tree, and read them with clean typography, syntax-highlighted code blocks, and light/dark theming.
</p>

## Features

- **Multi-project sidebar** — Add multiple folders, each shown as a collapsible section with its own file tree
- **Search & filter** — Instantly narrow files by name across all projects
- **Rich rendering** — CommonMark + GFM tables, task lists, syntax-highlighted code blocks (16 languages)
- **Edit & preview** — Toggle between rendered preview and a raw markdown editor with `Cmd/Ctrl+E`. Save with `Cmd/Ctrl+S`, dirty indicator, and unsaved changes guard
- **Rename files** — Right-click or press F2 to rename markdown files inline with full validation
- **Drag & drop move** — Drag files between directories or across projects to move them on disk
- **Copy to clipboard** — One-click copy of raw markdown content
- **Local images** — Relative images resolve securely via a custom protocol with path validation
- **Reading comfort themes** — Sepia, Sage (green, research-backed), and Twilight Reader themes designed for long reading sessions. WCAG AA contrast verified
- **Typography controls** — Adjustable line width (Narrow/Standard/Wide) and line spacing (Compact/Optimal/Relaxed) in Settings
- **Focus mode** — `Cmd/Ctrl+Shift+F` hides all chrome for distraction-free reading. Escape to exit
- **Warm filter** — Subtle evening reading filter that reduces blue light. Toggle in Settings
- **Reading progress** — Thin progress bar tracks your scroll position through a document
- **Themes** — 17 themes: system-aware light/dark, reading comfort, colour, and accessibility options
- **Font zoom** — Adjust reading size with keyboard shortcuts (10px–32px range)
- **Print** — Print the rendered markdown, not the raw source
- **File associations** — Register as the default handler for `.md` and `.markdown` files
- **CLI launch** — Open from the terminal pointing at any directory
- **Cross-platform** — macOS, Windows, and Linux
- **Accessible** — ARIA labels, semantic landmarks, keyboard-navigable
- **Collapsible document view** — Opt-in mode showing headings as an always-visible expandable tree. Expand sections to read, collapse to scan. Fold state persists across sessions. Keyboard: j/k navigate, Enter expand, [ ] collapse/expand all
- **Link intelligence** — Tracks inter-document links (standard markdown + wiki-links). See outgoing/incoming links in the right panel, detect broken and stale links, filter the file tree to connected documents only
- **Document outline** — Right-side panel with Contents (heading outline) and Links (backlinks) views via segmented control. Active heading tracked via scroll position. Font scales with A+/A-

## Download

Pre-built binaries are automatically built on each release via GitHub Actions and are available on the [Releases](https://github.com/globalroo/markdown-viewer/releases) page:

- **macOS**: `.dmg` installer (signed and notarised, Apple Silicon and Intel)
- **Linux**: `.AppImage` portable binary and `.deb` package
- **Windows**: No pre-built binary — see [Build from Source](#build-from-source) below

## Build from Source

### Prerequisites

- [Node.js](https://nodejs.org/) 20 or later
- npm 9 or later
- Git

### Quick Start

```bash
git clone https://github.com/globalroo/markdown-viewer.git
cd markdown-viewer
npm install
npm run build
npx electron .
```

### Open a Specific Directory

```bash
npx electron . /path/to/your/repo
npx electron . .  # current directory
```

### Package for Distribution

```bash
# Build for your current platform
npm run dist

# Or target a specific platform
npx electron-builder --mac
npx electron-builder --win
npx electron-builder --linux
```

The packaged app will be in the `release/` directory.

### Install & Global CLI Access

After building or downloading a release, install the app and set up the `viewmd` command so you can open folders from any terminal.

**macOS** — install the app, then create a CLI wrapper:

```bash
# Install (from a local build)
cp -R release/mac/viewmd.app /Applications/

# Create the CLI command
sudo tee /usr/local/bin/viewmd > /dev/null << 'SCRIPT'
#!/bin/bash
# Resolve relative paths to absolute (open -a changes CWD to /)
args=()
for arg in "$@"; do
  if [ -e "$arg" ]; then
    args+=("$(cd "$(dirname "$arg")" && pwd)/$(basename "$arg")")
  else
    args+=("$arg")
  fi
done
exec /Applications/viewmd.app/Contents/MacOS/viewmd "${args[@]}" &>/dev/null &
disown
SCRIPT
sudo chmod +x /usr/local/bin/viewmd
```

**Windows** — run the `.exe` installer, then create `viewmd.cmd` somewhere in your PATH:

```cmd
@echo off
start "" "%LOCALAPPDATA%\Programs\viewmd\viewmd.exe" %*
```

**Linux** — if using the AppImage:

```bash
sudo ln -sf /path/to/viewmd-*.AppImage /usr/local/bin/viewmd
```

Or if using the `.deb` package, `viewmd` should already be in your PATH.

Then open any directory:

```bash
viewmd .                      # current directory
viewmd ~/projects/my-repo     # specific directory
viewmd README.md              # specific file
```

If viewmd is already running, a second `viewmd .` adds the folder to the existing sidebar rather than opening a new window.

## Keyboard Shortcuts

| Action | macOS | Windows |
|--------|-------|---------|
| Open folder | `Cmd+O` | `Ctrl+O` |
| Toggle sidebar | `Cmd+B` | `Ctrl+B` |
| Search files | `Cmd+F` | `Ctrl+F` |
| Toggle edit/preview | `Cmd+E` | `Ctrl+E` |
| Save (in edit mode) | `Cmd+S` | `Ctrl+S` |
| Rename file | `F2` | `F2` |
| Focus mode | `Cmd+Shift+F` | `Ctrl+Shift+F` |
| Exit focus mode | `Escape` | `Escape` |
| Increase font | `Cmd++` | `Ctrl++` |
| Decrease font | `Cmd+-` | `Ctrl+-` |
| Reset font | `Cmd+0` | `Ctrl+0` |
| Toggle theme | `Cmd+D` | `Ctrl+D` |
| Print | `Cmd+P` | `Ctrl+P` |

## Security

- **Navigation lockdown** — All in-app navigation is blocked. External links open in the default browser.
- **Path validation** — All file access is validated against explicitly opened project roots using `fs.realpathSync` to prevent symlink escapes and path traversal.
- **Mutation safety** — Rename, move, and write operations enforce markdown extensions, reject path separators and reserved names, and validate both source and destination paths.
- **Custom image protocol** — Local images are served through a custom `local-img://` Electron protocol that validates paths before serving, preventing access to files outside opened projects.
- **Content Security Policy** — Restricts script, style, image, and font sources. `file://` is not permitted for images.
- **DOMPurify** — All rendered markdown HTML is sanitized before injection.
- **Draft protection** — Failed saves preserve dirty state; drafts are never silently discarded.

## Development

```bash
# Run in development mode (hot reload)
npm run dev           # Start Vite dev server
npx electron .        # In another terminal, with NODE_ENV=development

# Type check
npx tsc -p tsconfig.json --noEmit       # renderer
npx tsc -p tsconfig.main.json --noEmit  # main process

# Full build
npm run build

# Run unit tests
npm test

# Run E2E tests (requires build first)
npm run build && npm run test:e2e
```

### Project Structure

```
src/
  main/
    main.ts          — Electron main process, file scanning, IPC, security
    preload.ts       — contextBridge API for renderer
  renderer/
    App.tsx          — Root component, keyboard shortcuts, theming
    store.ts         — Zustand state (projects, files, edit mode, UI)
    components/
      Sidebar.tsx    — Multi-project sidebar with search and drop targets
      FileTree.tsx   — Recursive file tree with rename, drag-drop
      ContextMenu.tsx — Reusable right-click context menu
      MarkdownPreview.tsx — Markdown rendering and edit mode
      Toolbar.tsx    — Font zoom, theme, print controls
    styles/
      app.css        — Theming, typography, scroll performance
tests/
  unit/              — Vitest unit tests (validation, store)
  e2e/               — Playwright Electron end-to-end tests
```

## Tech Stack

- **Electron 41** — Cross-platform desktop shell
- **React 19** — UI framework
- **TypeScript 6** — Type safety
- **Vite 8** — Build tooling
- **marked** — Fast markdown parsing
- **highlight.js** — Syntax highlighting (selective imports for bundle size)
- **Zustand** — Lightweight state management
- **DOMPurify** — HTML sanitization
- **electron-builder** — Packaging and distribution
- **Vitest** — Unit testing
- **Playwright** — Electron E2E testing

## License

MIT
