# Sunshine City: Harare Hustle

Open-world browser / mobile game set on the real street map of central Harare, starring Ngwere.

## Play
Open `dist/index.html` in Chrome, Edge, Firefox or Safari. It is one self-contained file.

## Build from source
Requires Node.js 18+.

    npm install
    npm run build        # bundles src/ into dist/index.html + icons

## Street talk (ma hwindi)
Ambient + kombi jobs shout lines Zimbabweans know: *Town here*, *Zviriko*, *Bho here*, *Madiii*, *Safe here*, *Usandifendera shaa!!*, *Vabereki hunzai mari dzekombi*, *NOP*, *Chitungwiza*, *Mabvuku-Tafara*. See `src/phrases.js`. Voices use Web Speech API + bark SFX.

## Mobile release
Workflow: `.github/workflows/mobile-packages.yml`  
Guide: [`docs/MOBILE_RELEASE.md`](docs/MOBILE_RELEASE.md)

- **iOS** — unsigned **device** IPA (`iphoneos`) for [Sideloadly](https://sideloadly.io) — you sign on install  
- **Android** — debug APK always; signed release if keystore secrets are set  
- **Web** — installable zip  

Local:

    npm run cap:android
    npm run cap:ios       # macOS: build unsigned IPA script in docs/MOBILE_RELEASE.md

## Layout
- `src/game.js`      game loop, Ngwere, pedestrians, missions, jobs, police, HUD, map
- `src/world.js`     builds the city from the map data: roads, buildings, robots, cameras, props
- `src/vehicles.js`  vehicle physics and traffic AI
- `src/models.js`    vehicle models
- `src/audio.js`     SFX, radio, hwindi speech
- `src/phrases.js`   Zimbabwe slang / hwindi comedy pack
- `src/util.js`      geometry helpers
- `src/citydata.js`  converted Harare map data (generated, do not edit)
- `src/index.html`   page shell, HUD and menus
- `tools/prep.mjs`   converts a raw OpenStreetMap extract into `src/citydata.js`
- `capacitor.config.json`  Android / iOS wrap

## Map data
Streets and building footprints: © OpenStreetMap contributors, Open Database License (ODbL).
The extract used came from https://github.com/simandebvu/harare (data only, no code).
