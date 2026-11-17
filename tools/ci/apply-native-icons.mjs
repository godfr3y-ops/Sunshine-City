#!/usr/bin/env node
/**
 * After `npx cap add android|ios`, stamp Sunshine City icons into native projects
 * so APK / IPA show the branded home-screen icon (Sideloadly + Android).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const res = path.join(root, 'resources');

function copy(src, dest) {
  if (!fs.existsSync(src)) throw new Error('missing ' + src);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function pick(...names) {
  for (const n of names) {
    const p = path.join(res, n);
    if (fs.existsSync(p)) return p;
  }
  throw new Error('no icon candidate among ' + names.join(','));
}

function applyAndroid() {
  const base = path.join(root, 'android', 'app', 'src', 'main', 'res');
  if (!fs.existsSync(base)) return false;
  const map = {
    'mipmap-mdpi': pick('icon-48.png', 'icon-40.png'),
    'mipmap-hdpi': pick('icon-72.png', 'icon-76.png'),
    'mipmap-xhdpi': pick('icon-96.png', 'icon-87.png'),
    'mipmap-xxhdpi': pick('icon-144.png', 'icon-152.png'),
    'mipmap-xxxhdpi': pick('icon-192.png'),
  };
  for (const [folder, src] of Object.entries(map)) {
    for (const name of ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png']) {
      copy(src, path.join(base, folder, name));
    }
  }
  console.log('Android mipmap icons applied');
  return true;
}

function applyIos() {
  const setDir = path.join(root, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset');
  if (!fs.existsSync(path.dirname(setDir))) return false;
  fs.mkdirSync(setDir, { recursive: true });

  const master = pick('icon-1024.png', 'icon-512.png', 'icon.png');
  const entries = [
    { idiom: 'universal', platform: 'ios', size: '1024x1024', filename: 'AppIcon-1024.png', src: master },
    { idiom: 'iphone', size: '20x20', scale: '2x', filename: 'fiona.g@example.net', src: pick('icon-40.png') },
    { idiom: 'iphone', size: '20x20', scale: '3x', filename: 'beth.t@example.com', src: pick('icon-60.png') },
    { idiom: 'iphone', size: '29x29', scale: '2x', filename: 'aaron.s@example.org', src: pick('icon-58.png') },
    { idiom: 'iphone', size: '29x29', scale: '3x', filename: 'nina.v@example.com', src: pick('icon-87.png') },
    { idiom: 'iphone', size: '40x40', scale: '2x', filename: 'paula.r@example.org', src: pick('icon-80.png') },
    { idiom: 'iphone', size: '40x40', scale: '3x', filename: 'tina.r@example.net', src: pick('icon-120.png') },
    { idiom: 'iphone', size: '60x60', scale: '2x', filename: 'carlos.r@example.net', src: pick('icon-120.png') },
    { idiom: 'iphone', size: '60x60', scale: '3x', filename: 'frank.g@example.org', src: pick('icon-180.png') },
    { idiom: 'ios-marketing', size: '1024x1024', scale: '1x', filename: 'AppIcon-1024.png', src: master },
  ];

  const images = [];
  for (const e of entries) {
    copy(e.src, path.join(setDir, e.filename));
    const img = { idiom: e.idiom, size: e.size, filename: e.filename };
    if (e.scale) img.scale = e.scale;
    if (e.platform) img.platform = e.platform;
    images.push(img);
  }
  fs.writeFileSync(path.join(setDir, 'Contents.json'), JSON.stringify({ images, info: { version: 1, author: 'xcode' } }, null, 2));
  console.log('iOS AppIcon.appiconset applied');
  return true;
}

const a = applyAndroid();
const i = applyIos();
if (!a && !i) {
  console.log('No android/ or ios/ yet — icons ready in resources/ for CI after cap add');
} else {
  console.log('Native icons done', { android: a, ios: i });
}
