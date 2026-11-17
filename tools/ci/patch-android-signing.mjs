#!/usr/bin/env node
/** Inject release signing into Capacitor android/app/build.gradle after `cap add android`. */
import fs from 'fs';
import path from 'path';

const gradlePath = path.join('android', 'app', 'build.gradle');
if (!fs.existsSync(gradlePath)) {
  console.error('android/app/build.gradle not found — run cap add android first');
  process.exit(1);
}

let gradle = fs.readFileSync(gradlePath, 'utf8');
if (gradle.includes('sunshineRelease')) {
  console.log('signing already patched');
  process.exit(0);
}

const signingBlock = `
    signingConfigs {
        sunshineRelease {
            storeFile file(System.getenv("SUNSHINE_KEYSTORE_PATH") ?: "sunshine-upload.jks")
            storePassword System.getenv("SUNSHINE_KEYSTORE_PASSWORD")
            keyAlias System.getenv("SUNSHINE_KEY_ALIAS")
            keyPassword System.getenv("SUNSHINE_KEY_PASSWORD")
        }
    }
`;

if (!gradle.includes('signingConfigs')) {
  gradle = gradle.replace(/android\s*\{/, (m) => `${m}\n${signingBlock}`);
}

if (/buildTypes\s*\{[\s\S]*?release\s*\{/.test(gradle) && !gradle.includes('signingConfig signingConfigs.sunshineRelease')) {
  gradle = gradle.replace(/(release\s*\{)/, `$1\n            signingConfig signingConfigs.sunshineRelease`);
}

fs.writeFileSync(gradlePath, gradle);
console.log('patched android release signing');
