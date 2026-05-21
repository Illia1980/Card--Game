#!/bin/bash
cd "$(dirname "$0")"
echo "Starting Durak Arcade Online..."
if [ ! -d node_modules ]; then
  npm install
fi
open http://localhost:3000 2>/dev/null || xdg-open http://localhost:3000 2>/dev/null
npm start
