#!/usr/bin/env bash
set -euo pipefail

# viewmd installer — installs the app and creates a CLI command
# Usage:
#   ./scripts/install.sh              # install from local build (release/ directory)
#   ./scripts/install.sh --build      # build first, then install
#
# Supports macOS, Linux (AppImage / deb), and provides instructions for Windows.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
RELEASE_DIR="$PROJECT_DIR/release"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Colour

info()  { echo -e "${GREEN}[viewmd]${NC} $*"; }
warn()  { echo -e "${YELLOW}[viewmd]${NC} $*"; }
error() { echo -e "${RED}[viewmd]${NC} $*" >&2; }

# ------------------------------------------------------------------
# macOS
# ------------------------------------------------------------------
install_macos() {
  local APP_SRC="$RELEASE_DIR/mac/viewmd.app"
  local APP_DEST="/Applications/viewmd.app"
  local CLI_DEST="/usr/local/bin/viewmd"

  if [[ ! -d "$APP_SRC" ]]; then
    error "No macOS build found at $APP_SRC"
    error "Run: npm run build && npx electron-builder --mac --dir"
    error "Or:  ./scripts/install.sh --build"
    exit 1
  fi

  # Install .app bundle (may need sudo if /Applications is not user-writable)
  info "Installing viewmd.app to /Applications..."
  if [[ -w /Applications ]] || [[ -w "$APP_DEST" ]]; then
    rm -rf "$APP_DEST"
    cp -R "$APP_SRC" "$APP_DEST"
  else
    sudo rm -rf "$APP_DEST"
    sudo cp -R "$APP_SRC" "$APP_DEST"
  fi
  info "App installed."

  # Create CLI wrapper
  info "Creating CLI command at $CLI_DEST..."
  sudo tee "$CLI_DEST" > /dev/null << 'WRAPPER'
#!/bin/bash
# viewmd CLI wrapper — resolves relative paths before launching the Electron app
args=()
for arg in "$@"; do
  if [ -e "$arg" ]; then
    args+=("$(cd "$(dirname "$arg")" && pwd)/$(basename "$arg")")
  else
    args+=("$arg")
  fi
done
/Applications/viewmd.app/Contents/MacOS/viewmd "${args[@]}" &>/dev/null &
disown
WRAPPER
  sudo chmod +x "$CLI_DEST"
  info "CLI command installed."

  echo ""
  info "Done! Try it:"
  info "  viewmd .                      # open current directory"
  info "  viewmd ~/projects/my-repo     # open specific directory"
  info "  viewmd README.md              # open specific file"
}

# ------------------------------------------------------------------
# Linux
# ------------------------------------------------------------------
install_linux() {
  local CLI_DEST="/usr/local/bin/viewmd"

  # Check for .deb first (only on Debian-based distros where dpkg is available)
  local DEB
  DEB=$(find "$RELEASE_DIR" -maxdepth 1 -name '*.deb' -print -quit 2>/dev/null || true)
  if [[ -n "$DEB" ]] && command -v dpkg >/dev/null 2>&1; then
    info "Installing deb package: $DEB"
    sudo dpkg -i "$DEB"
    info "viewmd installed via deb. CLI should already be in PATH."
    return
  fi

  # Fall back to AppImage
  local APPIMAGE
  APPIMAGE=$(find "$RELEASE_DIR" -maxdepth 1 -name '*.AppImage' -print -quit 2>/dev/null || true)
  if [[ -n "$APPIMAGE" ]]; then
    chmod +x "$APPIMAGE"
    info "Linking AppImage to $CLI_DEST..."
    sudo ln -sf "$(realpath "$APPIMAGE")" "$CLI_DEST"
    info "CLI command installed."
    echo ""
    info "Done! Try: viewmd ."
    return
  fi

  error "No Linux build found in $RELEASE_DIR"
  error "Run: npm run build && npx electron-builder --linux --dir"
  error "Or:  ./scripts/install.sh --build"
  exit 1
}

# ------------------------------------------------------------------
# Windows (guidance only — this script runs under Git Bash / MSYS)
# ------------------------------------------------------------------
install_windows_hint() {
  local EXE
  EXE=$(find "$RELEASE_DIR" -maxdepth 1 -name '*.exe' -print -quit 2>/dev/null || true)

  info "Windows detected."
  echo ""
  if [[ -n "$EXE" ]]; then
    info "Installer found: $EXE"
    info "Run the installer, then create a CLI wrapper."
  else
    warn "No Windows installer found in $RELEASE_DIR"
    warn "Run: npm run build && npx electron-builder --win"
  fi
  echo ""
  info "After installing, create viewmd.cmd in a directory on your PATH:"
  info ""
  info '  @echo off'
  info '  start "" "%LOCALAPPDATA%\\Programs\\viewmd\\viewmd.exe" %*'
  info ""
  info "Then: viewmd ."
}

# ------------------------------------------------------------------
# Main
# ------------------------------------------------------------------

# Build if requested
if [[ "${1:-}" == "--build" ]]; then
  info "Building viewmd..."
  cd "$PROJECT_DIR"
  npm run build
  CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --dir 2>&1
  info "Build complete."
fi

# Platform detection
OS="$(uname -s)"

case "$OS" in
  Darwin)
    install_macos
    ;;
  Linux)
    install_linux
    ;;
  MINGW*|MSYS*|CYGWIN*)
    install_windows_hint
    ;;
  *)
    error "Unsupported platform: $OS"
    exit 1
    ;;
esac
