// Копирует статику из public/ в dist/ после expo export
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'public');
const DST = path.join(__dirname, '..', 'dist');

const FILES = ['sw.js', 'manifest.json', 'kodus-icon.png', 'offline.html', '404.html', 'favicon.ico'];

if (!fs.existsSync(DST)) {
  console.error('dist/ не найден. Сначала запустите npx expo export -p web');
  process.exit(1);
}

for (const f of FILES) {
  const src = path.join(SRC, f);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(DST, f));
    console.log(`  ✓ ${f}`);
  }
}
console.log('Готово.');