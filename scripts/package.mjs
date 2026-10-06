// Makes the ZIPs to upload to the stores, in ../dist:
//   yt-longs-chrome.zip   Chrome Web Store, and the Chrome download on GitHub releases
//   yt-longs-firefox.zip  Firefox Add-ons (rebuilds firefox/ first)
// The names stay the same across versions so the README's download links always point at the latest release.
// Run: node scripts/package.mjs
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';

const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const dist = path.join(root, 'dist');
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist);

execFileSync('node', [path.join(root, 'scripts', 'build-firefox.mjs')], { stdio: 'inherit' });

const zip = (cwd, name) => {
  execFileSync('zip', ['-qr', '-X', path.join(dist, name), 'manifest.json', 'rules.json', 'LICENSE', 'src', 'icons', '-x', '*.DS_Store'], { cwd });
  console.log(`dist/${name}`);
};
zip(root, 'yt-longs-chrome.zip');
zip(path.join(root, 'firefox'), 'yt-longs-firefox.zip');
