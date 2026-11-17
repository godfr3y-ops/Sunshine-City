import { THREE, G, BOX, clamp, lerp, dist, angDiff, rrand, rpick, rint, textSprite } from './util.js';
import { VT } from './models.js';
import { W, PL, buildWorld, collide, inside, nearestNode, nodesNear, roadAt, district, BOUNDS, edge, edgeNear, route, pave, sigState, updateSignals } from './world.js';
import { spawnVeh, collideVehicles, updateAI, toLane, lanePose } from './vehicles.js';
import { A, audioInit, audioUnlock, sfxHorn, sfxCrash, sfxCash, sfxWhistle, audioUpdate, radioNext, radioName, speakPhrase } from './audio.js';
import { pickHwindi, pickBanter, pickPax, ambientFor, PAX_FUNNY } from './phrases.js';

const $ = id => document.getElementById(id);
const QUAL = {
  low: { traffic: 10, peds: 14, pr: 1, far: 380, lod: 55, prop: 150, aa: false, low: true, shadow: 0 },
  med: { traffic: 16, peds: 26, pr: 1.5, far: 560, lod: 80, prop: 230, aa: false, shadow: 1024 },
  high: { traffic: 26, peds: 40, pr: 2, far: 820, lod: 110, prop: 320, aa: true, shadow: 2048 },
};
const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const touchDev = matchMedia('(pointer:coarse)').matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || !!(typeof window !== 'undefined' && window.Capacitor);

// ------------------------------------------------------------------ input
const keys = {}, pressed = new Set(), tAct = new Set(), tHeld = new Set(), joy = { x: 0, y: 0, id: -1, active: false };
addEventListener('keydown', e => { if (!keys[e.code]) pressed.add(e.code); keys[e.code] = 1; if (/^(Space|Arrow|Tab)/.test(e.code)) e.preventDefault(); });
addEventListener('keyup', e => { keys[e.code] = 0; });
addEventListener('blur', () => { for (const k in keys) keys[k] = 0; });
const ACT = { E: ['KeyE', 'Enter'], F: ['KeyF'], J: ['KeyJ'], H: ['KeyH'], R: ['KeyR'], M: ['KeyM'], P: ['KeyP', 'Escape'] };
function act(n) { for (const c of ACT[n]) if (pressed.has(c)) { pressed.delete(c); return true; } if (tAct.has(n)) { tAct.delete(n); return true; } return false; }
function readInput() {
  const i = G.in;
  i.thr = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  i.steer = (keys.KeyA || keys.ArrowLeft ? 1 : 0) - (keys.KeyD || keys.ArrowRight ? 1 : 0);
  i.hb = keys.Space || tHeld.has('HB') ? 1 : 0; i.run = keys.ShiftLeft || keys.ShiftRight || tHeld.has('RUN') ? 1 : 0;
  if (joy.active) { i.thr = clamp(-joy.y * 1.35, -1, 1); i.steer = clamp(-joy.x * 1.35, -1, 1); if (Math.abs(i.thr) < .12) i.thr = 0; if (Math.abs(i.steer) < .12) i.steer = 0; }
}
function initTouch() {
  $('touch').classList.remove('hide');
  const j = $('joy'), k = $('knob');
  const setStick = (clientX, clientY) => {
    const r = j.getBoundingClientRect(), R = Math.max(1, r.width / 2);
    let x = (clientX - r.left - R) / R, y = (clientY - r.top - R) / R;
    const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
    joy.x = x; joy.y = y; joy.active = true;
    k.style.transform = `translate(${x * R * .55}px,${y * R * .55}px)`;
  };
  const clearStick = () => { joy.id = -1; joy.active = false; joy.x = joy.y = 0; k.style.transform = ''; };
  const pt = e => (e.changedTouches && e.changedTouches[0]) || e;
  const down = e => { const t = pt(e); joy.id = t.pointerId != null ? t.pointerId : (t.identifier != null ? t.identifier : 1); setStick(t.clientX, t.clientY); audioUnlock(); e.preventDefault(); };
  const move = e => { if (!joy.active) return; const t = pt(e); if (t.pointerId != null && joy.id !== -1 && t.pointerId !== joy.id) return; setStick(t.clientX, t.clientY); e.preventDefault(); };
  const up = e => { clearStick(); e.preventDefault(); };
  j.addEventListener('pointerdown', e => { try { j.setPointerCapture(e.pointerId); } catch (err) { } down(e); }, { passive: false });
  j.addEventListener('pointermove', move, { passive: false });
  j.addEventListener('pointerup', up, { passive: false });
  j.addEventListener('pointercancel', up, { passive: false });
  j.addEventListener('touchstart', down, { passive: false });
  j.addEventListener('touchmove', move, { passive: false });
  j.addEventListener('touchend', up, { passive: false });
  j.addEventListener('touchcancel', up, { passive: false });
  document.querySelectorAll('[data-act]').forEach(b => {
    const n = b.dataset.act;
    const on = e => { e.preventDefault(); audioUnlock(); if (n === 'HB' || n === 'RUN') tHeld.add(n); else tAct.add(n); b.classList.add('on'); };
    const off = () => { tHeld.delete(n); b.classList.remove('on'); };
    b.addEventListener('pointerdown', on, { passive: false });
    b.addEventListener('touchstart', on, { passive: false });
    b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off);
    b.addEventListener('touchend', off); b.addEventListener('touchcancel', off);
  });
}

// ------------------------------------------------------------------ HUD helpers
let toastT = 0, bannerT = 0;
function toast(msg, sec = 3.5) { $('toast').textContent = msg; $('toast').style.opacity = 1; toastT = sec; }
function objective(t) { if (G.objText !== t) { G.objText = t; $('obj').textContent = t || ''; $('obj').style.display = t ? 'block' : 'none'; } }
function prompt(t) { if (G.prText !== t) { G.prText = t; $('prompt').textContent = t || ''; $('prompt').style.display = t ? 'block' : 'none'; } }
function banner(t, sub, col = '#ffd23f') { $('bt').textContent = t; $('bt').style.color = col; $('bs').textContent = sub || ''; $('banner').classList.remove('hide'); bannerT = 4; }
function bar(lbl, f) { if (lbl == null) { $('bar').classList.add('hide'); return; } $('bar').classList.remove('hide'); $('barl').textContent = lbl; $('barf').style.width = (clamp(f, 0, 1) * 100) + '%'; }
function showDialog(lines) { G.dialog = { lines, i: 0 }; drawDialog(); $('dialog').classList.remove('hide'); }
function drawDialog() { const d = G.dialog, l = d.lines[d.i]; $('dn').textContent = l[0]; $('dt').textContent = l[1]; }
function advanceDialog() { const d = G.dialog; if (!d) return; d.i++; if (d.i >= d.lines.length) { G.dialog = null; $('dialog').classList.add('hide'); } else drawDialog(); }
function earn(n) { const p = G.player; p.money = Math.max(0, p.money + n); if (n > 0) sfxCash(); G.cashFx = 1; save(); }
function save() { try { localStorage.setItem('sunshine-city', JSON.stringify({ money: G.player.money, story: G.story })); } catch (e) { } }
function load() { try { return JSON.parse(localStorage.getItem('sunshine-city')) || null; } catch (e) { return null; } }

const pp = () => G.player.veh || G.player;
G.pp = pp; G.pspeed = () => G.player.veh ? Math.abs(G.player.veh.speed) : G.player.spd;
G.onPlayerCrash = a => { G.shake = Math.min(1.2, G.shake + a * .04); if (a > 2) { G.hits++; sfxCrash(clamp(a / 40, .1, .6)); } if (a > 12) hurt(a * .2); };
function hurt(n) { const p = G.player; if (p.hp <= 0) return; p.hp -= n; G.hurtFx = 1; if (p.hp <= 0) wasted(); }

// ------------------------------------------------------------------ player
// Ngwere — built from rounded shapes with jointed hips, knees, shoulders and elbows:
// black hoodie with yellow sleeve stripes and chest script, white tee hem, cargo pants, flag cap, locs, backpack, yellow-and-black high-tops
function makePlayer() {
  const g = new THREE.Group(), mats = {};
  const mat = c => mats[c] || (mats[c] = new THREE.MeshStandardMaterial({
    color: c, roughness: c === 0x6a4530 ? .62 : .78, metalness: 0.04,
    emissive: c === 0x6a4530 ? 0x1a0f0a : 0x000000, emissiveIntensity: c === 0x6a4530 ? .12 : 0,
  }));
  const add = (geo, m, x, y, z, parent) => { const o = new THREE.Mesh(geo, typeof m === 'number' ? mat(m) : m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; (parent || g).add(o); return o; };
  const cap = (r, len, sx = 1, sz = 1) => new THREE.CapsuleGeometry(r, len, 6, 14).scale(sx, 1, sz), box = (w, h, d) => new THREE.BoxGeometry(w, h, d), sph = (r, sx = 1, sy = 1, sz = 1) => new THREE.SphereGeometry(r, 22, 16).scale(sx, sy, sz);
  const grp = (x, y, z, parent) => { const o = new THREE.Group(); o.position.set(x, y, z); (parent || g).add(o); return o; };
  const BLK = 0x18181b, YEL = 0xf2b90f, SK = 0x6a4530, LOC = 0x19110b, PANT = 0x1d1d20;
  const tex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  // head with a painted face (sphere UV: the front of the head is at u = 0.25)
  const face = tex(512, 256, x => { x.fillStyle = '#6a4530'; x.fillRect(0, 0, 512, 256); const cx = 128;
    x.fillStyle = 'rgba(0,0,0,.16)'; x.fillRect(cx - 54, 150, 108, 60); x.fillStyle = 'rgba(255,220,190,.07)'; x.fillRect(cx - 30, 70, 60, 50);
    for (const s of [-1, 1]) { x.fillStyle = '#f3efe8'; x.beginPath(); x.ellipse(cx + s * 25, 112, 11, 6, 0, 0, 6.3); x.fill(); x.fillStyle = '#2a1a10'; x.beginPath(); x.arc(cx + s * 25, 112, 5.2, 0, 6.3); x.fill(); x.fillStyle = '#0c0806'; x.beginPath(); x.arc(cx + s * 25, 112, 2.4, 0, 6.3); x.fill();
      x.strokeStyle = '#1a100a'; x.lineWidth = 5; x.lineCap = 'round'; x.beginPath(); x.moveTo(cx + s * 12, 98); x.quadraticCurveTo(cx + s * 25, 91, cx + s * 39, 99); x.stroke(); x.lineWidth = 2; x.beginPath(); x.moveTo(cx + s * 13, 109); x.quadraticCurveTo(cx + s * 25, 103, cx + s * 37, 110); x.stroke(); }
    x.strokeStyle = 'rgba(30,15,8,.55)'; x.lineWidth = 3; x.beginPath(); x.moveTo(cx - 4, 112); x.lineTo(cx - 8, 140); x.quadraticCurveTo(cx, 147, cx + 8, 140); x.stroke(); x.fillStyle = 'rgba(20,10,5,.6)'; x.beginPath(); x.ellipse(cx - 6, 142, 3, 2, 0, 0, 6.3); x.ellipse(cx + 6, 142, 3, 2, 0, 0, 6.3); x.fill();
    x.fillStyle = '#4a2a22'; x.beginPath(); x.ellipse(cx, 166, 17, 6.5, 0, 0, 6.3); x.fill(); x.strokeStyle = '#2e1812'; x.lineWidth = 2; x.beginPath(); x.moveTo(cx - 16, 165); x.quadraticCurveTo(cx, 169, cx + 16, 165); x.stroke();
    x.fillStyle = 'rgba(15,8,4,.35)'; x.fillRect(cx - 40, 178, 80, 14); });
  const head = grp(0, 1.6, 0); add(new THREE.SphereGeometry(.118, 28, 22).scale(.92, 1.14, 1), new THREE.MeshStandardMaterial({ map: face, roughness: .55, metalness: .02, emissive: 0xffffff, emissiveMap: face, emissiveIntensity: .18 }), 0, 0, 0, head);
  for (const s of [-1, 1]) add(sph(.03, .5, 1, .8), SK, s * .108, -.005, .0, head);
  add(new THREE.CylinderGeometry(.05, .058, .1, 12), SK, 0, 1.47, 0);
  // cap, brim and flag patch
  add(new THREE.SphereGeometry(.128, 20, 10, 0, 6.3, 0, Math.PI / 2).scale(.95, .8, 1.02), 0x0c0c0e, 0, .06, 0, head); add(new THREE.CylinderGeometry(.128 * .95, .128 * .95, .028, 20).scale(1, 1, 1.02), 0x0c0c0e, 0, .054, 0, head);
  add(new THREE.CylinderGeometry(.105, .105, .014, 18, 1, false, -Math.PI / 2, Math.PI).scale(1, 1, 1.25), 0x0c0c0e, 0, .05, .075, head).castShadow = false;
  const flagT = tex(64, 40, x => { ['#1e8e4e', '#f2c300', '#c62828', '#111', '#c62828', '#f2c300', '#1e8e4e'].forEach((c, i) => { x.fillStyle = c; x.fillRect(0, i * 40 / 7, 64, 40 / 7 + 1); }); x.fillStyle = '#fff'; x.beginPath(); x.moveTo(0, 0); x.lineTo(24, 20); x.lineTo(0, 40); x.fill(); x.fillStyle = '#f2c300'; x.fillRect(4, 16, 8, 8); }), flagM = new THREE.MeshBasicMaterial({ map: flagT });
  const fp = add(new THREE.PlaneGeometry(.07, .042), flagM, 0, .112, .127, head); fp.rotation.x = -.25;
  // locs hanging from under the cap
  for (let i = 0; i < 15; i++) { const th = Math.PI * (-.06 + i * 1.12 / 14), ln = .15 + (i % 4) * .035, o = add(cap(.016, ln), LOC, Math.cos(th) * .112, .0 - ln / 2, -Math.sin(th) * .112 - .012, head); o.rotation.z = Math.cos(th) * .18; o.rotation.x = Math.sin(th) * .14; }
  // hoodie torso, hood, tee hem, pouch, drawstrings, chest script
  add(cap(.175, .34, 1.16, .8), BLK, 0, 1.15, 0); add(sph(.15, 1.15, .62, .85), BLK, 0, 1.45, -.085); add(new THREE.CylinderGeometry(.2, .2, .05, 16).scale(1.19, 1, .8), 0xf4f4f4, 0, .845, 0);
  add(new THREE.CylinderGeometry(.205, .21, .09, 16).scale(1.19, 1, .8), 0x141416, 0, .91, 0); add(box(.26, .13, .03), 0x202024, 0, 1.0, .155);
  const logoT = tex(256, 96, x => { x.clearRect(0, 0, 256, 96); x.fillStyle = '#f2b90f'; x.font = 'italic bold 64px Georgia, serif'; x.textAlign = 'center'; x.fillText('Ngwere', 128, 68); });
  add(new THREE.PlaneGeometry(.36, .135), new THREE.MeshBasicMaterial({ map: logoT, transparent: true }), 0, 1.24, .163);
  for (const s of [-1, 1]) { add(new THREE.CylinderGeometry(.006, .006, .2, 5), YEL, s * .045, 1.33, .165); add(box(.045, .46, .02), 0x0e0e10, s * .15, 1.2, .15).rotation.z = s * .05; }
  // backpack
  add(cap(.125, .2, 1.3, .75), 0x101012, 0, 1.15, -.225); add(box(.2, .11, .03), 0x1a1a1e, 0, 1.08, -.325); add(box(.07, .025, .01), 0x8a8a8a, 0, 1.2, -.326);
  // arms: shoulder → elbow → hand, yellow stripe down the sleeve, sleeves pushed up
  const arm = s => { const sh = grp(s * .25, 1.39, 0); add(cap(.06, .2), BLK, 0, -.15, 0, sh); add(box(.014, .32, .055), YEL, s * .056, -.16, 0, sh); add(sph(.064, 1, .85, 1), BLK, -s * .01, -.01, 0, sh);
    const el = grp(0, -.3, 0, sh); add(cap(.052, .1), BLK, 0, -.07, 0, el); add(box(.014, .14, .05), YEL, s * .05, -.07, 0, el); add(new THREE.CylinderGeometry(.056, .056, .035, 10), 0x141416, 0, -.15, 0, el); add(cap(.04, .1), SK, 0, -.21, 0, el); add(sph(.045, .8, 1.15, 1), SK, 0, -.315, .005, el);
    if (s < 0) add(new THREE.CylinderGeometry(.046, .046, .028, 10), 0x0a0a0a, 0, -.265, 0, el); return [sh, el]; };
  // legs: hip → knee → sneaker, cargo pockets, flag patch on the left pocket
  const leg = s => { const hip = grp(s * .1, .87, 0); add(cap(.088, .26), PANT, 0, -.2, 0, hip); add(box(.035, .15, .12), 0x242428, s * .092, -.27, 0, hip); add(box(.037, .03, .125), 0x2c2c31, s * .092, -.2, 0, hip);
    if (s < 0) { const f = add(new THREE.PlaneGeometry(.05, .03), flagM, s * .112, -.27, 0, hip); f.rotation.y = -Math.PI / 2; }
    const kn = grp(0, -.42, 0, hip); add(cap(.072, .24), PANT, 0, -.18, 0, kn); add(new THREE.CylinderGeometry(.068, .062, .05, 10), 0x141416, 0, -.36, 0, kn);
    add(new THREE.CylinderGeometry(.058, .062, .08, 10), 0x0c0c0e, 0, -.39, -.005, kn); add(box(.098, .085, .25), 0x0c0c0e, 0, -.405, .05, kn); add(box(.1, .055, .09), YEL, 0, -.42, .135, kn); add(box(.102, .05, .1), YEL, 0, -.4, -.03, kn); add(box(.1, .03, .06), YEL, 0, -.375, .06, kn); add(box(.106, .024, .27), 0xf6f6f2, 0, -.458, .05, kn); add(box(.108, .012, .275), YEL, 0, -.474, .05, kn);
    return [hip, kn]; };
  const [aL, eL] = arm(-1), [aR, eR] = arm(1), [lL, kL] = leg(-1), [lR, kR] = leg(1);
  G.scene.add(g);
  G.player = { x: W.start.x, z: W.start.z, h: W.start.h, hp: 100, veh: null, money: 30, wanted: 0, stock: 0, mesh: g, parts: { legL: lL, legR: lR, armL: aL, armR: aR, kL, kR, eL, eR, head }, anim: 0, spd: 0, hitCd: 0 };
}
function updateFoot(dt) {
  const p = G.player, i = G.in;
  let sp = 0;
  // Mobile stick: camera-relative walk (push toward where you look). Keyboard: tank turn + forward.
  if (joy.active && Math.hypot(joy.x, joy.y) > .1) {
    const sx = Math.sin(G.camH), cz = Math.cos(G.camH), rx = cz, rz = -sx;
    const jx = joy.x, jy = -joy.y; // stick up = forward along camera
    let mx = rx * jx + sx * jy, mz = rz * jx + cz * jy;
    const mag = Math.hypot(mx, mz) || 1; mx /= mag; mz /= mag;
    p.h = Math.atan2(mx, mz);
    const run = i.run || mag > .82;
    sp = mag * (run ? 6.8 : 3.8);
    if (G.vend.active && mag > .2) stopVend();
  } else {
    if (G.vend.active && Math.abs(i.thr) > .2) stopVend();
    p.h += i.steer * 2.8 * dt;
    const run = !!i.run;
    sp = i.thr > 0 ? i.thr * (run ? 6.6 : 3.6) : i.thr * 1.8;
  }
  p.spd = Math.abs(sp);
  p.x = clamp(p.x + Math.sin(p.h) * sp * dt, BOUNDS.x0, BOUNDS.x1); p.z = clamp(p.z + Math.cos(p.h) * sp * dt, BOUNDS.z0, BOUNDS.z1);
  collide(p, .35); p.hitCd -= dt;
  for (const v of G.vehicles) {
    if (Math.abs(v.x - p.x) > 8 || Math.abs(v.z - p.z) > 8) continue;
    const fx = Math.sin(v.h), fz = Math.cos(v.h);
    for (const s of [1, 0, -1]) {
      const cx = v.x + fx * v.co * s, cz = v.z + fz * v.co * s, d = dist(cx, cz, p.x, p.z), m = v.cr + .35;
      if (d < m && d > .001) { p.x = cx + (p.x - cx) / d * m; p.z = cz + (p.z - cz) / d * m; if (Math.abs(v.speed) > 4 && p.hitCd <= 0) { hurt((Math.abs(v.speed) - 3) * 4); p.hitCd = 1; G.shake = .8; sfxCrash(.3); } }
    }
  }
  p.anim += Math.max(.35, Math.abs(sp)) * dt * (p.spd > .05 ? 2.9 : 0);
  const sw = Math.sin(p.anim) * .85 * Math.min(1, p.spd / 2.6);
  const P = p.parts, amp = Math.min(1, p.spd / 2.6), ph = p.anim;
  P.legL.rotation.x = sw; P.legR.rotation.x = -sw; P.kL.rotation.x = Math.max(0, Math.sin(ph + 1.1)) * 1.25 * amp; P.kR.rotation.x = Math.max(0, Math.sin(ph + 1.1 + Math.PI)) * 1.25 * amp;
  P.armL.rotation.x = -sw * .9; P.armR.rotation.x = sw * .9; P.eL.rotation.x = -(.18 + Math.max(0, -Math.sin(ph)) * .75 * amp + (p.spd > 5 ? .65 : 0)); P.eR.rotation.x = -(.18 + Math.max(0, Math.sin(ph)) * .75 * amp + (p.spd > 5 ? .65 : 0));
  P.armL.rotation.z = -.08; P.armR.rotation.z = .08; P.head.rotation.y = clamp((joy.active ? -joy.x : -i.steer) * .4, -.55, .55);
  p.mesh.position.set(p.x, .1 + Math.abs(Math.sin(ph)) * .03 * amp, p.z); p.mesh.rotation.y = p.h; p.mesh.rotation.x = p.spd > 5 ? .12 : 0;
}
function tryEnter() {
  const p = G.player; let best = null, bd = 1e9;
  for (const v of G.vehicles) { const d = dist(v.x, v.z, p.x, p.z) - v.t.L / 2; if (d < 2.6 && d < bd) { bd = d; best = v; } }
  if (!best) return;
  const v = best;
  if (v.dead) { toast('This one is finished — engine is dead.'); return; }
  if (v.ai && v.ai.mode === 'pursue') { toast('Climbing into a chasing police car? Aiwa.'); return; }
  if (G.chase === v) { toast('He has locked the doors!'); return; }
  const official = v.type === 'police' || v.type === 'army' || v.type === 'council' || v.type === 'ambulance';
  const allowed = (v.type === 'police' && G.duty === 'police') || (v.type === 'army' && G.duty === 'army') || (v.type === 'council' && G.duty === 'council') || (v.type === 'ambulance' && G.duty === 'ems') || v === G.sv || (v.keep && !official);
  if (v.ai) { ejectDriver(v); v.ai = null; if (!allowed) addWanted(v.type === 'police' ? 2 : 1, 'Hijacking reported!'); }
  else if (official && !allowed) addWanted(v.type === 'army' ? 3 : v.type === 'police' ? 2 : 1, v.type === 'army' ? 'You stole an army truck! Military police alerted.' : 'Government vehicle stolen!');
  stopVend(); p.veh = v; v.noRev = false; p.mesh.visible = false; G.camH = v.h;
  if (v.t.job && !G.script) toast(`${v.t.name} — press [J] to start: ${v.t.job}`);
  if (A.station < 0 && !G.radioTouched) { G.radioTouched = true; radioNext(); toast('📻 ' + radioName() + '   ([R] to change)', 4); }
}
function exitVeh(force) {
  const p = G.player, v = p.veh; if (!v) return;
  if (!force && Math.abs(v.speed) > 5) { toast('Slow down first!'); return; }
  const fx = Math.sin(v.h), fz = Math.cos(v.h);
  p.x = v.x - fz * (v.t.W / 2 + 1); p.z = v.z + fx * (v.t.W / 2 + 1); p.h = v.h; collide(p, .35);
  v.thr = 0; v.steer = 0; v.hb = 1; p.veh = null; p.mesh.visible = true; G.camH = p.h;
}
function ejectDriver(v) {
  const q = G.peds.reduce((a, b) => (!a || (b.d || 0) > (a.d || 0)) ? b : a, null); if (!q) return;
  q.on = true; q.x = v.x + Math.cos(v.h) * (v.t.W / 2 + .8); q.z = v.z - Math.sin(v.h) * (v.t.W / 2 + .8); q.state = 'flee'; q.t = 6; q.h = v.h + Math.PI / 2;
}

// ------------------------------------------------------------------ pedestrians (6 instanced meshes for everybody)
const PSKIN = [0x5a3a26, 0x6b4630, 0x4a2f20, 0x7a523a], PSHIRT = [0xd43f2a, 0x2a6fd4, 0xf2c300, 0x2e9b57, 0xffffff, 0x8e44ad, 0xe67e22, 0x16a085, 0x34495e, 0xf7f1e3, 0xc2185b], PPANT = [0x2c3e50, 0x1b1b1b, 0x5d4037, 0x3b4a6b, 0x7f8c8d, 0x8d6e63];
const _b = new THREE.Matrix4(), _m = new THREE.Matrix4(), _sv = new THREE.Vector3(), _col = new THREE.Color();
function initPeds() {
  const n = G.Q.peds, mk = geo => { const m = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial(), n); m.frustumCulled = false; G.scene.add(m); return m; };
  const lg = new THREE.CapsuleGeometry(.085, .64, 3, 8), ag = new THREE.CapsuleGeometry(.055, .48, 3, 8);
  G.pm = { torso: mk(new THREE.CapsuleGeometry(.19, .3, 4, 10).scale(1.15, 1, .75)), head: mk(new THREE.SphereGeometry(.125, 12, 10).scale(.95, 1.12, 1)), legL: mk(lg), legR: mk(lg), armL: mk(ag), armR: mk(ag) };
  G.peds = [];
  for (let i = 0; i < n; i++) {
    const q = { i, on: false, x: 0, z: 0, h: 0, state: 'walk', t: 0, ph: Math.random() * 6, spd: rrand(1.1, 1.8), loop: null, k: 0, dir: 1, vx: 0, vz: 0 };
    const sk = rpick(PSKIN); G.pm.torso.setColorAt(i, _col.set(rpick(PSHIRT))); G.pm.head.setColorAt(i, _col.set(sk)); G.pm.armL.setColorAt(i, _col.set(sk)); G.pm.armR.setColorAt(i, _col.set(sk));
    const pc = rpick(PPANT); G.pm.legL.setColorAt(i, _col.set(pc)); G.pm.legR.setColorAt(i, _col.set(pc));
    G.peds.push(q); placePed(q, 12, 120);
  }
  for (const k in G.pm) G.pm[k].instanceColor.needsUpdate = true;
}
function pedTarget(q) { const n = W.nodes, a = n[q.a], b = n[q.b], e = edge(q.a, q.b); let dx = b.x - a.x, dz = b.z - a.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; q.off = (e.cls >= 7 ? e.w * .3 : e.w / 2 + 1.5) * q.side; q.dx = dx; q.dz = dz; q.tx = b.x + dz * q.off; q.tz = b.z - dx * q.off; }
function placePed(q, minD, maxD) {
  const p = pp(); q.on = false; const c = nodesNear(p.x, p.z, maxD); if (!c.length) return;
  for (let t = 0; t < 10; t++) {
    const a = rpick(c); if (!a.pb.length) continue; const bi = rpick(a.pb), e = edge(a.i, bi); if (e.cls === 5 || (e.cls === 6 && Math.random() < .75)) continue; const b = W.nodes[bi];
    q.a = a.i; q.b = bi; q.side = Math.random() < .5 ? 1 : -1; pedTarget(q); const f = Math.random(), x = lerp(a.x, b.x, f) + q.dz * q.off, z = lerp(a.z, b.z, f) - q.dx * q.off, d = dist(x, z, p.x, p.z);
    if (d < minD || d > maxD || inside(x, z)) continue;
    q.on = true; q.x = x; q.z = z; q.state = 'walk'; q.vx = q.vz = 0; return;
  }
}
function pedPart(mesh, i, px, py, pz, rx, oy, sx, sy, sz) {
  _m.makeRotationX(rx); const e = _m.elements; e[12] = px; e[13] = py + oy * Math.cos(rx); e[14] = pz + oy * Math.sin(rx);
  _m.scale(_sv.set(sx, sy, sz)).premultiply(_b); mesh.setMatrixAt(i, _m);
}
function updatePeds(dt) {
  const p = pp(), pv = G.player.veh, M = G.pm;
  for (const q of G.peds) {
    if (!q.on) { if (Math.random() < dt * 2) placePed(q, 60, 130); if (!q.on) { _m.makeScale(0, 0, 0); for (const k in M) M[k].setMatrixAt(q.i, _m); continue; } }
    q.d = dist(q.x, q.z, p.x, p.z);
    if (q.d > 150) { placePed(q, 60, 130); continue; }
    let sp = 0;
    if (q.state === 'down') { q.t -= dt; q.x += q.vx * dt; q.z += q.vz * dt; q.vx *= .9; q.vz *= .9; if (q.t <= 0) { q.state = 'flee'; q.t = 4; q.h = Math.random() * 6.28; } }
    else {
      // danger check
      for (const v of G.vehicles) {
        const dx = q.x - v.x, dz = q.z - v.z; if (Math.abs(dx) > 16 || Math.abs(dz) > 16) continue;
        const d = Math.hypot(dx, dz), vs = Math.abs(v.speed);
        if (d < v.t.L / 2 + .4) {
          const fx = Math.sin(v.h), fz = Math.cos(v.h), along = dx * fx + dz * fz, lat = Math.abs(dx * fz - dz * fx);
          if (Math.abs(along) < v.t.L / 2 + .3 && lat < v.t.W / 2 + .3) {
            if (vs > 5) { q.state = 'down'; q.t = 6; G.downPed = { x: q.x, z: q.z }; q.vx = v.vx * .8; q.vz = v.vz * .8; q.h = v.h; G.chaos = 3; if (v === pv) { addWanted(1, 'You hit a pedestrian!'); sfxCrash(.25); G.shake = .5; v.speed *= .85; } break; }
            else { q.x += dx / d * .15; q.z += dz / d * .15; }
          }
        }
        if (vs > 8 && d < 9 + vs * .45) { const fx = Math.sin(v.h), fz = Math.cos(v.h); if ((dx * fx + dz * fz) / d > .55 * Math.sign(v.speed)) { q.state = 'flee'; q.t = rrand(2.5, 4.5); q.h = Math.atan2(dx, dz) + rrand(-.6, .6); } }
      }
      if (q.state !== 'down') {
        if (G.chaos > 0 && q.d < 28 && q.state === 'walk') { q.state = 'flee'; q.t = rrand(3, 5); q.h = Math.atan2(q.x - p.x, q.z - p.z) + rrand(-.7, .7); }
        if (q.state === 'flee') {
          q.t -= dt; sp = 5.6; q.x += Math.sin(q.h) * sp * dt; q.z += Math.cos(q.h) * sp * dt; if (collide(q, .3)) q.h += 1.3;
          if (q.t <= 0) q.state = 'walk';
        } else {
          const dx = q.tx - q.x, dz = q.tz - q.z, d = Math.hypot(dx, dz);
          if (d < 1) { const o = W.nodes[q.b].pb.filter(i => i !== q.a), c = o.length ? rpick(o) : q.a; q.a = q.b; q.b = c; pedTarget(q); } else { q.h += angDiff(q.h, Math.atan2(dx, dz)) * Math.min(1, dt * 6); sp = q.spd; q.x += Math.sin(q.h) * sp * dt; q.z += Math.cos(q.h) * sp * dt; }
        }
      }
    }
    // matrices
    if (q.d > G.Q.prop * .6) { _m.makeScale(0, 0, 0); for (const k in M) M[k].setMatrixAt(q.i, _m); continue; }
    q.ph += sp * dt * 2.6; const sw = Math.sin(q.ph) * .7 * Math.min(1, sp / 2), i = q.i;
    if (q.state === 'down') { _b.makeRotationX(-Math.PI / 2); _m.makeRotationY(q.h); _b.premultiply(_m).setPosition(q.x, .32, q.z); } else _b.makeRotationY(q.h).setPosition(q.x, .14, q.z);
    const up = q.state === 'flee' ? Math.PI : 0;
    pedPart(M.torso, i, 0, 1.13, 0, 0, 0, 1, 1, 1); pedPart(M.head, i, 0, 1.6, 0, 0, 0, 1, 1, 1);
    pedPart(M.legL, i, -.1, .84, 0, sw, -.41, 1, 1, 1); pedPart(M.legR, i, .1, .84, 0, -sw, -.41, 1, 1, 1);
    pedPart(M.armL, i, -.28, 1.42, 0, up ? up - .3 : -sw, -.3, 1, 1, 1); pedPart(M.armR, i, .28, 1.42, 0, up ? up + .3 : sw, -.3, 1, 1, 1);
  }
  for (const k in M) M[k].instanceMatrix.needsUpdate = true;
}

// ------------------------------------------------------------------ markers
function makeMarker(x, z, color, text, r = 3.2) {
  const g = new THREE.Group();
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1.6, 24, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .38, side: THREE.DoubleSide, depthWrite: false }));
  cyl.position.y = .9; g.add(cyl);
  const ring = new THREE.Mesh(new THREE.RingGeometry(r - .35, r, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .85, depthWrite: false })); ring.position.y = .26; g.add(ring);
  let s = null; if (text) { s = textSprite(text, { h: 1.5 }); s.position.y = 4.4; g.add(s); }
  g.position.set(x, 0, z); G.scene.add(g);
  return { x, z, r, g, cyl, s };
}
function initMarkers() {
  G.marks = [];
  const add = (kind, pos, col, text, extra) => G.marks.push(Object.assign(makeMarker(pos.x, pos.z, col, text), { kind }, extra));
  add('buy', W.buy, 0x35d07f, 'Buy stock — Mbare Musika');
  W.vend.forEach(v => add('vend', v, 0xff8a1f, 'Vending spot · ' + v.name, { spot: v }));
  add('zrp', W.marks.zrp, 0x3d7bff, 'ZRP duty'); add('army', W.marks.army, 0x7d9a3a, 'Army duty · Defence House'); add('council', W.marks.council, 0x18b6c9, 'City Council duty'); add('ems', W.marks.ems, 0xff5a6e, 'Ambulance duty');
  G.storyMark = Object.assign(makeMarker(0, 0, 0xffd23f, 'Story', 3.4), { kind: 'story' });
  G.tm = makeMarker(0, 0, 0xffe45c, null, 5); G.tm.g.visible = false;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, 60, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe45c, transparent: true, opacity: .3, depthWrite: false })); beam.position.y = 30; G.tm.g.add(beam);
  placeStoryMark();
}
function placeStoryMark() {
  const m = G.storyMark, st = STORY[G.story];
  if (!st) { m.g.visible = false; m.x = 1e6; return; }
  const at = W.marks['story' + G.story]; m.x = at.x; m.z = at.z; m.g.position.set(m.x, 0, m.z);
  if (m.s) m.g.remove(m.s); m.s = textSprite(`Story ${G.story + 1}: ${st.title}`, { h: 1.7, bg: 'rgba(120,80,0,.85)' }); m.s.position.y = 4.8; m.g.add(m.s);
}
function setTarget(x, z, r = 6) { G.target = { x, z, r }; G.tm.g.position.set(x, 0, z); G.tm.g.scale.set(r / 5, 1, r / 5); G.tm.g.visible = true; G.routeT = 0; }
function clearTarget() { G.target = null; G.tm.g.visible = false; G.route = null; }

// ------------------------------------------------------------------ script engine (story missions + jobs share it)
const say = lines => ({ start() { showDialog(lines); }, update() { return !G.dialog; } });
const call = fn => ({ update() { fn(); return true; } });
const waitFor = (label, fn, o = {}) => ({ update(dt, s) { objective(typeof label === 'function' ? label(s) : label); return fn(dt, s); }, failMsg: o.failMsg });
const goTo = o => ({
  start(s) { setTarget(o.x, o.z, o.r || 6); s.timer = o.time || 0; },
  update(dt, s) {
    const p = pp(), d = dist(p.x, p.z, o.x, o.z); let t = `${o.label} — ${Math.round(d)} m`;
    if (o.time) { s.timer -= dt; t += `   ⏱ ${Math.max(0, Math.ceil(s.timer))}s`; if (s.timer <= 0) return 'fail'; }
    objective(t);
    const pv = G.player.veh;
    if (d < (o.r || 6) && (!o.veh || (pv && o.veh.includes(pv.type))) && (!o.foot || !pv) && (!o.stop || G.pspeed() < 3)) return true;
    if (d < (o.r || 6) + 4 && o.veh && !(pv && o.veh.includes(pv.type))) objective('You need the right vehicle for this');
    if (d < (o.r || 6) + 2 && o.foot && pv) objective('Get out and walk into the marker [F]');
  }, end() { clearTarget(); }, failMsg: o.failMsg || 'You ran out of time.',
});
const chase = o => ({
  start(s) {
    const p = pp(), n = W.nodes, ok = a => a.nb.length && edge(a.i, a.nb[0]).cls <= 4; let c = nodesNear(p.x, p.z, 130).filter(a => ok(a) && dist(a.x, a.z, p.x, p.z) > 50);
    if (!c.length) c = [nodesNear(p.x, p.z, 600).filter(a => ok(a) && dist(a.x, a.z, p.x, p.z) > 45).sort((a, b) => dist(a.x, a.z, p.x, p.z) - dist(b.x, b.z, p.x, p.z))[0]];
    const a = rpick(c); let b = a.nb[0], bd = -1; for (const q of a.nb) { const d = dist(n[q].x, n[q].z, p.x, p.z); if (d > bd) { bd = d; b = q; } }
    const ps = lanePose(a.i, b, 12), v = spawnVeh(o.type, ps.x, ps.z, ps.h, o.color);
    v.keep = true; v.ai = { mode: 'lane', a: a.i, b, cruise: o.speed || 16.5, flee: true, side: 1 }; v.speed = 9; v.hp = v.maxHp = o.hp || 150;
    s.tgt = v; s.press = 0; s.lost = 0; G.chase = v;
  },
  update(dt, s) {
    const v = s.tgt, p = pp(), d = dist(v.x, v.z, p.x, p.z);
    objective(`${o.label} — ${Math.round(d)} m`); G.target = { x: v.x, z: v.z, r: 4, ent: true }; G.tm.g.visible = false;
    if (d < 17 && G.player.veh) s.press += dt * (d < 9 ? 22 : 13); else s.press = Math.max(0, s.press - dt * 2.5);
    const tot = clamp(s.press + (v.maxHp - v.hp) / v.maxHp * 100, 0, 100); bar(o.bar || 'SUSPECT', tot / 100);
    if (d > 270) { s.lost += dt; if (s.lost > 7) return 'fail'; } else s.lost = 0;
    if (tot >= 100 || v.dead) return true;
  },
  end(s) { const v = s.tgt; if (v) { v.ai = null; v.keep = false; v.thr = 0; v.hb = 1; } G.chase = null; clearTarget(); bar(null); },
  failMsg: 'The suspect got away.',
});
function startScript(def) { G.script = { def, i: -1, cur: null, t: 0 }; G.storyMark.g.visible = false; nextStep(); }
function nextStep() {
  const s = G.script; if (s.cur && s.cur.end) s.cur.end(s);
  s.i++; if (s.i >= s.def.steps.length) { endScript(true); return; }
  s.cur = s.def.steps[s.i]; if (s.cur.start) s.cur.start(s);
}
function updateScript(dt) {
  const s = G.script; if (!s) return;
  const r = s.cur.update ? s.cur.update(dt, s) : true;
  if (r === true) nextStep(); else if (r === 'fail') endScript(false, s.cur.failMsg);
}
function endScript(ok, why) {
  const s = G.script; if (!s) return; G.script = null;
  if (!ok && s.cur && s.cur.end) s.cur.end(s);
  objective(null); clearTarget(); bar(null); G.duty = null; G.noRaid = false;
  if (G.sv) { G.sv.keep = false; G.sv = null; }
  const d = s.def;
  if (ok) {
    if (d.reward) earn(d.reward);
    if (d.story) { G.story++; save(); banner('MISSION PASSED', `${d.title}   +$${d.reward}`); if (!STORY[G.story]) setTimeout(() => banner('SUNSHINE CITY', 'Story complete — the city is yours. Free roam continues.', '#7CFC9A'), 5200); }
    else banner(d.title.toUpperCase() + ' DONE', d.reward ? `+$${d.reward}` : (d.note || ''), '#7CFC9A');
  } else banner(d.story ? 'MISSION FAILED' : 'JOB FAILED', why || '', '#ff5a4f');
  placeStoryMark(); G.storyMark.g.visible = !!STORY[G.story]; G.storyCd = 4;
}

// ------------------------------------------------------------------ story
const inType = t => () => G.player.veh && G.player.veh.type === t;
const STORY = [
  { title: 'Mangwanani, Harare', reward: 13, steps: () => [
    say([['Sekuru Gidza', 'Ngwere! Muzukuru! So Joburg chewed you up and spat you back to Harare with one backpack, eh?'], ['Ngwere', 'Ndeipi Sekuru. Zvakapresser, but ndiripo. I just need a start, mdara.'], ['Sekuru Gidza', 'Then start. My kombi is right there at Copacabana. Do the Mbare run — Hwindi Fatso will shout for passengers. Keep LEFT, respect the robots, mind the speed cameras, and stop at roadblocks.'], ['Sekuru Gidza', 'And if the mandimbandimba touts ask for "rank fees"... just pay. For now.'], ['Ngwere', 'Sharp-sharp. Handei tione.']]),
    call(() => { const q = pave(PL.copa.x, PL.copa.z, -2, 1.5); G.sv = spawnVeh('kombi', q.x, q.z, q.h, 0xf4f4f0); G.sv.keep = true; }),
    waitFor("Get in Sekuru's kombi  [F]", () => G.player.veh === G.sv),
    call(() => {
      const yell = 'Mbare! Mbare-Mbare! One dollar, mota yazara! Vabereki hunzai mari dzekombi!';
      speakPhrase(yell, { shout: true });
      toast(`Hwindi Fatso: "${yell}"`, 5.5);
    }),
    goTo({ ...PL.mbare.stop, label: 'Drive to Mbare Musika (follow the yellow line)', veh: ['kombi'], stop: true, r: 11 }),
    say([['Hwindi Fatso', 'Driver wakapenga! Eighteen passengers, eighteen dollars.'], ['Tout', 'Iwe mfanha! This rank belongs to Spanner. Five dollars "parking". Every. Single. Load.'], ['Ngwere', 'Ko Spanner ndiani? Who is this guy?'], ['Hwindi Fatso', "Boss of the mandimbandimba. He taxes every kombi and every vendor from Mbare to Copacabana. Don't start ma1 on your first day, blaz."]]),
  ] },
  { title: 'Musika', reward: 25, steps: () => [
    say([['Mai Chipo', "Ngwere! Your mother's son, standing around selling nothing? Take ten crates of tomatoes on credit."], ['Mai Chipo', 'Sell at First Street Mall — office workers pay double. Stand in the orange circle and set up.'], ['Mai Chipo', 'But when you hear "KANZURU!" — the municipal police — pack up and run, or they take everything.'], ['Ngwere', 'Bho zvangu Mai Chipo. Mari inouya.']]),
    call(() => { G.player.stock += 10; G.vend.busted = false; G.vend.sold = 0; G.noRaid = true; }),
    goTo({ ...W.vend[0], label: 'Go to the First Street Mall vending spot (walk into it)', foot: true, r: 3 }),
    waitFor(() => `Set up your stall [E] and sell 5 crates (${Math.min(5, G.vend.sold)}/5)`, () => (G.player.stock <= 0 && G.vend.sold < 5) ? 'fail' : G.vend.sold >= 5, { failMsg: 'You ran out of stock.' }),
    call(() => { G.noRaid = false; startRaid(W.vend[0]); }),
    waitFor('KANZURU! Pack up [E] and get 60 m away', () => G.vend.busted ? 'fail' : (!G.vend.active && dist(pp().x, pp().z, W.vend[0].x, W.vend[0].z) > 60), { failMsg: 'The council confiscated your stock.' }),
    say([['Mai Chipo (phone)', 'You escaped with the stock? Hesi! You are a real Harare vendor now.'], ['Mai Chipo', 'Strange, these raids... vendors who pay Spanner never get raided. Think about that, mwanangu.'], ['Ngwere', 'Hmm. Zvinonhuwa izvi. Something smells.']]),
  ] },
  { title: 'Mushikashika', reward: 40, steps: () => [
    say([['Blaz Tindo', 'Ngwere! Ndeipi gaz! Kombis are slow money. Take my hatchback — mushikashika style. Pick up anywhere, drop anywhere, vanish.'], ['Blaz Tindo', "Three quick fares. ZRP hates pirate taxis, so if you see blue lights... don't be there."], ['Ngwere', 'Uri kutamba here? Ini ndiri ngwere. Watch me.']]),
    call(() => { ensureFleet(true); }),
    waitFor('Get in the mushikashika hatchback  [F]', inType('fit')),
    goTo({ ...PL.copa.stop, label: 'Pick up at Copacabana', veh: ['fit'], stop: true, r: 10 }), goTo({ ...PL.town.stop, label: 'Drop at Town House', veh: ['fit'], stop: true, r: 10 }), call(() => earn(4)),
    goTo({ ...PL.joina.stop, label: 'Pick up at Joina City', veh: ['fit'], stop: true, r: 10 }), goTo({ ...PL.eastgate.stop, label: 'Drop at Eastgate', veh: ['fit'], stop: true, r: 10 }), call(() => earn(4)),
    goTo({ ...PL.unity.stop, label: 'Pick up at Africa Unity Square', veh: ['fit'], stop: true, r: 10 }),
    call(() => addWanted(2, 'ZRP: "Pirate taxi! Stop that hatchback!"')),
    waitFor('Lose the police!', () => G.player.wanted === 0),
    say([['Blaz Tindo', 'Hahaha! You drive like a kombi with no brakes.'], ['Blaz Tindo', "Listen — Spanner's boys came by. They want thirty percent of everything. I'm tired of them, shamwari."], ['Ngwere', 'Thirty? Aiwa. Munhu uyu ari kutijairira.']]),
  ] },
  { title: 'Sound Check', reward: 60, steps: () => [
    say([['Queen Maruva', "You're Gidza's nephew? The one they call Ngwere? Good. My engineer left the mixing laptop here and my show at Harare Gardens starts in minutes!"], ['Queen Maruva', 'Take the Handei Ride car. Get it to the stage. Roadblocks, robots, cameras — that is your problem, not mine.'], ['Ngwere', 'Chill Queen. Ndiri munzira — I am already there.']]),
    call(() => { const q = pave(PL.fourth.x, PL.fourth.z, -2, 1.5); G.sv = spawnVeh('ehail', q.x, q.z, q.h, 0xf2f2f2); G.sv.keep = true; }),
    waitFor('Get in the Handei Ride car  [F]', inType('ehail')),
    goTo({ ...PL.gardens.stop, label: 'Rush the laptop to Harare Gardens', stop: true, r: 11, time: 170, failMsg: 'The show started without sound.' }),
    say([['Queen Maruva', 'Yes! Tonight we sing for the vendors, the hwindis, everyone hustling in this city.'], ['Queen Maruva', 'Spanner tried to "tax" my show too. Somebody must stop that man. Talk to Inspector Chari at Harare Central.']]),
  ] },
  { title: 'National Duty', reward: 80, steps: () => [
    say([['Inspector Chari', "So you are Ngwere. Half the city says you drive like a criminal. The other half says you're honest. I need both."], ['Inspector Chari', "Spanner's bagman collects the \"rank fees\" in a grey hatchback. Take a patrol car and bring him in. Call it national duty."], ['Ngwere', 'Me, in a ZRP car? Nhasi zvadhakwa. Okay Inspector — tiri tese.']]),
    call(() => { G.duty = 'police'; ensureFleet(true); }),
    waitFor('Get in a ZRP patrol car  [F]', inType('police')),
    chase({ type: 'fit', color: 0x8d99ae, label: "Stop Spanner's bagman (stay close or ram him)", speed: 16.5, hp: 120, bar: 'BAGMAN' }),
    say([['Bagman', 'Okay, okay! Spanner moves the money tonight — out of Mbare, past Rufaro, in a black twin-cab!'], ['Inspector Chari', "Then we block the road at Rufaro. I'll call Major Dube at Defence House. Go there — you have earned a uniform for one night."]]),
  ] },
  { title: 'Spanner', reward: 500, steps: () => [
    say([['Major Dube', "So you're the kombi driver they call Ngwere. Tonight you drive for your country. Take a truck and block the road at Rufaro Stadium in Mbare."], ['Major Dube', 'When Spanner sees the roadblock he will run. Do NOT let him leave Mbare.'], ['Ngwere', 'Copy, Major. Spanner akwana — he is finished.']]),
    call(() => { G.duty = 'army'; ensureFleet(true); }),
    waitFor('Get in an army truck  [F]', inType('army')),
    goTo({ ...PL.rufaro.stop, label: 'Block the road at Rufaro Stadium, Mbare', veh: ['army'], stop: true, r: 13, time: 420 }),
    say([['Radio', "Black twin-cab approaching fast... he's seen you! He's running!"]]),
    chase({ type: 'boss', label: 'Stop Spanner!', bar: 'SPANNER', speed: 18, hp: 260 }),
    say([['Spanner', 'You?! The kombi driver?! Do you know who I—'], ['Ngwere', 'Ndini Ngwere, mdara. And your "rank fees" are finished.'], ['Inspector Chari', 'We know exactly who you are. Handcuffs.'], ['Mai Chipo', 'No more "rank fees"! Ngwere, the whole of Mbare Musika is cheering!'], ['Sekuru Gidza', 'Muzukuru... the kombi is yours now. Harare haimbomiri — this city never stops. Neither should you.']]),
  ] },
];
function startStory() { const st = STORY[G.story]; startScript({ title: st.title, reward: st.reward, story: true, steps: st.steps() }); }
// ------------------------------------------------------------------ jobs
const ranks = () => [PL.copa, PL.msq, PL.fourth, PL.charge, PL.mbare];
const dests = () => [PL.town, PL.gardens, PL.hosp, PL.zrp, PL.eastgate, PL.unity, PL.rail, PL.rbz, PL.joina, PL.rufaro, PL.copa, PL.fourth, PL.mbare, PL.meikles, PL.parliament, PL.gallery, PL.rainbow, PL.sports, PL.roadport];
const PAXLINE = PAX_FUNNY;
const man = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
function kerbPoint(minD, maxD) {
  const p = pp(), c = nodesNear(p.x, p.z, maxD).filter(a => a.ub.length && dist(a.x, a.z, p.x, p.z) > minD);
  for (let t = 0; t < 40 && c.length; t++) { const a = rpick(c), bi = rpick(a.ub), e = edge(a.i, bi); if (e.cls > 4 || e.len < 36) continue; const b = W.nodes[bi], dx = (b.x - a.x) / e.len, dz = (b.z - a.z) / e.len, s = Math.random() < .5 ? 1 : -1; return { x: a.x + dx * 18 + dz * s * (e.w / 2 - 1.6), z: a.z + dz * 18 - dx * s * (e.w / 2 - 1.6) }; }
  return PL.town.stop;
}
function emsSteps(n) {
  const steps = [];
  for (let i = 0; i < n; i++) { let pk; steps.push(call(() => { pk = kerbPoint(160, 520); G.duty = 'ems'; }), { start(s) { this.g = goTo({ x: pk.x, z: pk.z, label: 'Emergency call — reach the patient', veh: ['ambulance'], stop: true, r: 10, time: man(pp(), pk) / 9 + 50, failMsg: 'You were too slow. Another crew took the call.' }); this.g.start(s); }, update(dt, s) { return this.g.update(dt, s); }, end() { clearTarget(); }, failMsg: 'You were too slow. Another crew took the call.' },
    call(() => toast(rpick(['Paramedic: "Patient loaded. Hospital, now — siren on!"', 'Paramedic: "Stable but critical. Drive smooth, Ngwere."']), 4)),
    goTo({ ...PL.hosp.stop, label: 'Rush the patient to West End Hospital', veh: ['ambulance'], stop: true, r: 11, time: 240, failMsg: 'You took too long.' }), call(() => { earn(22); toast('Patient delivered: +$22'); })); }
  return steps;
}
function jobFor(type) {
  if (type === 'ambulance') return { title: 'Ambulance call-out', steps: emsSteps(1) };
  if (type === 'kombi') {
    const p = pp(), rs = ranks().sort((a, b) => dist(a.stop.x, a.stop.z, p.x, p.z) - dist(b.stop.x, b.stop.z, p.x, p.z)), from = rs[0], to = rpick(rs.slice(1)); let pax = 0;
    return { title: 'Kombi run', steps: [
      goTo({ ...from.stop, label: `Load passengers at ${from.name}`, veh: ['kombi'], stop: true, r: 11 }),
      call(() => {
        pax = 9 + rint(10);
        const yell = `${to.short}! ${to.short}! One dollar! Vabereki hunzai mari dzekombi!`;
        speakPhrase(yell, { shout: true });
        toast(`Hwindi: "${yell}" — ${pax} passengers squeezed in. Safe here!`, 5.5);
      }),
      goTo({ ...to.stop, label: `Drive to ${to.name}`, veh: ['kombi'], stop: true, r: 11, time: man(from.stop, to.stop) / 7 + 70, failMsg: 'Passengers jumped off and took another kombi. "Town here!" they yelled, running.' }),
      call(() => {
        earn(pax);
        const line = pickBanter();
        speakPhrase(line, { shout: true });
        toast(`${pax} fares collected: +$${pax} · Hwindi: "${line}"`, 5);
      }),
    ] };
  }
  const pk = kerbPoint(120, 420), all = dests(), cands = all.filter(q => dist(q.stop.x, q.stop.z, pk.x, pk.z) > 300), dp = rpick(cands.length ? cands : all); let h0 = 0;
  const mult = type === 'fit' ? 1.6 : type === 'taxi' ? 1.35 : 1, nm = { fit: 'Mushikashika pickup', taxi: 'Taxi fare', ehail: 'Handei Ride trip' }[type];
  return { title: nm, steps: [
    goTo({ x: pk.x, z: pk.z, label: type === 'ehail' ? 'Ride request accepted — pick up your rider' : 'Pick up the passenger', veh: [type], stop: true, r: 10 }),
    call(() => {
      h0 = G.hits;
      const line = pickPax();
      speakPhrase(line.replace(/^"|"$/g, ''), { shout: false });
      toast('Passenger: ' + line, 4.5);
      if (type === 'fit' && Math.random() < .4) addWanted(1, 'ZRP spotted a pirate taxi! "Usandifendera shaa!!"');
    }),
    goTo({ ...dp.stop, label: `Drop off at ${dp.name}`, veh: [type], stop: true, r: 11 }),
    call(() => { let pay = Math.round((3 + dist(pk.x, pk.z, dp.stop.x, dp.stop.z) / 90) * mult); if (type === 'ehail') { const st = clamp(5 - (G.hits - h0), 1, 5); pay = Math.round(pay * (.5 + st * .14)); toast(`Rider rating: ${'★'.repeat(st)}${'☆'.repeat(5 - st)}   +$${pay}`, 4); } else toast(`Fare paid: +$${pay}`); earn(pay); }),
  ] };
}
const RBLINE = ['A kombi with 22 passengers — overloaded. Ticket issued.', 'Bakkie with no reflectors. Warned and released.', 'Driver had every paper in order. "Fambai zvakanaka."', 'Sedan with an expired licence disc. Spot fine.', 'A lorry of tomatoes from Mutoko. Waved through.'];
function dutyJob(kind) {
  ensureFleet(true); G.duty = kind;
  if (kind === 'ems') return { title: 'Ambulance shift', reward: 30, steps: [waitFor('Get in an ambulance  [F]', inType('ambulance')), ...emsSteps(2)] };
  if (kind === 'police') {
    if (Math.random() < .5) return { title: 'ZRP patrol', reward: 45, steps: [
      waitFor('Get in a ZRP patrol car  [F]', inType('police')),
      say([['Control', 'Control to patrol: reckless mushikashika reported near your position. Pull it over.']]),
      chase({ type: 'fit', label: 'Stop the mushikashika (stay close or ram)', speed: 16 }),
    ] };
    const rb = rpick(W.roadblocks);
    return { title: 'Roadblock duty', reward: 55, steps: [
      waitFor('Get in a ZRP patrol car  [F]', inType('police')),
      goTo({ x: rb.x, z: rb.z, label: `Report to the roadblock on ${rb.name}`, veh: ['police'], stop: true, r: 16 }),
      waitFor(s => `Man the roadblock — ${Math.max(0, Math.ceil(18 - (s.h || 0)))}s`, (dt, s) => { s.h = (s.h || 0) + dt; if (dist(pp().x, pp().z, rb.x, rb.z) > 34) return 'fail'; s.n = s.n || 0; if (s.h > (s.n + 1) * 4.2) { s.n++; toast(rpick(RBLINE), 4); } return s.h > 18; }, { failMsg: 'You abandoned your post.' }),
      say([['Constable', 'Sir! That kombi just ran the roadblock!']]),
      chase({ type: 'kombi', label: 'Stop the kombi that ran the roadblock', speed: 15.5, hp: 170 }),
    ] };
  }
  if (kind === 'army') {
    const R = W.roadblocks, legs = Math.random() < .5 ? [[PL.mbare.stop, 'Deliver the water bowser load to Mbare Musika']] : R.slice(0, 3).map(r => [r, 'Deliver rations: ' + r.name + ' checkpoint']);
    const steps = [waitFor('Get in an army truck  [F]', inType('army'))]; let prev = W.marks.army;
    for (const [pt, lbl] of legs) { steps.push(goTo({ x: pt.x, z: pt.z, label: lbl, veh: ['army'], stop: true, r: 14, time: man(pt, prev) / 8 + 70 })); prev = pt; }
    steps.push(say([['Sergeant', 'Supplies delivered. The people of Harare thank you, soldier. Dismissed.']]));
    return { title: 'Army supply run', reward: legs.length > 1 ? 95 : 70, steps };
  }
  const tw = W.marks.council, pots = W.potholes.map((p, i) => ({ p, i })).filter(o => o.p.on).sort((a, b) => dist(a.p.x, a.p.z, tw.x, tw.z) - dist(b.p.x, b.p.z, tw.x, tw.z)).slice(0, 4);
  const steps = [waitFor('Get in the City Council truck  [F]', inType('council'))];
  for (const o of pots) { steps.push(goTo({ x: o.p.x, z: o.p.z, label: 'Drive to the pothole', veh: ['council'], stop: true, r: 7 })); steps.push(waitFor('Patching pothole…', (dt, s) => { s.pt = (s.pt || 0) + dt; if (s.pt > 2.2) { s.pt = 0; W.patch(o.i); toast('Pothole patched. One down, a few thousand to go.'); return true; } })); }
  return { title: 'Pothole patrol', reward: 40, steps };
}

// ------------------------------------------------------------------ vending
function stopVend(msg) { if (!G.vend.active) return; G.vend.active = false; if (msg) toast(msg); }
function startRaid(spot) {
  if (G.vend.raid) return; const n = nodesNear(spot.x, spot.z, 230).filter(a => a.nb.length && dist(a.x, a.z, spot.x, spot.z) > 110); if (!n.length) return; const a = rpick(n), ps = lanePose(a.i, a.nb[0], 6);
  const v = spawnVeh('council', ps.x, ps.z, ps.h); v.keep = true; v.ai = { mode: 'goto', tx: spot.x, tz: spot.z }; G.vend.raid = v; G.vend.raidSpot = spot; G.vend.raidWait = 0;
  toast('KANZURU! Municipal police are coming — pack up [E] and move!', 6); sfxWhistle(); G.chaos = 2;
}
function updateVend(dt) {
  const vd = G.vend, p = G.player;
  if (vd.active) {
    if (p.veh || dist(p.x, p.z, vd.spot.x, vd.spot.z) > 3.6) stopVend();
    else if (p.stock <= 0) stopVend('Sold out! Restock at Mbare Musika.');
    else {
      vd.saleT -= dt; if (vd.saleT <= 0) { vd.saleT = rrand(1.8, 4); const pr = 2 + rint(3); p.stock--; vd.sold++; earn(pr); toast(rpick(['"Madomasi marii?" — sold', '"Ndipewo two." — sold', 'Office worker buys a crate', '"Makadii, vendor?" — sold']) + `  +$${pr}`, 2); }
      if (!vd.raid && !G.noRaid) { vd.raidT -= dt; if (vd.raidT <= 0) { startRaid(vd.spot); vd.raidT = rrand(35, 70); } }
    }
  }
  const v = vd.raid; if (!v) return;
  const d = dist(v.x, v.z, vd.raidSpot.x, vd.raidSpot.z);
  if (d < 17 || v.dead) {
    v.ai = { mode: 'wait' };
    if (vd.active && d < 17) { const fine = Math.min(p.money, 10); p.stock = 0; earn(-fine); vd.busted = true; stopVend(); toast(`Council officers confiscated ALL your stock and fined you $${fine}.`, 6); }
    vd.raidWait += dt; if (vd.raidWait > 7) { vd.raid = null; if (!v.dead) toLane(v); else v.keep = false; }
  }
}

// ------------------------------------------------------------------ wanted / police
function addWanted(n, why) {
  const p = G.player; if (p.wanted >= 5) return; if (G.wantCd > 0 && p.wanted > 0 && n === 1) return;
  p.wanted = Math.min(5, p.wanted + n); G.evadeT = 0; G.wantCd = 3; if (why) toast('★ ' + why, 4);
}
function spawnPursuer() {
  const p = pp(), c = nodesNear(p.x, p.z, 250).filter(a => a.nb.length && dist(a.x, a.z, p.x, p.z) > 140); if (!c.length) return;
  const a = rpick(c), ps = lanePose(a.i, a.nb[0], 6), v = spawnVeh('police', ps.x, ps.z, ps.h); v.ai = { mode: 'pursue' }; v.keep = true; v.speed = 8;
}
function updatePolice(dt) {
  const p = G.player, pos = pp(); G.wantCd -= dt;
  const pur = G.vehicles.filter(v => v.ai && v.ai.mode === 'pursue');
  if (p.wanted <= 0) { if (pur.length) for (const v of pur) toLane(v); G.bustT = 0; return; }
  G.copT -= dt;
  if (pur.length < Math.min(4, p.wanted) && G.copT <= 0) {
    G.copT = 5; const cop = G.vehicles.find(v => v.type === 'police' && v.ai && v.ai.mode === 'lane' && dist(v.x, v.z, pos.x, pos.z) < 160);
    if (cop) { cop.ai = { mode: 'pursue' }; cop.keep = true; } else spawnPursuer();
  }
  let near = 1e9; for (const v of pur) { const d = dist(v.x, v.z, pos.x, pos.z); if (d < near) near = d; if (d > 280 && !v.dead) { v.remove(); } }
  if (near < 60) G.engaged = true;
  if (near > 75) { G.evadeT += dt; if (G.evadeT > (G.engaged ? 6 + p.wanted * 1.5 : 24)) { p.wanted--; G.evadeT = 0; if (p.wanted === 0) { G.engaged = false; toast('You lost them. Lie low.'); } } } else G.evadeT = 0;
  if (near < (p.veh ? 7.5 : 5) && G.pspeed() < 2.5) { G.bustT += dt; if (G.bustT > 2) busted(); } else G.bustT = Math.max(0, G.bustT - dt * .5);
}
function flash(col, ms = 900) { const f = $('fade'); f.style.background = col; f.style.opacity = 1; setTimeout(() => f.style.opacity = 0, ms); }
function busted() {
  const p = G.player, fine = Math.min(p.money, 10 + p.wanted * 10);
  if (G.script) endScript(false, 'You were arrested.');
  exitVeh(true); earn(-fine); p.wanted = 0; G.bustT = 0; p.stock = 0; p.x = W.marks.zrp.x + 2; p.z = W.marks.zrp.z + 1; p.h = Math.PI; G.camH = p.h;
  flash('#0b2a6b'); banner('BUSTED', `ZRP Harare Central — fine paid: $${fine}`, '#6aa5ff');
  for (const v of G.vehicles) if (v.ai && v.ai.mode === 'pursue') toLane(v);
}
function wasted() {
  const p = G.player, fee = Math.min(p.money, 20);
  if (G.script) endScript(false, 'You ended up in hospital.');
  exitVeh(true); earn(-fee); p.hp = 100; p.wanted = 0; p.x = W.marks.ems.x + 2; p.z = W.marks.ems.z + 1; p.h = 0; G.camH = 0;
  flash('#5a0b0b'); banner('WASTED', `West End Hospital — bill: $${fee}`, '#ff5a4f');
  for (const v of G.vehicles) if (v.ai && v.ai.mode === 'pursue') toLane(v);
}
function updateRoadblocks(dt) {
  const p = G.player, v = p.veh; if (!v) { G.rb = null; return; }
  for (const rb of W.roadblocks) {
    const d = dist(v.x, v.z, rb.x, rb.z);
    if (d < 15) {
      if (G.rb !== rb) {
        G.rb = rb; rb.t = 0; rb.checked = v.type === 'police' || v.type === 'army' || v.type === 'ambulance' || !!G.duty;
        toast(rb.checked ? 'The officers salute and wave you through.' : 'ZRP ROADBLOCK — stop for inspection (or run it...)', 4);
      }
      if (!rb.checked && Math.abs(v.speed) < 1.5) {
        rb.t += dt;
        if (rb.t > 1) {
          rb.checked = true;
          if (p.wanted > 0) { busted(); return; }
          const pirate = v.type === 'fit' || v.type === 'kombi', r = Math.random();
          if (r < (pirate ? .5 : .25) && p.money >= 3) { const f = pirate ? 5 : 3; earn(-f); toast(pirate ? `Officer: "Route permit? Fire extinguisher? ...Spot fine, $${f}."` : `Officer: "No reflective triangles. Spot fine, $${f}."`, 5); }
          else toast('Officer: "Licence... all in order. Fambai zvakanaka."', 4);
        }
      }
    } else if (G.rb === rb) { G.rb = null; if (!rb.checked) addWanted(1, 'You ran a ZRP roadblock!'); }
  }
}

// ------------------------------------------------------------------ traffic
const MIX = [['kombi', 29], ['fit', 15], ['sedan', 19], ['pickup', 10], ['taxi', 8], ['ehail', 7], ['bus', 4], ['police', 4], ['council', 2], ['ambulance', 2]];
function pickType() { let r = Math.random() * 100; for (const [t, w] of MIX) { if ((r -= w) < 0) return t; } return 'sedan'; }
function spawnTraffic(minD, maxD) {
  const p = pp(), c = nodesNear(p.x, p.z, maxD); if (!c.length) return;
  for (let t = 0; t < 12; t++) {
    const a = rpick(c); if (!a.nb.length) continue; const d = dist(a.x, a.z, p.x, p.z); if (d < minD || d > maxD) continue;
    const b = rpick(a.nb), e = edge(a.i, b); if (e.cls > 4 || e.len < 12) continue; const side = Math.random() < .5 ? 1 : -1, ps = lanePose(a.i, b, rrand(3, e.len * .6), side);
    if (dist(ps.x, ps.z, p.x, p.z) < minD || G.vehicles.some(v => Math.abs(v.x - ps.x) < 13 && Math.abs(v.z - ps.z) < 13)) continue;
    const v = spawnVeh(pickType(), ps.x, ps.z, ps.h); v.ai = { mode: 'lane', a: a.i, b, side, cruise: v.type === 'kombi' ? rrand(12, 15) : v.type === 'bus' ? 9 : rrand(9, 13), stopT: rrand(8, 40) }; v.speed = 7; return;
  }
}
function ensureFleet(force) {
  const p = pp();
  W.fleet.forEach(([type, x, z, h], i) => {
    let v = G.fleet[i]; const ok = v && !v.dead && G.vehicles.includes(v) && dist(v.x, v.z, x, z) < 25;
    if (ok) return; if (v === G.player.veh && v && !v.dead) return;
    if (!force && dist(p.x, p.z, x, z) < 170) return;
    if (v) v.keep = false;
    if (G.vehicles.some(o => dist(o.x, o.z, x, z) < 5)) return;
    v = G.fleet[i] = spawnVeh(type, x, z, h); v.keep = true;
  });
}
function manageTraffic(dt) {
  G.trafT -= dt; if (G.trafT > 0) return; G.trafT = .35;
  const p = pp(); let n = 0;
  for (let i = G.vehicles.length - 1; i >= 0; i--) {
    const v = G.vehicles[i]; if (v === G.player.veh) continue; const d = dist(v.x, v.z, p.x, p.z);
    if (v.ai && v.ai.mode === 'lane' && !v.ai.flee) { n++; if (v.ai.dead || d > 330 || (v.ai.jam > 14 && d > 60) || v.ai.jam > 40) { v.remove(); n--; } }
    else if (!v.keep && !v.ai && d > (v.dead ? 120 : 230)) v.remove();
  }
  if (n < G.Q.traffic) spawnTraffic(G.pspeed() > 12 ? 150 : 115, 280);
  G.fleetT -= dt; if (G.fleetT < 0) { G.fleetT = 6; ensureFleet(false); }
}

// ------------------------------------------------------------------ interaction
function nearMark() { const p = pp(); for (const m of G.marks) if (dist(p.x, p.z, m.x, m.z) < m.r + 1.2) return m; return null; }
function updateInteract() {
  const p = G.player, v = p.veh; let pr = null;
  if (act('F')) { if (v) exitVeh(); else tryEnter(); }
  if (act('H')) { sfxHorn(); if (v) for (const q of G.peds) if (q.on && q.state === 'walk' && q.d < 18) { q.state = 'flee'; q.t = 2.5; q.h = Math.atan2(q.x - v.x, q.z - v.z); } }
  if (act('R')) { radioNext(); G.radioTouched = true; toast('📻 ' + radioName(), 3.5); }
  const e = act('E'), jk = act('J');
  // story trigger
  if (!G.script && STORY[G.story] && dist(pp().x, pp().z, G.storyMark.x, G.storyMark.z) < 4 && G.pspeed() < 4 && p.wanted === 0 && !(G.storyCd > 0)) { startStory(); return; }
  const m = nearMark();
  if (G.vend.active) { pr = `Selling… stock: ${p.stock}   [E] Pack up`; if (e) stopVend('Packed up.'); }
  else if (m && m.kind === 'buy') {
    pr = p.stock >= 30 ? 'You cannot carry more than 30 crates' : `[E] Buy 10 crates of produce — $10   (you have ${p.stock})`;
    if (e && p.stock < 30) { if (p.money < 10) toast('Mai Chipo: "No money, no tomatoes." (need $10)'); else { earn(-10); p.stock += 10; toast('Bought 10 crates. Sell them at an orange vending spot in town.', 4.5); } }
  } else if (m && m.kind === 'vend') {
    if (v) pr = 'Get out to set up your stall [F]'; else if (p.stock <= 0) pr = 'No stock — buy crates at Mbare Musika first';
    else { pr = `[E] Set up stall (${p.stock} crates)`; if (e) { G.vend.active = true; G.vend.spot = m.spot; G.vend.saleT = 1.5; G.vend.raidT = rrand(22, 50); toast('Stall open! Watch out for kanzuru…'); } }
  } else if (m && !G.script && (m.kind === 'zrp' || m.kind === 'army' || m.kind === 'council' || m.kind === 'ems')) {
    if (p.wanted > 0) pr = 'Not while you are wanted!';
    else { pr = `[E] Report for duty — ${{ zrp: 'Zimbabwe Republic Police', army: 'Zimbabwe National Army', council: 'Harare City Council', ems: 'Ambulance service' }[m.kind]}`; if (e) startScript(dutyJob(m.kind === 'zrp' ? 'police' : m.kind)); }
  } else if (v) {
    if (v.dead) pr = 'Engine dead — [F] get out';
    else if (!G.script && v.t.job) { pr = `[J] ${v.t.job}`; if (jk) startScript(jobFor(v.type)); }
  } else {
    let best = null, bd = 2.6; for (const o of G.vehicles) { const d = dist(o.x, o.z, p.x, p.z) - o.t.L / 2; if (d < bd) { bd = d; best = o; } }
    if (best) pr = `[F] ${best.ai ? 'Hijack' : 'Enter'} ${best.t.name}`;
  }
  if (jk && G.script && v && v.t.job && !pr) toast('Finish (or abandon in the pause menu) your current mission first.');
  prompt(pr);
}

// ------------------------------------------------------------------ camera, HUD, minimap
function updateCamera(dt) {
  const p = G.player, v = p.veh, o = pp(), cam = G.camera;
  const th = v ? (v.speed < -2 ? v.h + Math.PI : v.h) : p.h;
  G.camH += angDiff(G.camH, th) * Math.min(1, dt * (v ? 3.2 : 3));
  let d = v ? 6.5 + v.t.L * .7 + Math.abs(v.speed) * .09 : 4.3; const hgt = v ? 3 + v.t.H * .55 : 2.6;
  const sx = Math.sin(G.camH), cz = Math.cos(G.camH);
  for (let k = 0; k < 4 && inside(o.x - sx * d, o.z - cz * d); k++) d *= .62;
  G.shake = Math.max(0, G.shake - dt * 2.5); const sh = G.shake * .35;
  cam.position.set(o.x - sx * d + (Math.random() - .5) * sh, hgt + (Math.random() - .5) * sh, o.z - cz * d + (Math.random() - .5) * sh);
  cam.lookAt(o.x + sx * 4, v ? 1.5 : 1.5, o.z + cz * 4);
  const fov = 62 + (v ? clamp(Math.abs(v.speed) * .45, 0, 14) : 0); if (Math.abs(cam.fov - fov) > .3) { cam.fov = lerp(cam.fov, fov, .1); cam.updateProjectionMatrix(); }
}
function computeRoute() {
  const t = G.target, p = pp(); if (!t) { G.route = null; return; }
  const n = W.nodes; let a0 = nearestNode(p.x, p.z);
  if (G.player.veh) { const v = G.player.veh, e = edgeNear(v.x, v.z, 5, 70); if (e && e.d < e.w / 2 + 6) a0 = (e.dx * Math.sin(v.h) + e.dz * Math.cos(v.h)) >= 0 ? e.b : e.a; }   // start from the node ahead of us on the road we are on
  const r = route(a0, nearestNode(t.x, t.z), true); if (!r) { G.route = [p, t]; return; } const pts = r.map(i => n[i]);
  if (pts.length > 1 && dist(p.x, p.z, pts[0].x, pts[0].z) + dist(p.x, p.z, pts[1].x, pts[1].z) < dist(pts[0].x, pts[0].z, pts[1].x, pts[1].z) + 4) pts.shift();
  if (pts.length > 1) { const l = pts[pts.length - 1], q = pts[pts.length - 2]; if (dist(t.x, t.z, l.x, l.z) + dist(t.x, t.z, q.x, q.z) < dist(l.x, l.z, q.x, q.z) + 4) pts.pop(); }
  G.route = [p, ...pts, t];
}
function drawMap(cv, span, cx, cz, big) {
  const x = cv.getContext('2d'), Sw = cv.width, Sh = cv.height, k = Math.min(Sw, Sh) / span, p = pp();
  const X = wx => (wx - cx) * k + Sw / 2, Z = wz => (wz - cz) * k + Sh / 2, hw = Sw / 2 / k + 40, hh = Sh / 2 / k + 40;
  x.fillStyle = '#2f3b31'; x.fillRect(0, 0, Sw, Sh);
  x.fillStyle = '#5f6862';
  for (const b of W.blds) { if (b.x1 < cx - hw || b.x0 > cx + hw || b.z1 < cz - hh || b.z0 > cz + hh) continue; const q = b.p; x.beginPath(); x.moveTo(X(q[0]), Z(q[1])); for (let i = 2; i < q.length; i += 2) x.lineTo(X(q[i]), Z(q[i + 1])); x.fill(); }
  let segs = W.segs; if (!big) { segs = []; for (const n of nodesNear(cx, cz, span * .75)) for (const j of n.pb) if (j > n.i) { const m = W.nodes[j]; segs.push([n.x, n.z, m.x, m.z, edge(n.i, j)]); } }
  x.lineCap = 'round';
  for (const pass of [0, 1]) { x.strokeStyle = pass ? '#ddd8c9' : '#8f948b'; for (const s of segs) { const e = s[4]; if ((e.cls <= 5) !== !!pass) continue; if (e.cls >= 7) x.strokeStyle = '#b9a88f'; x.lineWidth = Math.max(big ? .8 : 1.5, e.w * k); x.beginPath(); x.moveTo(X(s[0]), Z(s[1])); x.lineTo(X(s[2]), Z(s[3])); x.stroke(); if (e.cls >= 7) x.strokeStyle = '#8f948b'; } }
  if (big) { const seen = new Set(); x.font = 'bold 10px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 3;
    for (const s of segs) { const e = s[4]; if (e.cls > 3 || !e.name || e.len < 50) continue; const mx = (s[0] + s[2]) / 2, mz = (s[1] + s[3]) / 2, ky = e.name + (mx / 520 | 0) + ':' + (mz / 520 | 0); if (seen.has(ky)) continue; seen.add(ky);
      let a = Math.atan2(s[3] - s[1], s[2] - s[0]); if (a > Math.PI / 2) a -= Math.PI; if (a < -Math.PI / 2) a += Math.PI; x.save(); x.translate(X(mx), Z(mz)); x.rotate(a); x.strokeStyle = '#1c231d'; x.strokeText(e.name, 0, 0); x.fillStyle = '#f4f0e2'; x.fillText(e.name, 0, 0); x.restore(); } }
  if (G.route) { x.strokeStyle = '#ffe45c'; x.lineWidth = big ? 4 : 3; x.lineJoin = 'round'; x.beginPath(); G.route.forEach((q, i) => i ? x.lineTo(X(q.x), Z(q.z)) : x.moveTo(X(q.x), Z(q.z))); x.stroke(); }
  const dot = (wx, wz, col, r, txt) => { let px = X(wx), pz = Z(wz); if (!big) { px = clamp(px, 6, Sw - 6); pz = clamp(pz, 6, Sh - 6); } x.fillStyle = col; x.beginPath(); x.arc(px, pz, r, 0, 6.3); x.fill(); x.strokeStyle = '#000'; x.lineWidth = 1; x.stroke(); if (txt) { x.fillStyle = '#000'; x.font = `bold ${r * 1.4}px Arial`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, px, pz + .5); } };
  if (big) {
    for (const m of G.marks) dot(m.x, m.z, { buy: '#35d07f', vend: '#ff8a1f', zrp: '#3d7bff', army: '#7d9a3a', council: '#18b6c9', ems: '#ff5a6e' }[m.kind], 8, { buy: '$', vend: 'V', zrp: 'P', army: 'A', council: 'C', ems: '+' }[m.kind]);
    for (const rb of W.roadblocks) dot(rb.x, rb.z, '#ff4f4f', 6, '!'); for (const c of W.cams) dot(c.x, c.z, '#f2c300', 4);
    x.font = 'bold 12px Arial'; x.textAlign = 'center'; x.fillStyle = '#fff'; x.strokeStyle = '#000'; x.lineWidth = 3;
    x.strokeStyle = '#000'; for (const key in PL) { const q = PL[key]; x.strokeText(q.name, X(q.x), Z(q.z) - 9); x.fillStyle = '#ffe9a8'; x.fillText(q.name, X(q.x), Z(q.z) - 9); }
  } else {
    for (const m of G.marks) if (Math.abs(m.x - cx) < span / 2 && Math.abs(m.z - cz) < span / 2) dot(m.x, m.z, { buy: '#35d07f', vend: '#ff8a1f', zrp: '#3d7bff', army: '#7d9a3a', council: '#18b6c9', ems: '#ff5a6e' }[m.kind], 4);
    for (const rb of W.roadblocks) if (Math.abs(rb.x - cx) < span / 2 && Math.abs(rb.z - cz) < span / 2) dot(rb.x, rb.z, '#ff4f4f', 4, '!');
  }
  if (!G.script && STORY[G.story]) dot(G.storyMark.x, G.storyMark.z, '#ffd23f', big ? 10 : 7, 'S');
  if (G.target) dot(G.target.x, G.target.z, '#ffe45c', big ? 9 : 6);
  for (const v of G.vehicles) if (v.ai && v.ai.mode === 'pursue') dot(v.x, v.z, (G.time * 4 | 0) % 2 ? '#ff3030' : '#3060ff', big ? 6 : 4);
  x.save(); x.translate(X(p.x), Z(p.z)); x.rotate(Math.PI - p.h); x.fillStyle = '#fff'; x.strokeStyle = '#000'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(0, -8); x.lineTo(6, 7); x.lineTo(0, 3); x.lineTo(-6, 7); x.closePath(); x.fill(); x.stroke(); x.restore();
}
function updateHUD(dt) {
  const p = G.player, v = p.veh;
  if (G.hudMoney !== p.money) { G.hudMoney = p.money; $('money').textContent = '$' + p.money; }
  if (G.cashFx > 0) { G.cashFx -= dt * 1.5; $('money').style.transform = `scale(${1 + Math.max(0, G.cashFx) * .25})`; }
  if (G.hudW !== p.wanted) { G.hudW = p.wanted; $('stars').textContent = '★'.repeat(p.wanted) + '☆'.repeat(5 - p.wanted); $('stars').className = p.wanted ? 'on' : ''; }
  $('hp').style.width = clamp(p.hp, 0, 100) + '%';
  const vi = v ? `${v.t.name} · ${Math.round(Math.abs(v.speed) * 3.6)} km/h · ${Math.round(v.hp / v.maxHp * 100)}%` : 'On foot';
  if (G.hudV !== vi) { G.hudV = vi; $('vinfo').textContent = vi; }
  const st = p.stock ? `🍅 Stock: ${p.stock} crates` : ''; if (G.hudS !== st) { G.hudS = st; $('stock').textContent = st; }
  G.hudT -= dt; if (G.hudT <= 0) {
    G.hudT = .25; const o = pp(), r = roadAt(o.x, o.z), s = (r ? r + ' · ' : '') + district(o.x, o.z);
    if (G.hudR !== s) { G.hudR = s; $('street').textContent = s; }
    const h = Math.floor(G.clock / 60) % 24, mi = Math.floor(G.clock % 60); $('clock').textContent = String(h).padStart(2, '0') + ':' + String(mi).padStart(2, '0');
    G.routeT -= .25; if (G.routeT <= 0) { G.routeT = 1; computeRoute(); }
  }
  if ((G.frame & 3) === 0) { const o = pp(); drawMap(G.mini, 300, o.x, o.z, false); }
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('toast').style.opacity = 0; }
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $('banner').classList.add('hide'); }
  $('hurt').style.opacity = G.hurtFx = Math.max(0, (G.hurtFx || 0) - dt * 1.5);
}
function toggleMap() {
  G.mapOpen = !G.mapOpen; const c = $('bigmap'); c.classList.toggle('hide', !G.mapOpen);
  if (G.mapOpen) { c.width = innerWidth; c.height = innerHeight; computeRoute(); drawMap(c, 5350, -560, 760, true); const x = c.getContext('2d'); x.fillStyle = 'rgba(0,0,0,.65)'; x.fillRect(0, 0, c.width, 26); x.fillRect(0, c.height - 22, c.width, 22); x.fillStyle = '#fff'; x.font = 'bold 13px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('HARARE — S story · $ buy stock · V vending · P police · A army · C council · + ambulance · ! roadblock · yellow dots: speed cameras     [M] / tap to close', c.width / 2, 13); x.font = '11px Arial'; x.fillText('Map data © OpenStreetMap contributors (ODbL)', c.width / 2, c.height - 11); }
}
function setPaused(b) { G.paused = b; $('pause').classList.toggle('hide', !b); $('abandon').style.display = G.script ? '' : 'none'; }

// ------------------------------------------------------------------ world ambience
function updateWorld(dt) {
  G.clock = (G.clock + dt) % 1440; G.chaos = Math.max(0, G.chaos - dt); G.storyCd = (G.storyCd || 0) - dt;
  // day/night: sun path, sky gradient, lit windows and street lamps
  const h = G.clock / 60, day = clamp(h < 12 ? (h - 5.2) / 1.6 : (18.8 - h) / 1.6, 0, 1), night = 1 - day, o0 = pp();
  const ang = (h - 6) / 12 * Math.PI, el = Math.max(.14, Math.sin(ang)); G.sunDir.set(Math.cos(ang) * .85, el, .38).normalize();
  G.sun.position.set(o0.x + G.sunDir.x * 170, G.sunDir.y * 170, o0.z + G.sunDir.z * 170); G.sun.target.position.set(o0.x, 0, o0.z);
  const warm = clamp(1 - el * 1.5, 0, 1) * day;
  G.sun.intensity = .1 + 2.7 * day; G.sun.color.setRGB(1, .95 - warm * .25 - night * .15, .86 - warm * .45 + night * .1); G.hemi.intensity = .5 + 1.2 * day;
  G.skyU.top.value.copy(G.cNightT).lerp(G.cDayT, day); G.sky.copy(G.cNightH).lerp(G.cDayH, day).lerp(G.cDusk, warm * .75); G.skyU.bot.value.copy(G.sky);
  G.scene.background.copy(G.sky); G.scene.fog.color.copy(G.sky);
  const R = G.Q.far * .9, cp = G.camera.position; G.skyM.position.copy(cp); G.skyM.scale.setScalar(R);
  G.sunS.position.set(cp.x + G.sunDir.x * R * .9, cp.y + G.sunDir.y * R * .9, cp.z + G.sunDir.z * R * .9); G.sunS.scale.setScalar(R * .16); G.sunS.material.opacity = day;
  for (const c of G.clouds) { c.userData.a += dt * .004; const a = c.userData.a, e = c.userData.e; c.position.set(cp.x + Math.cos(a) * Math.cos(e) * R * .86, cp.y + Math.sin(e) * R * .86, cp.z + Math.sin(a) * Math.cos(e) * R * .86); c.material.opacity = .25 + .6 * day; }
  if (Math.abs(night - G.nightV) > .02) { G.nightV = night; for (const m of W.lit) m.emissiveIntensity = night * .8; W.lampMat.emissiveIntensity = night * 2.2; W.poolMat.opacity = night * .2; G.renderer.toneMappingExposure = 1.02 + night * .25; }
  G.sigT -= dt; if (G.sigT <= 0) { G.sigT = .2; updateSignals(); }
  // ambulance responds to people knocked down
  G.emsCd -= dt;
  if (G.downPed && !G.ems && G.emsCd <= 0) { const d = G.downPed, c = nodesNear(d.x, d.z, 260).filter(a => a.nb.length && dist(a.x, a.z, d.x, d.z) > 120); if (c.length) { const a = rpick(c), ps = lanePose(a.i, a.nb[0], 5), v = spawnVeh('ambulance', ps.x, ps.z, ps.h); v.keep = true; v.ai = { mode: 'goto', tx: d.x, tz: d.z, cap: 19 }; G.ems = { v, t: 0, w: 0, x: d.x, z: d.z }; G.emsCd = 50; toast('Bystander: "Fonerai ambulance!" — an ambulance is on its way.', 4); } }
  G.downPed = null;
  if (G.ems) { const e = G.ems; e.t += dt; if (dist(e.v.x, e.v.z, e.x, e.z) < 16 || e.t > 45 || e.v.dead || !e.v.ai) { e.w += dt; if (e.v.ai) e.v.ai = { mode: 'wait' }; if (e.w > 6 || e.v.dead || !e.v.ai) { if (!e.v.dead && e.v.ai) toLane(e.v); else e.v.keep = false; G.ems = null; } } }
  // LOD for prop chunks + labels
  G.lodT -= dt; if (G.lodT <= 0) {
    G.lodT = .3; const o = pp();
    for (const m of W.propMeshes) m.visible = dist(m.userData.cx, m.userData.cz, o.x, o.z) < G.Q.prop + 290;
    for (const s of W.labels) { const d = dist(s.position.x, s.position.z, o.x, o.z); s.visible = d < 330 && d > 70; }
    for (const m of G.marks) m.g.visible = dist(m.x, m.z, o.x, o.z) < 260;
  }
  for (const m of G.marks) if (m.g.visible) m.cyl.rotation.y += dt;
  G.storyMark.cyl.rotation.y += dt; G.storyMark.g.position.y = Math.sin(G.time * 2) * .12;
  // ambient street shouts — hwindi comedy for the community
  G.ambT -= dt; if (G.ambT <= 0 && !G.script && toastT <= 0) {
    G.ambT = rrand(12, 26);
    const o = pp(), lines = ambientFor(district(o.x, o.z));
    if (G.pspeed() < 10) {
      if (lines) {
        const msg = rpick(lines);
        toast(msg, 3.4);
        if (/Hwindi|Tout|Town|Chitungwiza|Mabvuku|Mbare|Copacabana|Vabereki|NOP/i.test(msg)) {
          const h = pickHwindi(true);
          speakPhrase(h.text, { shout: true });
        }
      } else if (Math.random() < .45) {
        const h = pickHwindi(true);
        speakPhrase(h.text, { shout: true });
        toast(`Hwindi: "${h.text}"`, 3.2);
      }
    }
  }
  // potholes
  const v = G.player.veh; if (v && Math.abs(v.speed) > 7) { G.potCd -= dt; if (G.potCd <= 0) for (const ph of W.potholes) if (ph.on && Math.abs(ph.x - v.x) < 2 && Math.abs(ph.z - v.z) < 2 && dist(ph.x, ph.z, v.x, v.z) < ph.r + 1) { v.speed *= .78; v.damage(4); G.shake = .9; G.potCd = 1.2; sfxCrash(.2); if (Math.random() < .5) toast(rpick(['Pothole! There goes the suspension.', 'BHAM! Classic Harare pothole.', 'Pothole — the council "is aware".']), 2.5); break; } }
  // smoke from a dying car
  if (v && v.hp < v.maxHp * .4) { G.smT -= dt; if (G.smT <= 0) { G.smT = .12; const s = G.smoke[G.smI++ % G.smoke.length]; s.position.set(v.x + Math.sin(v.h) * v.t.L * .4, 1.2, v.z + Math.cos(v.h) * v.t.L * .4); s.userData.t = 1; s.visible = true; } }
  for (const s of G.smoke) if (s.visible) { s.userData.t -= dt * .8; s.position.y += dt * 2.2; const k = 1 - s.userData.t; s.scale.setScalar(.8 + k * 2.6); s.material.opacity = Math.max(0, s.userData.t) * .5; if (s.userData.t <= 0) s.visible = false; }
}

// ------------------------------------------------------------------ main loop
function updateLaw(dt) {
  const p = G.player, v = p.veh, sg = $('sig'); if (!v) { if (G.sigHud !== 'x') { G.sigHud = 'x'; sg.style.display = 'none'; } return; }
  const exempt = !!G.duty || v.type === 'police' || v.type === 'ambulance' || v.type === 'army';
  for (const c of W.cams) { if (c.cd > 0) { c.cd -= dt; continue; } if (Math.abs(c.x - v.x) < 13 && Math.abs(c.z - v.z) < 13) { const k = Math.abs(v.speed) * 3.6; if (k > c.limit + 8) { c.cd = 10; flash('rgba(255,255,255,.9)', 120);
    if (exempt) toast('📸 Speed camera flashed — emergency vehicle, no fine.', 3); else { const fine = k > 100 ? 20 : 10; if (p.money >= fine) { earn(-fine); toast(`📸 Speed camera on ${c.name}: ${k | 0} km/h in a 60 zone. Fine $${fine}.`, 5); } else if (k > 100) addWanted(1, `Speed camera on ${c.name}: ${k | 0} km/h and no money for the fine — ZRP alerted!`); else toast(`📸 Speed camera on ${c.name}: ${k | 0} km/h. You are broke — warning letter sent to Sekuru.`, 5); } } } }
  G.lawT -= dt; if (G.lawT > 0) return; G.lawT = .1;
  const sp = Math.hypot(v.vx, v.vz), fx = sp > 1 ? v.vx / sp : Math.sin(v.h), fz = sp > 1 ? v.vz / sp : Math.cos(v.h);
  let nx = null, nd = 70; for (const n of nodesNear(v.x, v.z, 80)) { if (!n.sig) continue; const dx = n.x - v.x, dz = n.z - v.z, d = Math.hypot(dx, dz); if (d < nd && (d < n.w / 2 + 2 || (dx * fx + dz * fz) / d > .93)) { nd = d; nx = n; } }
  const st = nx ? sigState(nx, fx, fz) : 'x';
  if (G.sigHud !== st) { G.sigHud = st; sg.style.display = nx ? 'block' : 'none'; sg.style.background = st === 0 ? '#22e055' : st === 1 ? '#ffb300' : st === 2 ? '#ff2a1a' : '#777'; sg.title = ''; sg.textContent = st === -1 ? '!' : ''; }
  if (nx && nx.sig === 1 && nd < nx.w / 2 + 1.5) { if (G.lastSig !== nx.i) { G.lastSig = nx.i; if (!exempt && sp > 4.5 && st === 2) { flash('rgba(255,255,255,.9)', 120); if (p.money >= 5) { earn(-5); toast('🚦 Red-light camera: you jumped the robot. Fine $5.', 4); } else toast('🚦 Red-light camera caught you. No money for the fine — this time it is a warning.', 4); } } }
  else if (G.lastSig >= 0) { const L = W.nodes[G.lastSig]; if (dist(v.x, v.z, L.x, L.z) > L.w / 2 + 9) G.lastSig = -1; }
}
function step(dt) {
  G.time += dt; readInput();
  const p = G.player, v = p.veh;
  if (v) { v.thr = G.in.thr; v.steer = G.in.steer; v.hb = G.in.hb; }
  for (const o of G.vehicles) { if (o !== v) updateAI(o, dt); o.update(dt); }
  collideVehicles();
  if (!v) updateFoot(dt);
  updatePeds(dt); manageTraffic(dt); updatePolice(dt); updateRoadblocks(dt); updateVend(dt);
  updateInteract(); updateScript(dt); updateLaw(dt); updateWorld(dt);
  const o = pp(); for (const q of G.vehicles) q.sync(dist(q.x, q.z, o.x, o.z));
  updateCamera(dt);
}
let last = 0, fAcc = 0, fN = 0, slowN = 0;
function frame(t) {
  requestAnimationFrame(frame);
  const raw = (t - last) / 1000; last = t; const dt = Math.min(.05, raw > 0 ? raw : .016); G.frame++;
  if (G.state !== 'play') return;
  if (act('P')) setPaused(!G.paused);
  if (act('M') && !G.paused) toggleMap();
  if (G.dialog) { if (act('E') || pressed.has('Space')) advanceDialog(); }
  else if (!G.paused && !G.mapOpen) step(dt);
  pressed.clear(); tAct.clear();
  updateHUD(dt); audioUpdate(G, dt, !G.paused && !G.dialog);
  G.renderer.render(G.scene, G.camera);
  // adaptive resolution keeps 30–60 fps on weaker GPUs
  fAcc += raw; fN++;
  if (fAcc >= 1) {
    const fps = fN / fAcc; fAcc = 0; fN = 0; G.fps = fps; $('fps').textContent = Math.round(fps) + ' fps';
    if (!G.fixedRes) {
      if (fps < 42 && G.pr > .55) { G.pr = Math.max(.5, G.pr - .12); G.renderer.setPixelRatio(G.pr); }
      else if (fps > 57 && G.pr < G.prMax) { G.pr = Math.min(G.prMax, G.pr + .06); G.renderer.setPixelRatio(G.pr); }
      if (fps < 27 && G.pr <= .55) { if (++slowN > 4) { slowN = 0; G.Q.traffic = Math.max(6, G.Q.traffic - 3); G.Q.far = Math.max(260, G.Q.far - 40); G.camera.far = G.Q.far; G.camera.updateProjectionMatrix(); G.scene.fog.far = G.Q.far * .95; } } else slowN = 0;
    }
  }
}

function startGame(q, fresh) {
  const Q = G.Q = { ...QUAL[q] };
  const canvas = $('c');
  const r = G.renderer = new THREE.WebGLRenderer({ canvas, antialias: Q.aa, powerPreference: 'high-performance' });
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.02; if (Q.shadow) { r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap; }
  G.prMax = Math.min(devicePixelRatio || 1, Q.pr); G.pr = G.prMax; r.setPixelRatio(G.pr); r.setSize(innerWidth, innerHeight);
  const sc = G.scene = new THREE.Scene(); G.cDayT = new THREE.Color(0x3f86d8); G.cDayH = new THREE.Color(0xb9d9f0); G.cDusk = new THREE.Color(0xf0a868); G.cNightT = new THREE.Color(0x070b1c); G.cNightH = new THREE.Color(0x1a2445); G.sky = new THREE.Color(); G.sunDir = new THREE.Vector3(0, 1, 0);
  sc.background = new THREE.Color(0xb9d9f0); sc.fog = new THREE.Fog(0xb9d9f0, Q.far * .3, Q.far * .96);
  G.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, .8, Q.far);
  G.hemi = new THREE.HemisphereLight(0xcfe2ff, 0x9a8c6c, 1.7); sc.add(G.hemi);
  G.sun = new THREE.DirectionalLight(0xfff0d8, 2.7); sc.add(G.sun, G.sun.target);
  if (Q.shadow) { G.sun.castShadow = true; const s = G.sun.shadow, c = s.camera; s.mapSize.set(Q.shadow, Q.shadow); c.left = -115; c.right = 115; c.top = 115; c.bottom = -115; c.near = 10; c.far = 420; s.bias = -.0005; s.normalBias = .5; }
  G.skyU = { top: { value: new THREE.Color() }, bot: { value: new THREE.Color() } };
  G.skyM = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), new THREE.ShaderMaterial({ uniforms: G.skyU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 v; void main(){ v = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bot; varying vec3 v; void main(){ float h = clamp(normalize(v).y * 1.5 + 0.04, 0.0, 1.0); gl_FragColor = vec4(mix(bot, top, pow(h, 0.65)), 1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}' }));
  G.skyM.frustumCulled = false; G.skyM.renderOrder = -2; sc.add(G.skyM);
  const soft = (c0, c1) => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d'), gr = x.createRadialGradient(32, 32, 2, 32, 32, 31); gr.addColorStop(0, c0); gr.addColorStop(1, c1); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; };
  G.sunS = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft('rgba(255,250,225,1)', 'rgba(255,230,160,0)'), fog: false, depthWrite: false, depthTest: false, transparent: true, blending: THREE.AdditiveBlending })); G.sunS.renderOrder = -1; sc.add(G.sunS);
  const ct = soft('rgba(255,255,255,.95)', 'rgba(255,255,255,0)'); G.clouds = [];
  for (let i = 0; i < (Q.low ? 6 : 12); i++) { const c = new THREE.Sprite(new THREE.SpriteMaterial({ map: ct, fog: false, depthWrite: false, depthTest: false, transparent: true })); c.userData = { a: Math.random() * 6.28, e: .12 + Math.random() * .32 }; c.scale.set(Q.far * (.3 + Math.random() * .3), Q.far * (.07 + Math.random() * .05), 1); c.renderOrder = -1; sc.add(c); G.clouds.push(c); }
  Object.assign(G, { vehicles: [], peds: [], fleet: [], in: { thr: 0, steer: 0, hb: 0, run: 0 }, time: 0, frame: 0, clock: 7.5 * 60, chaos: 0, shake: 0, hits: 0, script: null, dialog: null, duty: null, target: null, route: null, chase: null, sv: null, rb: null,
    vend: { active: false, spot: null, saleT: 0, raidT: 0, raid: null, sold: 0, busted: false }, trafT: 0, fleetT: 3, copT: 0, evadeT: 0, bustT: 0, wantCd: 0, lodT: 0, hudT: 0, routeT: 0, ambT: 12, sigT: 0, lawT: 0, lastSig: -1, emsCd: 5, ems: null, downPed: null, nightV: -1, potCd: 0, smT: 0, smI: 0, camH: 0, story: 0, paused: false, mapOpen: false });
  buildWorld(sc);
  makePlayer();
  const sv = fresh ? null : load(); if (sv) { G.player.money = sv.money || 0; G.story = clamp(sv.story | 0, 0, STORY.length); }
  G.camH = G.player.h; initPeds(); initMarkers(); ensureFleet(true); for (const k in G.pm) G.pm[k].castShadow = Q.shadow > 0;
  // smoke sprites
  const scv = document.createElement('canvas'); scv.width = scv.height = 32; const sx = scv.getContext('2d'), gr = sx.createRadialGradient(16, 16, 1, 16, 16, 15); gr.addColorStop(0, 'rgba(70,70,70,1)'); gr.addColorStop(1, 'rgba(70,70,70,0)'); sx.fillStyle = gr; sx.fillRect(0, 0, 32, 32);
  const stex = new THREE.CanvasTexture(scv); G.smoke = []; for (let i = 0; i < 10; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: stex, transparent: true, depthWrite: false })); s.visible = false; sc.add(s); G.smoke.push(s); }
  for (let i = 0; i < Q.traffic; i++) spawnTraffic(35, 280);
  G.mini = $('mini');
  $('menu').classList.add('hide'); $('hud').classList.remove('hide'); if (touchDev) initTouch();
  G.state = 'play'; updateCamera(.016);
  if (G.story === 0) { banner('SUNSHINE CITY', 'Harare Hustle · starring Ngwere'); toast(touchDev ? 'Drag the left stick to walk (camera direction). Hold RUN to sprint. Yellow marker = story.' : 'WASD / arrows to move · Shift to run · walk into the yellow STORY marker to begin', 7); }
  else toast('Welcome back to Harare. Follow the yellow S on the map, or just hustle.', 5);
}
addEventListener('resize', () => { if (!G.renderer) return; G.renderer.setSize(innerWidth, innerHeight); G.camera.aspect = innerWidth / innerHeight; G.camera.updateProjectionMatrix(); });

// ------------------------------------------------------------------ menu wiring
function boot() {
  G.state = 'menu';
  const sv = load(); if (sv && (sv.story > 0 || sv.money > 15)) { $('cont').classList.remove('hide'); $('cont').textContent = `Continue  (Story ${Math.min(sv.story + 1, STORY.length)}/${STORY.length} · $${sv.money})`; }
  const auto = touchDev ? ((navigator.hardwareConcurrency || 4) >= 8 ? 'med' : 'low') : 'high'; $('q').value = auto;
  const go = fresh => { audioInit(); audioUnlock(); startGame($('q').value, fresh); };
  $('play').onclick = () => go(true); $('cont').onclick = () => go(false);
  $('dialog').addEventListener('pointerdown', e => { e.preventDefault(); advanceDialog(); });
  $('bigmap').addEventListener('pointerdown', () => toggleMap());
  $('resume').onclick = () => setPaused(false);
  $('abandon').onclick = () => { if (G.script) endScript(false, 'Abandoned.'); setPaused(false); };
  $('pq').onchange = e => { const q = QUAL[e.target.value]; Object.assign(G.Q, { traffic: q.traffic, far: q.far, lod: q.lod, prop: q.prop }); G.scene.fog.near = q.far * .3; G.prMax = Math.min(devicePixelRatio || 1, q.pr); G.pr = G.prMax; G.renderer.setPixelRatio(G.pr); G.camera.far = q.far; G.camera.updateProjectionMatrix(); G.scene.fog.near = q.far * .35; G.scene.fog.far = q.far * .95; };
  $('pbtn').addEventListener('pointerdown', () => setPaused(!G.paused));
  requestAnimationFrame(frame);
  window.__G = G; window.__dbg = { collide, inside, computeRoute, pave, updateHUD, nodesNear, route, nearestNode, edge, startScript, STORY, endScript, addWanted, earn, jobFor, dutyJob, W, PL, step, tryEnter, exitVeh, startStory };
}
boot();
