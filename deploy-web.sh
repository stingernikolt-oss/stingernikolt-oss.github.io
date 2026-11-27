#!/usr/bin/env bash
# Сборка и публикация KODUS на GitHub Pages (stingernikolt-oss.github.io)
set -euo pipefail

echo "==> Очищаем предыдущую сборку"
rm -rf dist

echo "==> Экспортируем веб-версию"
npx expo export -p web

echo "==> Копируем статику в dist"
cp public/sw.js dist/sw.js
cp public/manifest.json dist/manifest.json
cp public/kodus-icon.png dist/kodus-icon.png
cp public/offline.html dist/offline.html
cp public/404.html dist/404.html
cp public/favicon.ico dist/favicon.ico 2>/dev/null || true

echo "==> Готово. Папка dist/ готова к публикации."
echo ""
echo "==> Публикация на GitHub Pages:"
echo "    npx gh-pages -d dist -b gh-pages -r https://github.com/stingernikolt-oss/stingernikolt-oss.github.io.git"