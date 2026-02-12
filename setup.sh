#!/usr/bin/env bash
set -e

# Check if Node.js exists
if ! command -v node &> /dev/null; then
    echo ""
    echo "============================================"
    echo "  Node.js nie je nainstalovany!"
    echo "============================================"
    echo ""
    echo "  Nainstaluj verziu 18+:"
    echo "    macOS:  brew install node"
    echo "    Ubuntu: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs"
    echo "    Alebo stiahni z: https://nodejs.org"
    echo ""
    exit 1
fi

# Run the interactive setup wizard
node "$(dirname "$0")/setup.js"
