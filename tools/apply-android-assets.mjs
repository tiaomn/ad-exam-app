import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'assets', 'android');
const res = path.join(root, 'android', 'app', 'src', 'main', 'res');

if (!fs.existsSync(res)) {
  console.error('android/app/src/main/res not found. Run "npx cap add android" first.');
  process.exit(1);
}

for (const entry of fs.readdirSync(source)) {
  const src = path.join(source, entry);
  const dest = path.join(res, entry);
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(src, dest, { recursive: true, force: true });
}

const anydpi = path.join(res, 'mipmap-anydpi-v26');
fs.mkdirSync(anydpi, { recursive: true });
const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`;
fs.writeFileSync(path.join(anydpi, 'ic_launcher.xml'), adaptive, 'utf8');
fs.writeFileSync(path.join(anydpi, 'ic_launcher_round.xml'), adaptive, 'utf8');

const values = path.join(res, 'values');
fs.mkdirSync(values, { recursive: true });
fs.writeFileSync(path.join(values, 'ic_launcher_background.xml'), `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#F6C62B</color>
</resources>
`, 'utf8');

const splash = path.join(root, 'assets', 'splash.png');
const drawable = path.join(res, 'drawable');
fs.mkdirSync(drawable, { recursive: true });
fs.copyFileSync(splash, path.join(drawable, 'splash.png'));

console.log('Android icons and splash applied.');
