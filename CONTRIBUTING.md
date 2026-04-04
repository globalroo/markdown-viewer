# Contributing to viewmd

Thanks for your interest in contributing! This guide covers how to report bugs, suggest features, and submit code changes.

## Reporting Issues

Open an issue at [github.com/globalroo/markdown-viewer/issues](https://github.com/globalroo/markdown-viewer/issues).

### Bug Reports

Please include:

- **What happened** — describe the problem clearly
- **Steps to reproduce** — numbered steps to trigger the bug
- **Expected behaviour** — what you expected to happen instead
- **Environment** — OS, viewmd version (shown in the title bar or `package.json`), screen type (Retina/non-Retina)
- **Screenshots** — if it's a visual issue, a screenshot helps enormously

### Feature Requests

Please include:

- **What you'd like** — describe the feature
- **Why** — what problem does it solve? What's your use case?
- **Alternatives considered** — have you tried workarounds?

Well-described requests help us plan and prioritise effectively.

## Submitting Changes

### Setup

```bash
git clone https://github.com/globalroo/markdown-viewer.git
cd markdown-viewer
npm install
```

### Development

```bash
npm run dev           # Start Vite dev server
npx electron .        # In another terminal (NODE_ENV=development)
```

### Testing

```bash
npm test              # Run unit tests (Vitest)
npm run build && npm run test:e2e   # Run E2E tests (Playwright + Electron)
```

All tests must pass before submitting a PR. We currently have 140+ tests across unit and E2E.

### Pull Request Process

1. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes.** Follow existing code patterns:
   - TypeScript strict mode
   - Zustand for state management
   - CSS custom properties for theming
   - IPC handlers validate all paths via `isPathAllowed()`

3. **Write tests.** New features need:
   - **Unit tests** in `tests/unit/` for store logic, validation, pure functions
   - **E2E tests** in `tests/e2e/` for user-facing behaviour (Playwright + Electron)

4. **Run the full test suite:**
   ```bash
   npm test && npm run build && npm run test:e2e
   ```

5. **Build and verify locally:**
   ```bash
   npm run build
   npx electron .
   ```

6. **Submit your PR** against `main`:
   ```bash
   git push origin feature/your-feature-name
   ```
   Then open a PR on GitHub.

### PR Description

Please include:

- **Summary** — what does this PR do and why?
- **Changes** — bullet points of what changed
- **Test plan** — how can reviewers verify the changes? What tests were added?
- **Screenshots** — for UI changes, before/after screenshots

### What We Look For

- **Security** — all file operations go through IPC with path validation. New IPC handlers must call `isPathAllowed()`. Mutating handlers must validate file extensions.
- **Performance** — avoid paint-heavy CSS properties (no `backdrop-filter` in scroll containers). Use `contain`, `will-change`, and compositor-friendly transforms where appropriate. Test on Intel Mac if possible.
- **Accessibility** — ARIA labels, keyboard navigation, WCAG AA contrast ratios on all themes.
- **Bundle size** — prefer lightweight solutions. The app currently uses no heavy editor libraries (CodeMirror, Monaco) by design.

## Code Style

- No linter configured yet — follow existing patterns
- Prefer `const` over `let`
- Use `useCallback` and `useMemo` for React performance
- CSS custom properties (`var(--name)`) for all theme-dependent values
- `em`/`rem` for scalable sizes, `px` for fixed UI elements

## Architecture

```
src/
  main/         — Electron main process (IPC, security, file ops)
  renderer/     — React app (components, store, styles)
tests/
  unit/         — Vitest unit tests
  e2e/          — Playwright Electron E2E tests
```

Key patterns:
- **Store** (`store.ts`) — Zustand, single source of truth
- **IPC boundary** — all file access validated in main process
- **Theming** — CSS custom properties in `themes.css`, applied via `data-theme` attribute
- **Print** — `@media print` strips colours, honours typography settings

## Review Process

Significant changes go through multi-agent AI review (up to 3 rounds) before merging. This is handled by the maintainers.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
