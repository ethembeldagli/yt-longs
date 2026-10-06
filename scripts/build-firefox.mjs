// Builds the Firefox version of the extension into ../firefox from the main (Chrome/Edge) source.
// Edit the files in src/ and the root manifest.json, then run:  node scripts/build-firefox.mjs
//
// Differences from the Chrome/Edge build:
// - background runs as an event page ("scripts") instead of a service worker
// - an add-on ID, the minimum Firefox version, and "collects no data" for Mozilla's add-on store
// - extension APIs use Firefox's promise-based `browser.*` namespace
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.join(root, 'firefox');

const manifest = JSON.parse(readFileSync(path.join(root, 'manifest.json'), 'utf8'));
delete manifest.minimum_chrome_version;
manifest.background = { scripts: [manifest.background.service_worker] };
manifest.browser_specific_settings = {
  gecko: {
    id: 'yt-longs@ethembeldagli.dev',
    // 128: content scripts in the page's own world; 140: the built-in data-collection consent
    strict_min_version: '140.0',
    data_collection_permissions: { required: ['none'] },
  },
  gecko_android: { strict_min_version: '142.0' },
};

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const item of ['src', 'icons', 'rules.json', 'LICENSE']) cpSync(path.join(root, item), path.join(out, item), { recursive: true });

for (const file of ['src/background.js', 'src/content.js']) {
  const p = path.join(out, file);
  writeFileSync(p, readFileSync(p, 'utf8').replace(/\bchrome\.(runtime|storage|tabs|action|scripting)\b/g, 'browser.$1'));
}
writeFileSync(path.join(out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Firefox build written to ${path.relative(process.cwd(), out) || out}`);
