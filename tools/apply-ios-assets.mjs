import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'assets', 'ios');
const assets = path.join(root, 'ios', 'App', 'App', 'Assets.xcassets');

if (!fs.existsSync(assets)) {
  console.error('ios/App/App/Assets.xcassets not found. Run "npx cap add ios" first.');
  process.exit(1);
}

for (const entry of ['AppIcon.appiconset', 'Splash.imageset']) {
  const dest = path.join(assets, entry);
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(path.join(source, entry), dest, { recursive: true, force: true });
}
console.log('iOS icons and splash applied.');
