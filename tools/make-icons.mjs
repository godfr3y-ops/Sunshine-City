/** Copy branded PNG icons into dist/ and fix PWA manifest. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const res = path.join(root, 'resources');
const dist = path.join(root, 'dist');
fs.mkdirSync(dist, { recursive: true });

function pick(...names) {
  for (const n of names) {
    const p = path.join(res, n);
    if (fs.existsSync(p)) return p;
  }
  throw new Error('missing icons in resources/: ' + names.join(', '));
}

const copies = [
  [pick('icon-192.png'), 'icon-192.png'],
  [pick('icon-512.png'), 'icon-512.png'],
  [pick('icon-1024.png', 'icon-512.png', 'icon.png'), 'icon-1024.png'],
  [pick('icon-180.png', 'icon-192.png'), 'apple-touch-icon.png'],
];

for (const [src, to] of copies) {
  fs.copyFileSync(src, path.join(dist, to));
}

const manifest = {
  name: 'Sunshine City: Harare Hustle',
  short_name: 'Sunshine City',
  description: 'Open-world Harare hustle starring Ngwere — kombis, ma hwindi, and CBD chaos.',
  start_url: './index.html',
  display: 'standalone',
  orientation: 'landscape',
  background_color: '#101418',
  theme_color: '#ffd23f',
  lang: 'en-ZW',
  icons: [
    { src: './icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: './icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: './icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
    { src: './icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};
fs.writeFileSync(path.join(dist, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2));
console.log('PWA icons + manifest written to dist/');
