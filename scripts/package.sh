#!/usr/bin/env bash
# 打包上傳到 Chrome 線上應用程式商店用的 zip：只放擴充功能執行時需要的檔案
set -euo pipefail
cd "$(dirname "$0")/.."
version=$(node -p "require('./manifest.json').version")
mkdir -p dist
out="dist/translate-master-${version}.zip"
rm -f "$out"
zip -q -X -r "$out" manifest.json background.js content.js popup.html popup.js welcome.html welcome.js icons _locales LICENSE
echo "$out"
