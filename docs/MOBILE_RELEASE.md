# Mobile release

## App icon

Branded icon lives in `resources/` (`icon-192.png`, `icon-512.png`, …).  
`npm run build` copies them into `dist/` (PWA + web zip).  
CI runs `tools/ci/apply-native-icons.mjs` after Capacitor add so **Android APK** and **iOS IPA** home-screen icons are set before packaging.

## App icon

Branded icon lives in `resources/icon.png` (+ size variants).  
`npm run build` copies PWA icons into `dist/`.  
CI runs `node tools/ci/apply-native-icons.mjs` after `cap add` so **APK / Sideloadly IPA** show the Sunshine City home-screen icon.

## iOS — unsigned IPA + Sideloadly (your setup)

CI builds a **real-device** IPA (`iphoneos` / arm64), left **unsigned**.  
You re-sign and install with [Sideloadly](https://sideloadly.io) on your PC → iPhone.

This is **not** a simulator build. Simulator apps will not run on a physical iPhone even with Sideloadly.

### Install steps

1. Run GitHub Action **Mobile release packages** (or push to `main`/`master`).
2. Download artifact **`ios-sideloadly-ipa`**.
3. Open Sideloadly → connect iPhone → select the `.ipa`.
4. Sign in with your Apple ID → Start.
5. On iPhone: **Settings → General → VPN & Device Management** → trust your Apple ID, then launch **Sunshine City**.

Free Apple ID sideloads usually expire after ~7 days; re-install with Sideloadly when needed.  
Paid Developer account + Sideloadly can last longer depending on your signing setup.

No Apple distribution certificate secrets are required for this path.

### Local unsigned IPA (macOS + Xcode)

```bash
npm ci && npm run build
npm run cap:ios
cd ios/App && pod install
xcodebuild -workspace App.xcworkspace -scheme App -configuration Release \
  -sdk iphoneos -destination "generic/platform=iOS" \
  -derivedDataPath build \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY="" build
# then:
../../tools/ci/package-unsigned-ipa.sh \
  "$(find build/Build/Products -type d -name '*.app' | head -1)" \
  ../../sunshine-city-unsigned.ipa
```

## Android

Artifact **`android-unsigned-apk`** — debug APK (install via USB / Files). No keystore secrets required.

## Web

Artifact **`web-install-zip`** — open `index.html` or host as a PWA (includes app icons).
