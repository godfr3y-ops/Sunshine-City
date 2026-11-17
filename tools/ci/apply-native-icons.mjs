#!/usr/bin/env node
/** Stamp Sunshine City icons into Capacitor android/ios after `cap add`. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const res = path.join(root, 'resources');

function copy(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function applyAndroid() {
  const base = path.join(root, 'android', 'app', 'src', 'main', 'res');
  if (!fs.existsSync(base)) return false;
  const map = {
    'mipmap-mdpi': 'icon-48.png',
    'mipmap-hdpi': 'icon-72.png',
    'mipmap-xhdpi': 'icon-96.png',
    'mipmap-xxhdpi': 'icon-144.png',
    'mipmap-xxxhdpi': 'icon-192.png',
  };
  for (const [folder, file] of Object.entries(map)) {
    const src = path.join(res, file);
    if (!fs.existsSync(src)) throw new Error('missing ' + src);
    for (const name of ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png']) {
      copy(src, path.join(base, folder, name));
    }
  }
  console.log('Android launcher icons applied');
  return true;
}

function applyIos() {
  const setDir = path.join(root, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset');
  if (!fs.existsSync(path.join(root, 'ios', 'App', 'App', 'Assets.xcassets'))) return false;
  fs.mkdirSync(setDir, { recursive: true });
  const entries = [
    { idiom: 'universal', platform: 'ios', size: '1024x1024', filename: 'AppIcon-1024.png', src: 'icon.png' },
    { idiom: 'iphone', size: '20x20', scale: '2x', filename: 'fiona.g@example.net', src: 'icon-40.png' },
    { idiom: 'iphone', size: '20x20', scale: '3x', filename: 'beth.t@example.com', src: 'icon-60.png' },
    { idiom: 'iphone', size: '29x29', scale: '2x', filename: 'aaron.s@example.org', src: 'icon-58.png' },
    { idiom: 'iphone', size: '29x29', scale: '3x', filename: 'nina.v@example.com', src: 'icon-87.png' },
    { idiom: 'iphone', size: '40x40', scale: '2x', filename: 'paula.r@example.org', src: 'icon-80.png' },
    { idiom: 'iphone', size: '40x40', scale: '3x', filename: 'tina.r@example.net', src: 'icon-120.png' },
    { idiom: 'iphone', size: '60x60', scale: '2x', filename: 'carlos.r@example.net', src: 'icon-120.png' },
    { idiom: 'iphone', size: '60x60', scale: '3x', filename: 'frank.g@example.org', src: 'icon-180.png' },
    { idiom: 'ios-marketing', size: '1024x1024', scale: '1x', filename: 'AppIcon-1024.png', src: 'icon.png' },
  ];
  const images = [];
  for (const e of entries) {
    copy(path.join(res, e.src), path.join(setDir, e.filename));
    const img = { idiom: e.idiom, size: e.size, filename: e.filename };
    if (e.scale) img.scale = e.scale;
    if (e.platform) img.platform = e.platform;
    images.push(img);
  }
  fs.writeFileSync(path.join(setDir, 'Contents.json'), JSON.stringify({ images, info: { version: 1, author: 'xcode' } }, null, 2));
  console.log('iOS AppIcon applied');
  return true;
}

const a = applyAndroid();
const i = applyIos();
if (!a && !i) console.log('No android/ or ios/ yet — icons ready in resources/ for CI after cap add');
