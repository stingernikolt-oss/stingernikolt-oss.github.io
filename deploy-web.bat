@echo off
echo ==> Очищаем предыдущую сборку
if exist dist rmdir /s /q dist

echo ==> Экспортируем веб-версию
call npx expo export -p web

echo ==> Копируем статику в dist
copy public\sw.js dist\sw.js
copy public\manifest.json dist\manifest.json
copy public\kodus-icon.png dist\kodus-icon.png
copy public\offline.html dist\offline.html
copy public\404.html dist\404.html
if exist public\favicon.ico copy public\favicon.ico dist\favicon.ico

echo.
echo ==> Готово. Папка dist/ готова к публикации.
echo ==> Публикация на GitHub Pages:
echo    call npx gh-pages -d dist -b gh-pages -r https://github.com/stingernikolt-oss/stingernikolt-oss.github.io.git
pause