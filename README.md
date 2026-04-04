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
- **Themes** — System-aware light/dark mode with manual toggle
- **Font zoom** — Adjust reading size with keyboard shortcuts (10px–32px range)
- **Print** — Print the rendered markdown, not the raw source
- **File associations** — Register as the default handler for `.md` and `.markdown` files
- **CLI launch** — Open from the terminal pointing at any directory
- **Cross-platform** — macOS, Windows, and Linux
- **Accessible** — ARIA labels, semantic landmarks, keyboard-navigable

## Download

Pre-built binaries are automatically built on each release via GitHub Actions and are available on the [Releases](https://github.com/globalroo/markdown-viewer/releases) page:

- **macOS**: `.dmg` installer
- **Windows**: `.exe` installer (NSIS)
- **Linux**: `.AppImage` portable binary and `.deb` package

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

### Global CLI Access

After packaging and installing, create a shell alias so you can launch from anywhere:

**macOS** — add to `~/.zshrc` or `~/.bashrc`:

```bash
alias viewmd='/Applications/viewmd.app/Contents/MacOS/viewmd'
```

**Windows** — add the install directory to your PATH, or create a batch file.

**Linux** — if using the AppImage, add to `~/.bashrc`:

```bash
alias viewmd='/path/to/viewmd-1.3.0.AppImage'
```

Then open any directory:

```bash
viewmd .
viewmd ~/projects/my-repo
```

## Keyboard Shortcuts

| Action | macOS | Windows |
|--------|-------|---------|
| Open folder | `Cmd+O` | `Ctrl+O` |
| Toggle sidebar | `Cmd+B` | `Ctrl+B` |
| Search files | `Cmd+F` | `Ctrl+F` |
| Toggle edit/preview | `Cmd+E` | `Ctrl+E` |
| Save (in edit mode) | `Cmd+S` | `Ctrl+S` |
| Rename file | `F2` | `F2` |
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
