# Markdown Viewer

A fast, cross-platform desktop app for discovering and reading markdown files in repositories and project directories.

Open any folder, instantly see every markdown file in a searchable tree, and read them with clean typography, syntax-highlighted code blocks, and light/dark theming.

## Features

- **Multi-project sidebar** — Add multiple folders, each shown as a collapsible section with its own file tree
- **Search & filter** — Instantly narrow files by name across all projects
- **Rich rendering** — CommonMark + GFM tables, task lists, syntax-highlighted code blocks (16 languages)
- **Relative images** — Local images resolve correctly relative to the markdown file
- **Themes** — System-aware light/dark mode with manual toggle
- **Font zoom** — Adjust reading size with keyboard shortcuts
- **Print** — Print the rendered markdown, not the raw source
- **File associations** — Register as the default handler for `.md` files
- **CLI launch** — Open from the terminal with `markdown-viewer .`
- **Cross-platform** — macOS and Windows

## Download

Pre-built binaries are available on the [Releases](https://github.com/globalroo/markdown-viewer/releases) page:

- **macOS**: `.dmg` (Intel and Apple Silicon)
- **Windows**: `.exe` installer

## Build from Source

### Prerequisites

- [Node.js](https://nodejs.org/) 20 or later
- npm 9 or later

### Install and Run

```bash
git clone https://github.com/globalroo/markdown-viewer.git
cd markdown-viewer
npm install
npm run build
npx electron .
```

### Open a specific directory

```bash
npx electron . /path/to/your/repo
npx electron . .  # current directory
```

### Package for distribution

```bash
# macOS .dmg + .zip
npm run dist

# Or platform-specific
npx electron-builder --mac
npx electron-builder --win
```

The packaged app will be in the `release/` directory.

### Global CLI access (optional)

After packaging and installing the `.dmg` or `.exe`, you can create a shell alias:

```bash
# macOS — add to ~/.zshrc or ~/.bashrc
alias markdown-viewer='/Applications/Markdown\ Viewer.app/Contents/MacOS/Markdown\ Viewer'
```

Then open any directory:

```bash
markdown-viewer .
markdown-viewer ~/projects/my-repo
```

## Keyboard Shortcuts

| Action | macOS | Windows |
|--------|-------|---------|
| Open folder | `Cmd+O` | `Ctrl+O` |
| Toggle sidebar | `Cmd+B` | `Ctrl+B` |
| Search files | `Cmd+F` | `Ctrl+F` |
| Increase font | `Cmd++` | `Ctrl++` |
| Decrease font | `Cmd+-` | `Ctrl+-` |
| Reset font | `Cmd+0` | `Ctrl+0` |
| Toggle theme | `Cmd+D` | `Ctrl+D` |
| Print | `Cmd+P` | `Ctrl+P` |

## Development

```bash
# Run in development mode (hot reload)
npm run dev           # Start Vite dev server
npx electron .        # In another terminal, with NODE_ENV=development

# Type check
npx tsc -p tsconfig.json --noEmit       # renderer
npx tsc -p tsconfig.main.json --noEmit  # main process

# Build
npm run build
```

## Tech Stack

- **Electron 41** — Cross-platform desktop shell
- **React 19** — UI framework
- **TypeScript 6** — Type safety
- **Vite 8** — Build tooling
- **marked** — Fast markdown parsing
- **highlight.js** — Syntax highlighting
- **Zustand** — State management
- **DOMPurify** — HTML sanitization
- **electron-builder** — Packaging and distribution

## License

MIT
