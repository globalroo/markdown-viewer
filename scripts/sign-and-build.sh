#!/bin/bash
set -e

echo "=== viewmd Signed Build ==="
echo ""

# Check for Apple ID
if [ -z "$APPLE_ID" ]; then
    read -p "Apple ID (email): " APPLE_ID
    export APPLE_ID
fi

# Check for app-specific password
if [ -z "$APPLE_APP_SPECIFIC_PASSWORD" ]; then
    read -sp "App-specific password: " APPLE_APP_SPECIFIC_PASSWORD
    echo ""
    export APPLE_APP_SPECIFIC_PASSWORD
fi

export APPLE_TEAM_ID="GSKV3U57L9"

echo ""
echo "Apple ID:  $APPLE_ID"
echo "Team ID:   $APPLE_TEAM_ID"
echo "Password:  ****"
echo ""

# Verify signing identity exists
echo "Checking signing identity..."
if ! security find-identity -v -p codesigning | grep -q "Developer ID Application: Tammy Davies"; then
    echo "ERROR: Developer ID Application certificate not found in Keychain."
    exit 1
fi
echo "OK: Developer ID Application certificate found."
echo ""

# Build and sign
echo "Building and signing..."
cd "$(dirname "$0")/.."
npm run dist

echo ""
echo "=== Done ==="
echo "Output is in the release/ directory."
