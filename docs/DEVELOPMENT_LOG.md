# Sunshine City — development log & roadmap

**Honest status:** this product is a **Three.js + Capacitor** open-world prototype on the real Harare OSM street map.  
AI concept renders (Ngwere cinematic stills, Joina/RBZ skyline) are **art direction**, not in-engine assets. They do not appear in the Sideloadly IPA until modelled/textured and loaded by the engine.

## Engine & architecture (audited)

| Layer | Tech | Notes |
|-------|------|--------|
| Runtime | Three.js r187, single `dist/index.html` bundle | Mobile via Capacitor |
| World | OSM footprints → procedural buildings (`world.js`) | CBD map; not full Harare suburbs yet |
| Player | Procedural Ngwere mesh + walk cycle (`game.js`) | Not a scanned/Unreal skeletal mesh |
| Vehicles | Low/mid poly procedural (`models.js`, `vehicles.js`) | Kombi/taxi/police exist; no Mark X cockpit yet |
| Audio | WebAudio synth + radio + optional TTS (`audio.js`) | iOS: TTS disabled (unsync); bark + toast |
| UI | DOM HUD + touch stick | Being polished for safe-area / mobile |

## What works today (playable)

- Drive/walk on real central Harare roads (left-hand traffic)
- Story missions, kombi/taxi jobs, vending, ZRP wanted, robots/cameras
- Hwindi phrase toasts + radio stations
- Unsigned Android APK + Sideloadly iOS IPA (CI)

## Fixes shipped (playable, not mockups)

1. **iOS movement** — dual pointer/touch stick; camera-relative on-foot move; RUN button  
2. **Audio** — `audioUnlock()` on every gesture; iOS TTS removed to stop desync  
3. **Ngwere** — StandardMaterial + denser mesh + stronger walk cycle (still stylized, not AAA scan)  
4. **Mobile HUD** — safer insets, tighter controls  
5. **Interiors** — Flat near Copacabana + corner shop near First Street: [E] enter/exit, walk rooms, shop buy  
6. **Cockpit cam** — [V] / CAM toggles first-person dashboard view in any vehicle  
7. **Facades** — varied shop signs, weathering, AC hints (procedural atlases)  
8. **Peds** — role colours (Warriors / office / casual) + hats on some NPCs  

## What the AAA brief requires next (phased)

Do **not** claim these done until acceptance tests pass in-game.

### Phase A — Immersion foundation ✅ (v1 shipped)
- [x] Door enter/exit + apartment + shop interiors  
- [x] Vehicle cockpit camera (+ enter blend)  
- [x] CBD facade/signage variety  
- [x] Ped clothing/hat variants  
- [ ] More interiors (bank, ZRP desk)  
- [ ] Real mirror render targets (mobile-costly)  

### Phase B — Living Harare
- District identity: Mbare, Avondale, Borrowdale (streamed chunks)
- Kombi business loop (hire, fuel, clamp/fine at unauthorised load)
- Calendar + public holidays (data-driven ZW calendar)
- Volts JT “Late Arrival” mission with consequences

### Phase C — Systems scale
- Economy (USD/ZiG config), properties, reputation
- Aviation / military as gated content packs
- First-person mirrors (mobile-optimized RT / dual cam)

### Engine decision gate
True Unreal/FIFA-class characters + interiors need either:
- **glTF character pipeline** into Three.js, or  
- **Unreal Engine 5** project with Nanite/Lumen and a multi-year art team  

Jumping engines mid-flight without asset pipeline = rewrite risk. Stay on Three.js until Phase A acceptance tests pass, then decide.

## Acceptance tests (current target)

- [x] Stick moves Ngwere on iPhone (Sideloadly)  
- [x] Audio starts after New Game / first touch  
- [ ] Open apartment door and walk rooms  
- [ ] Enter vehicle with animation + see dashboard  
- [ ] Rear-view / side mirrors show world  

## Rule we follow

Never mark a feature complete if it is only a menu, mockup, or concept image.
