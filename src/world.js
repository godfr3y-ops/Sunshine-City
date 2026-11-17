import { THREE, G, GB, rnd, rr, pick, clamp, lerp, textSprite, canvasTex } from './util.js';
import { vehGeo } from './models.js';
import { CITY } from './citydata.js';

// World built from real OpenStreetMap geometry of central Harare (metres; x east, z south; origin Africa Unity Square).
export const BOUNDS = { x0: -2515, x1: 1392, z0: -1818, z1: 3340 };
export const PL = {};
export const W = { nodes: [], E: new Map(), segs: [], blds: [], labels: [], propMeshes: [], trees: [], potholes: [], roadblocks: [], vend: [], sigs: [], cams: [], marks: {}, fleet: [], lit: [] };
const dec = a => { const p = [a[0] / 10, a[1] / 10]; let x = a[0], z = a[1]; for (let i = 2; i < a.length; i += 2) { x += a[i]; z += a[i + 1]; p.push(x / 10, z / 10); } return p; };

// ---------------- collision: prop boxes + one-way building walls ----------------
const CELL = 32, boxG = new Map(), segG = new Map(), bG = new Map(), nG = new Map(), NC = 100;
const key = (cx, cz) => (cx + 512) * 2048 + (cz + 512);
const put = (g, k, v) => { let a = g.get(k); if (!a) g.set(k, a = []); a.push(v); };
export function addBox(x0, z0, x1, z1) { const b = { x0, z0, x1, z1 }; for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++) for (let cz = Math.floor(z0 / CELL); cz <= Math.floor(z1 / CELL); cz++) put(boxG, key(cx, cz), b); }
function addSeg(ax, az, bx, bz) {
  const ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez; if (l2 < .01) return; const l = Math.sqrt(l2), s = { ax, az, ex, ez, l2, nx: -ez / l, nz: ex / l };
  for (let cx = Math.floor(Math.min(ax, bx) / CELL); cx <= Math.floor(Math.max(ax, bx) / CELL); cx++) for (let cz = Math.floor(Math.min(az, bz) / CELL); cz <= Math.floor(Math.max(az, bz) / CELL); cz++) put(segG, key(cx, cz), s);
}
export const hit = { nx: 0, nz: 0 };
export function collide(o, r) {
  let any = false;
  const cx0 = Math.floor((o.x - r) / CELL), cx1 = Math.floor((o.x + r) / CELL), cz0 = Math.floor((o.z - r) / CELL), cz1 = Math.floor((o.z + r) / CELL);
  for (let cx = cx0; cx <= cx1; cx++) for (let cz = cz0; cz <= cz1; cz++) {
    const k = key(cx, cz), a = boxG.get(k);
    if (a) for (let i = 0; i < a.length; i++) {
      const b = a[i], nx = clamp(o.x, b.x0, b.x1), nz = clamp(o.z, b.z0, b.z1), dx = o.x - nx, dz = o.z - nz, d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-8) { const d = Math.sqrt(d2); o.x = nx + dx / d * r; o.z = nz + dz / d * r; hit.nx = dx / d; hit.nz = dz / d; }
      else { const l = o.x - b.x0, rg = b.x1 - o.x, t = o.z - b.z0, bt = b.z1 - o.z, m = Math.min(l, rg, t, bt);
        if (m === l) { o.x = b.x0 - r; hit.nx = -1; hit.nz = 0; } else if (m === rg) { o.x = b.x1 + r; hit.nx = 1; hit.nz = 0; } else if (m === t) { o.z = b.z0 - r; hit.nx = 0; hit.nz = -1; } else { o.z = b.z1 + r; hit.nx = 0; hit.nz = 1; } }
      any = true;
    }
    const sg = segG.get(k);
    if (sg) for (let i = 0; i < sg.length; i++) {
      const s = sg[i], rx = o.x - s.ax, rz = o.z - s.az, ti = (rx * s.ex + rz * s.ez) / s.l2, t = ti < 0 ? 0 : ti > 1 ? 1 : ti;
      const px = s.ax + s.ex * t, pz = s.az + s.ez * t, dx = o.x - px, dz = o.z - pz, d2 = dx * dx + dz * dz; if (d2 >= r * r) continue;
      const side = rx * s.nx + rz * s.nz;
      if (side < 0 && ti > 0 && ti < 1) { if (side < -3) continue; o.x = px + s.nx * r; o.z = pz + s.nz * r; hit.nx = s.nx; hit.nz = s.nz; }
      else { const d = Math.sqrt(d2); if (d > 1e-4) { o.x = px + dx / d * r; o.z = pz + dz / d * r; hit.nx = dx / d; hit.nz = dz / d; } else { o.x = px + s.nx * r; o.z = pz + s.nz * r; hit.nx = s.nx; hit.nz = s.nz; } }
      any = true;
    }
  }
  return any;
}
function pip(p, x, z) { let c = false; for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) if ((p[i + 1] > z) !== (p[j + 1] > z) && x < (p[j] - p[i]) * (z - p[i + 1]) / (p[j + 1] - p[i + 1]) + p[i]) c = !c; return c; }
export function inside(x, z, m = 0) {
  const a = bG.get(key(Math.floor(x / 64), Math.floor(z / 64))); if (!a) return false;
  for (const b of a) if (x > b.x0 - m && x < b.x1 + m && z > b.z0 - m && z < b.z1 + m && (m ? true : pip(b.p, x, z))) return true;
  return false;
}
// ---------------- road graph queries ----------------
export function nodesNear(x, z, r) { const out = []; for (let cx = Math.floor((x - r) / NC); cx <= Math.floor((x + r) / NC); cx++) for (let cz = Math.floor((z - r) / NC); cz <= Math.floor((z + r) / NC); cz++) { const a = nG.get(key(cx, cz)); if (a) for (const n of a) out.push(n); } return out; }
export function nearestNode(x, z, drv = true) {
  let best = -1, bd = 1e18;
  for (let R = 1; R <= 12 && best < 0; R += 2) for (const n of nodesNear(x, z, R * NC)) { if (drv && !n.ub.length) continue; const d = (n.x - x) ** 2 + (n.z - z) ** 2; if (d < bd) { bd = d; best = n.i; } }
  return best < 0 ? 0 : best;
}
export const edge = (a, b) => W.E.get(a * 65536 + b);
export const laneOff = (e, side) => e.ow ? (e.w >= 6.6 ? side * e.w / 4 : 0) : Math.min(e.w / 4, 3.6);
// nearest drivable road segment to a point
export function edgeNear(x, z, maxCls = 4, R = 220) {
  let best = null, bd = 1e18;
  for (const n of nodesNear(x, z, R)) for (const j of n.ub) { if (j < n.i) continue; const e = edge(n.i, j); if (e.cls > maxCls) continue; const m = W.nodes[j], ex = m.x - n.x, ez = m.z - n.z, l2 = ex * ex + ez * ez; if (l2 < 1) continue;
    const t = clamp(((x - n.x) * ex + (z - n.z) * ez) / l2, 0, 1), px = n.x + ex * t, pz = n.z + ez * t, d = (x - px) ** 2 + (z - pz) ** 2; if (d < bd) { bd = d; const l = Math.sqrt(l2); best = { a: n.i, b: j, px, pz, dx: ex / l, dz: ez / l, w: e.w, e, t, len: l }; } }
  if (best) best.d = Math.sqrt(bd); return best;
}
export function roadAt(x, z) { const e = edgeNear(x, z, 8, 60); return e && e.d < e.w / 2 + 5 && e.e.name ? e.e.name : null; }
// kerbside stopping point on the road nearest to (x,z), on the side facing it
export function kerb(x, z) { const e = edgeNear(x, z, 4, 400); if (!e) return { x, z }; const lx = e.dz, lz = -e.dx, s = ((x - e.px) * lx + (z - e.pz) * lz) >= 0 ? 1 : -1; return { x: e.px + lx * s * (e.w / 2 - 1.7), z: e.pz + lz * s * (e.w / 2 - 1.7) }; }
// a spot on the pavement beside the nearest road (k slides it along the road); heading follows left-hand traffic
export function pave(x, z, k = 0, out = 2.2) {
  const e = edgeNear(x, z, 4, 400); if (!e) return { x, z, h: 0 };
  const lx = e.dz, lz = -e.dx, s = ((x - e.px) * lx + (z - e.pz) * lz) >= 0 ? 1 : -1;
  for (let t = 0; t < 14; t++) { const sh = k * 7.5 + (t % 2 ? -1 : 1) * Math.ceil(t / 2) * 7, qx = e.px + e.dx * sh + lx * s * (e.w / 2 + out), qz = e.pz + e.dz * sh + lz * s * (e.w / 2 + out);
    if (!inside(qx, qz) && !inside(qx + lx * s, qz + lz * s)) { const o = edgeNear(qx, qz, 6, 120); if (o && o.d < o.w / 2 + .6) continue; return { x: qx, z: qz, h: Math.atan2(e.dx * s, e.dz * s) }; } }
  return { x: e.px + lx * s * (e.w / 2 + out), z: e.pz + lz * s * (e.w / 2 + out), h: Math.atan2(e.dx * s, e.dz * s) };
}
// Dijkstra over the road graph (directed = obey one-ways)
let heap = [], dArr, pArr;
export function route(a, b, directed = true) {
  const N = W.nodes.length; if (!dArr) { dArr = new Float32Array(N); pArr = new Int32Array(N); }
  dArr.fill(1e18); dArr[a] = 0; pArr[a] = -1; heap = [[0, a]]; const T = W.nodes[b]; let n = 0;
  while (heap.length && n++ < 60000) {
    let mi = 0; for (let i = 1; i < heap.length; i++) if (heap[i][0] < heap[mi][0]) mi = i;     // small frontier: linear pick is fine
    const [f, u] = heap[mi]; heap[mi] = heap[heap.length - 1]; heap.pop(); if (u === b) break; const U = W.nodes[u], du = dArr[u]; if (f - Math.hypot(U.x - T.x, U.z - T.z) > du + .01) continue;
    for (const v of (directed ? U.nb : U.ub)) { const V = W.nodes[v], nd = du + Math.hypot(V.x - U.x, V.z - U.z); if (nd < dArr[v]) { dArr[v] = nd; pArr[v] = u; heap.push([nd + Math.hypot(V.x - T.x, V.z - T.z), v]); } }
  }
  if (dArr[b] > 1e17) return directed ? route(a, b, false) : null;
  const out = []; for (let u = b; u >= 0; u = pArr[u]) out.push(u); return out.reverse();
}
export function district(x, z) {
  if (z > 2250 && x < -850) return 'Mbare'; if (z > 1383) return x < -1300 ? 'Workington' : 'Graniteside';
  if (z > 560 && x > -900) return 'Railway Yards'; if (x < -900 && z > 150) return 'Kopje · Downtown'; if (x < -1300) return z < -500 ? 'Milton Park' : 'Belvedere';
  if (z < -620) return 'The Avenues'; if (x > 700) return 'Eastlea'; return 'Harare CBD';
}
// traffic signals ("robots"): 0 green, 1 amber, 2 red for a vehicle travelling along (dx,dz); -1 = robot not working
export function sigState(n, dx, dz) {
  if (n.sig === 2) return -1; const c = (G.time + n.so) % 32, ew = Math.abs(dx) > Math.abs(dz);
  if (ew) return c < 13 ? 0 : c < 16 ? 1 : 2; return c < 16 ? 2 : c < 29 ? 0 : 1;
}
export function findRoad(name, x, z) { let best = null, bd = 1e18; for (const s of W.segs) { if (s[4].cls > 4 || !s[4].name.includes(name)) continue; const l = Math.hypot(s[2] - s[0], s[3] - s[1]); if (l < 34) continue; const mx = (s[0] + s[2]) / 2, mz = (s[1] + s[3]) / 2, d = (mx - x) ** 2 + (mz - z) ** 2; if (d < bd) { bd = d; best = { x: mx, z: mz, dx: (s[2] - s[0]) / l, dz: (s[3] - s[1]) / l, w: s[4].w, name: s[4].name }; } } return best; }

// ---------------- textures ----------------
function facade(kind) {
  const S = 256, c = document.createElement('canvas'), e = document.createElement('canvas'); c.width = c.height = e.width = e.height = S;
  const x = c.getContext('2d'), y = e.getContext('2d'); y.fillStyle = '#000'; y.fillRect(0, 0, S, S); x.fillStyle = '#fff'; x.fillRect(0, 0, S, S);
  if (kind === 'shed') { for (let i = 0; i < S; i += 8) { x.fillStyle = i % 16 ? '#e2e2e2' : '#cfcfcf'; x.fillRect(i, 0, 3, S); } x.fillStyle = '#555'; x.fillRect(96, 150, 64, 106); }
  else if (kind === 'shop') { x.fillStyle = '#26323c'; x.fillRect(0, 84, S, 158); x.fillStyle = '#3d5163'; x.fillRect(0, 84, S, 30); x.fillStyle = '#d9d9d9'; for (let i = 0; i < S; i += 64) x.fillRect(i, 84, 4, 158); x.fillStyle = '#8a8a86'; x.fillRect(0, 242, S, 14);
    x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(0, 76, S, 8); x.fillStyle = 'rgba(0,0,0,.5)'; x.font = 'bold 34px Arial'; x.fillText('SHOP · SALE · AIRTIME', 8, 52); x.fillStyle = '#14202a'; x.fillRect(140, 120, 40, 122);
    y.fillStyle = '#6e5a30'; y.fillRect(0, 114, S, 124); y.fillStyle = '#000'; for (let i = 0; i < S; i += 64) y.fillRect(i, 84, 4, 158); y.fillStyle = '#3a3a34'; y.fillRect(0, 0, S, 76); }
  else for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const ox = i * 64, oy = j * 64, lit = rnd() < (kind === 'glass' ? .22 : .26);
    if (kind === 'glass') { const g = x.createLinearGradient(0, oy, 0, oy + 64); g.addColorStop(0, '#9fc0dd'); g.addColorStop(1, '#55789c'); x.fillStyle = g; x.fillRect(ox, oy, 64, 64); x.fillStyle = '#dfe9f2'; x.fillRect(ox, oy, 64, 3); x.fillRect(ox, oy, 3, 64); x.fillStyle = 'rgba(255,255,255,.14)'; x.fillRect(ox + 8, oy + 8, 20, 50);
      if (lit) { y.fillStyle = rnd() < .5 ? '#8fa6c8' : '#c9a868'; y.fillRect(ox + 4, oy + 5, 58, 57); } }
    else if (kind === 'office') { x.fillStyle = '#d9d9d9'; x.fillRect(ox, oy + 50, 64, 14); x.fillStyle = '#31465b'; x.fillRect(ox + 5, oy + 10, 54, 36); x.fillStyle = '#4f6e8c'; x.fillRect(ox + 5, oy + 10, 54, 9); x.fillStyle = '#1f2d3a'; x.fillRect(ox + 31, oy + 10, 2, 36);
      if (lit) { y.fillStyle = '#c9a868'; y.fillRect(ox + 5, oy + 19, 54, 27); } }
    else { x.fillStyle = '#e6e6e6'; x.fillRect(ox + 17, oy + 13, 30, 36); x.fillStyle = '#2f4254'; x.fillRect(ox + 20, oy + 16, 24, 30); x.fillStyle = '#4b6680'; x.fillRect(ox + 20, oy + 16, 24, 8); x.fillStyle = '#dcdcdc'; x.fillRect(ox + 31, oy + 16, 2, 30); x.fillRect(ox + 15, oy + 49, 34, 3);
      if (lit) { y.fillStyle = '#d9b060'; y.fillRect(ox + 20, oy + 24, 24, 22); } }
  }
  return new THREE.MeshLambertMaterial({ map: canvasTex(c, true), vertexColors: true, emissiveMap: kind === 'shed' ? null : canvasTex(e, true), emissive: kind === 'shed' ? 0 : 0xffffff, emissiveIntensity: 0 });
}

// ---------------- build ----------------
export function buildWorld(scene) {
  const Q = G.Q, sh = Q.shadow > 0;
  const chunks = {}, CS = 400;
  const CH = (kind, x, z) => { const k = kind + ':' + Math.floor(x / CS) + ':' + Math.floor(z / CS); return chunks[k] || (chunks[k] = Object.assign(new GB(), { kind, cx: Math.floor(x / CS) * CS + CS / 2, cz: Math.floor(z / CS) * CS + CS / 2 })); };
  const P = (x, z) => CH('p', x, z);
  const label = (text, x, y, z, h = 3.4) => { const s = textSprite(text, { h, screen: true }); s.position.set(x, y, z); scene.add(s); W.labels.push(s); };

  // ---- road graph ----
  const nodeAt = new Map();
  const node = (x, z) => { const k = Math.round(x * 5) * 200003 + Math.round(z * 5); let i = nodeAt.get(k); if (i === undefined) { i = W.nodes.length; nodeAt.set(k, i); const n = { x, z, i, nb: [], ub: [], pb: [], w: 0, big: 0, sig: 0, so: 0 }; W.nodes.push(n); put(nG, key(Math.floor(x / NC), Math.floor(z / NC)), n); } return i; };
  for (const r of CITY.roads) {
    const [cls, w, ow, ni, en] = r, p = dec(en), info = { cls, w, ow, name: ni >= 0 ? CITY.names[ni] : '' };
    for (let i = 0; i < p.length - 2; i += 2) {
      const a = node(p[i], p[i + 1]), b = node(p[i + 2], p[i + 3]); if (a === b) continue; const A = W.nodes[a], B = W.nodes[b], len = Math.hypot(B.x - A.x, B.z - A.z);
      if (edge(a, b)) continue;
      const e = { ...info, len }; W.E.set(a * 65536 + b, e); W.E.set(b * 65536 + a, e); W.segs.push([A.x, A.z, B.x, B.z, e, a, b]);
      A.pb.push(b); B.pb.push(a);
      if (cls <= 5) { A.nb.push(b); if (!ow) B.nb.push(a); A.ub.push(b); B.ub.push(a); A.w = Math.max(A.w, w); B.w = Math.max(B.w, w); if (cls <= 3) { A.big++; B.big++; } }
    }
  }
  // keep only the main connected road network drivable (isolated map fragments stay visible but get no traffic or GPS)
  { const seen = new Uint8Array(W.nodes.length), st = [nearestNode(0, 0)]; seen[st[0]] = 1; while (st.length) { const u = W.nodes[st.pop()]; for (const v of u.ub) if (!seen[v]) { seen[v] = 1; st.push(v); } } for (const n of W.nodes) if (!seen[n.i]) { n.nb = []; n.ub = []; n.big = 0; } }
  // robots at junctions of main roads; neighbouring nodes share a phase so dual carriageways stay in step
  for (const n of W.nodes) if (n.ub.length >= 3 && n.big >= 3) { const hx = Math.floor(n.x / 90), hz = Math.floor(n.z / 90), hsh = Math.abs(Math.sin(hx * 12.9898 + hz * 78.233) * 43758.5453) % 1; n.sig = hsh < .1 ? 2 : 1; n.so = Math.floor(hsh * 320) % 32; W.sigs.push(n); }

  // ---- buildings ----
  const mats = { plaster: facade('plaster'), office: facade('office'), glass: facade('glass'), shed: facade('shed'), shop: facade('shop') };
  W.lit = [mats.plaster, mats.office, mats.glass, mats.shop];
  const TINT = [[0xf0e2c8, 0xf3d9c0, 0xf5f1e6, 0xf0e6b8, 0xdfe8d8, 0xe9d2bf], [0xd9cfc0, 0xc9c2b4, 0xe2d6c2, 0xc7a98b, 0xd8d8d2, 0xbf9d82, 0xcdb7a0, 0xe8dcc6, 0xb9c4cc],
    [0xe4e0d6, 0xcfd3d6, 0xd9cdb8, 0xc2ccd6, 0xeae6dc, 0xbfb4a2, 0xd6c3a8], [0xffffff, 0xcfeadf, 0xe6d6b4, 0xbcd6ff, 0xd8e6f2, 0x9fd0c8], [0xaab4bd, 0xc4b9a4, 0x9aa7b3, 0xb8b6ae], [0xd9b596, 0xcfa98a, 0xe0c6a6, 0xd6d0c4]];
  const ROOF = [[0x9b4a38, 0x4a6b50, 0x8e9296, 0x7d5a45, 0xa35a44], [0x8c8a84, 0x9a978f, 0x7e7c78], [0x86867f, 0x9a978f, 0x75777a], [0x70757a, 0x8a8f94], [0xaab0b5, 0x9aa1a6, 0x8a6a55], [0x8c8a84, 0x9b4a38]];
  const MK = ['plaster', 'plaster', 'office', 'glass', 'shed', 'office'], CW = [3.4, 3.4, 4, 3.2, 6, 3.6];
  const inRoad = (x, z) => { const o = edgeNear(x, z, 5, 70); return o && o.d < o.w / 2 + .5; };
  const addBld = (h, type, p) => {
    const n = p.length / 2; { let ar = 0; for (let i = 0, j = n - 1; i < n; j = i++) ar += (p[j * 2] - p[i * 2]) * (p[j * 2 + 1] + p[i * 2 + 1]); if (ar > 0) { const q = []; for (let i = n - 1; i >= 0; i--) q.push(p[i * 2], p[i * 2 + 1]); p = q; } } let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, cx = 0, cz = 0;
    for (let i = 0; i < p.length; i += 2) { x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); z0 = Math.min(z0, p[i + 1]); z1 = Math.max(z1, p[i + 1]); cx += p[i] / n; cz += p[i + 1] / n; }
    const b = { p, h, x0, x1, z0, z1, type }; W.blds.push(b);
    for (let gx = Math.floor(x0 / 64); gx <= Math.floor(x1 / 64); gx++) for (let gz = Math.floor(z0 / 64); gz <= Math.floor(z1 / 64); gz++) put(bG, key(gx, gz), b);
    const tint = pick(TINT[type]), core = Math.exp(-((cx + 230) ** 2 + (cz + 80) ** 2) / (700 * 700));
    const shop = (type === 1 || type === 2 || type === 3) && h > 6.5 && core > .22, y0 = shop ? 3.7 : 0, g = CH(MK[type], cx, cz), gs = shop ? CH('shop', cx, cz) : null, sc = shop ? pick([0xc62828, 0x1565c0, 0xf9a825, 0x2e7d32, 0x6a1b9a, 0xef6c00, 0x00838f, 0xeeeeee, 0x37474f]) : 0;
    const vr = Math.max(1, Math.round((h - y0) / 3.3)) / 4;
    for (let i = 0; i < n; i++) { const j = (i + 1) % n, ax = p[i * 2], az = p[i * 2 + 1], bx = p[j * 2], bz = p[j * 2 + 1], l = Math.hypot(bx - ax, bz - az); if (l < .05) continue;
      g.wall(ax, az, bx, bz, y0, h, tint, Math.max(1, Math.round(l / CW[type])) / 4, 0, vr); if (shop) gs.wall(ax, az, bx, bz, 0, y0, sc, Math.max(1, Math.round(l / 6)), 0, 1); if (!inRoad(ax, az) && !inRoad(bx, bz) && !inRoad((ax + bx) / 2, (az + bz) / 2)) addSeg(ax, az, bx, bz); }
    const ctr = []; for (let i = 0; i < n; i++) ctr.push(new THREE.Vector2(p[i * 2], p[i * 2 + 1]));
    const tris = THREE.ShapeUtils.triangulateShape(ctr, []), rg = CH('r', cx, cz); rg.flat(p, tris, h, pick(ROOF[type]));
    if (type >= 2 && type !== 4 && h > 16 && pip(p, cx, cz)) { const s = Math.min(9, Math.sqrt((x1 - x0) * (z1 - z0)) * .28); rg.at().box(cx, h, cz, s, 2.6, s, 0x8f8f8a); if (h > 60) rg.cyl(cx + s * .2, h + 2.6, cz, .25, 14, 0xd0d0d0); }
  };
  for (const [h, type, en] of CITY.bld) addBld(h, type, dec(en));
  // Mbare and the industrial south are barely mapped as buildings: fill the real street pattern with houses, flats and sheds
  { const rect = (cx, cz, dx, dz, hl, hd) => { const lx = dz, lz = -dx; return [cx - dx * hl - lx * hd, cz - dz * hl - lz * hd, cx + dx * hl - lx * hd, cz + dz * hl - lz * hd, cx + dx * hl + lx * hd, cz + dz * hl + lz * hd, cx - dx * hl + lx * hd, cz - dz * hl + lz * hd]; };
    const free = (p, m) => { for (let i = 0; i < 8; i += 2) { if (inside(p[i], p[i + 1], 1.5)) return false; const o = edgeNear(p[i], p[i + 1], 8, 90); if (o && o.d < o.w / 2 + m) return false; } return !inside((p[0] + p[4]) / 2, (p[1] + p[5]) / 2, 2); };
    for (const s of W.segs) { const [ax, az, bx, bz, e] = s; if (az < 1383 || e.cls > 4 || e.len < 24) continue; const dx = (bx - ax) / e.len, dz = (bz - az) / e.len, mbare = (az > 2250 && ax < -820), main = e.cls <= 3;
      for (const side of [1, -1]) for (let t = 9; t < e.len - 9;) { const r = rnd(); let hl, hd, h, type, gap;
        if (mbare && !main) { if (r < .1) { hl = 16; hd = 5; h = 13.6; type = 5; gap = 8; } else { hl = rr(3.5, 5); hd = rr(3, 4); h = 3.2; type = 0; gap = rr(2.5, 6); } }
        else if (mbare) { hl = rr(5, 9); hd = rr(4, 6); h = rnd() < .3 ? 6.8 : 3.6; type = 1; gap = rr(3, 9); }
        else { if (r < .45) { t += rr(20, 60); continue; } hl = rr(12, 24); hd = rr(8, 14); h = rr(6, 10); type = 4; gap = rr(10, 40); }
        const off = e.w / 2 + 4.5 + hd, cx = ax + dx * (t + hl) + dz * side * off, cz = az + dz * (t + hl) - dx * side * off, p = rect(cx, cz, dx, dz, hl, hd);
        if (t + hl * 2 < e.len - 4 && free(p, 3)) addBld(h, type, p); t += hl * 2 + gap; } } }
  // ---- green areas ----
  const GR = new GB();
  for (const [kind, en] of CITY.parks) { const p = dec(en), ctr = []; for (let i = 0; i < p.length; i += 2) ctr.push(new THREE.Vector2(p[i], p[i + 1])); let tris; try { tris = THREE.ShapeUtils.triangulateShape(ctr, []); } catch (e) { continue; } GR.flat(p, tris, kind ? .02 : .01, kind ? 0x3f9a45 : 0x5a964b);
    if (!kind) { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (let i = 0; i < p.length; i += 2) { x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); z0 = Math.min(z0, p[i + 1]); z1 = Math.max(z1, p[i + 1]); }
      const nt = Math.min(70, (x1 - x0) * (z1 - z0) / 420); for (let t = 0; t < nt; t++) { const tx = rr(x0, x1), tz = rr(z0, z1); if (pip(p, tx, tz) && !inside(tx, tz, 2)) W.trees.push([tx, tz, rr(.9, 1.5), pick(['g', 'g', 'j', 'f', 'g'])]); } } }
  // ---- roads ----
  const PV = new GB(), AS = new GB(), MKG = new GB(); AS.worldUV = true; PV.worldUV = true;
  const ASC = [0x55575c, 0x55575c, 0x585a5f, 0x5a5c60, 0x5e5f62, 0x585a5f, 0x66655f, 0xb9a88f, 0xb0a590];
  for (const s of W.segs) {
    const [ax, az, bx, bz, e, a, b] = s, len = e.len;
    if (e.cls <= 5) PV.strip(ax, az, bx, bz, e.w + 5.6, .04, 0xb3aea3);
    AS.strip(ax, az, bx, bz, e.w, e.cls >= 7 ? .07 : .09, ASC[e.cls]);
    if (e.cls <= 4 && len > 14) {
      const A = W.nodes[a], B = W.nodes[b], ta = A.ub.length >= 3 ? A.w / 2 + 3 : 0, tb = B.ub.length >= 3 ? B.w / 2 + 3 : 0; if (len - ta - tb < 8) continue;
      const dx = (bx - ax) / len, dz = (bz - az) / len, sx = ax + dx * ta, sz = az + dz * ta, ex = bx - dx * tb, ez = bz - dz * tb, vr = Math.round((len - ta - tb) / 9);
      if (!e.ow) { if (e.w >= 6.5) MKG.strip(sx, sz, ex, ez, .22, .13, 0xffffff, vr); }
      else { const nl = Math.round(e.w / 3.4); for (let k = 1; k < nl; k++) MKG.strip(sx, sz, ex, ez, .2, .13, 0xffffff, vr, (k - nl / 2) * (e.w / nl)); }
      // stop lines at robots
      if (B.sig && tb) { const lx = dz, lz = -dx, o = e.ow ? 0 : e.w / 4, ww = e.ow ? e.w : e.w / 2; MKG.strip(ex + lx * (o - ww / 2 + .3), ez + lz * (o - ww / 2 + .3), ex + lx * (o + ww / 2 - .3), ez + lz * (o + ww / 2 - .3), .5, .13, 0xffffff, 0); }
    }
  }
  for (const n of W.nodes) { if (n.ub.length) { PV.disc(n.x, n.z, n.w / 2 + 2.8, .04, 0xb3aea3, 12); AS.disc(n.x, n.z, n.w / 2, .09, 0x55575c, 12); } else if (n.pb.length > 1) { const e = edge(n.i, n.pb[0]); AS.disc(n.x, n.z, e.w / 2, e.cls >= 7 ? .07 : .09, ASC[e.cls], 8); } }
  let c = document.createElement('canvas'); c.width = c.height = 128; let x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 1400; i++) { const v = 226 + (rnd() * 29 | 0); x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(rnd() * 128, rnd() * 128, 2 + rnd() * 3, 2); } for (let i = 0; i < 14; i++) { x.strokeStyle = 'rgba(60,60,60,.12)'; x.beginPath(); x.moveTo(rnd() * 128, rnd() * 128); x.lineTo(rnd() * 128, rnd() * 128); x.stroke(); }
  const noise = canvasTex(c, true);
  c = document.createElement('canvas'); c.width = 8; c.height = 32; x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 8, 17);
  const dash = canvasTex(c, true); dash.magFilter = THREE.NearestFilter;
  const mk = (gb, mat, ro) => { const m = new THREE.Mesh(gb.build(), mat); m.frustumCulled = false; m.receiveShadow = sh; m.renderOrder = ro; scene.add(m); return m; };
  const flatMat = o => new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -o, polygonOffsetUnits: -o * 2, ...(o > 1 ? { map: noise } : {}) });
  mk(GR, flatMat(1), 1); mk(PV, flatMat(2), 2); mk(AS, flatMat(3), 3);
  mk(MKG, new THREE.MeshBasicMaterial({ map: dash, transparent: true, alphaTest: .5, color: 0xe8e6da, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 }), 4);
  // rails
  { const RG = new GB(); for (const en of CITY.rails) { const p = dec(en); for (let i = 0; i < p.length - 2; i += 2) { RG.strip(p[i], p[i + 1], p[i + 2], p[i + 3], 3.4, .05, 0x6b6257); RG.strip(p[i], p[i + 1], p[i + 2], p[i + 3], .16, .16, 0x2c2c2c, 1, .72); RG.strip(p[i], p[i + 1], p[i + 2], p[i + 3], .16, .16, 0x2c2c2c, 1, -.72); } } mk(RG, flatMat(1), 1); }
  // ground: dusty in town, greener in the suburbs
  { const g = new THREE.PlaneGeometry(7600, 7600, 76, 76).rotateX(-Math.PI / 2), pos = g.attributes.position, col = new Float32Array(pos.count * 3), a = new THREE.Color(0x9a927f), b = new THREE.Color(0x76874a), t = new THREE.Color();
    for (let i = 0; i < pos.count; i++) { const px = pos.getX(i) - 500, pz = pos.getZ(i) + 700, cbd = Math.exp(-((px + 300) ** 2 + (pz - 100) ** 2) / (1100 * 1100)), mb = Math.exp(-((px + 1500) ** 2 + (pz - 2700) ** 2) / (700 * 700)); t.copy(b).lerp(a, clamp(cbd + mb + (pz > 600 ? .5 : 0), 0, 1)); col[i * 3] = t.r; col[i * 3 + 1] = t.g; col[i * 3 + 2] = t.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, map: noise })); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 500, uv.getY(i) * 500);
    m.position.set(-500, -.05, 700); m.receiveShadow = sh; scene.add(m); }

  // ---- props helpers ----
  const SKIN = [0x5a3a26, 0x6b4630, 0x4a2f20, 0x7a523a], SHIRT = [0xd43f2a, 0x2a6fd4, 0xf2c300, 0x2e9b57, 0xffffff, 0x8e44ad, 0xe67e22, 0x16a085, 0x34495e, 0xf7f1e3], PANTS = [0x2c3e50, 0x1b1b1b, 0x5d4037, 0x3b4a6b, 0x7f8c8d];
  const FG = { leg: new THREE.CapsuleGeometry(.085, .64, 3, 7), arm: new THREE.CapsuleGeometry(.055, .46, 3, 7), torso: new THREE.CapsuleGeometry(.19, .3, 3, 9).scale(1.15, 1, .75), head: new THREE.SphereGeometry(.125, 10, 8).scale(.95, 1.12, 1) }, _fm = new THREE.Matrix4();
  const fig = (x, z, ry, shirt = pick(SHIRT), pants = pick(PANTS)) => { const g = P(x, z).at(x, .1, z, ry), sk = pick(SKIN), put = (geo, px, py, pz, c) => { _fm.makeTranslation(px, py, pz).premultiply(g.M); g.add(geo, _fm, c); };
    put(FG.leg, -.1, .43, 0, pants); put(FG.leg, .1, .43, 0, pants); put(FG.torso, 0, 1.13, 0, shirt); put(FG.head, 0, 1.6, 0, sk); put(FG.arm, -.28, 1.12, 0, sk); put(FG.arm, .28, 1.12, 0, sk); };
  const GOODS = [0xd32f2f, 0x43a047, 0xfb8c00, 0xfdd835, 0xf5f5f5, 0x8d6e63, 0x6a1b9a], UMB = [0xd32f2f, 0x1e88e5, 0xfdd835, 0x43a047, 0xff7043];
  const keep = [];
  const clear = (x, z, r = 7) => !keep.some(k => Math.hypot(k.x - x, k.z - z) < r);
  const stall = (x, z, ry) => { const g = P(x, z).at(x, .1, z, ry); g.box(0, 0, 0, 1.6, .75, .9, 0x8b6b43); for (let k = -1; k <= 1; k++) g.box(k * .5, .75, 0, .42, .16 + rnd() * .15, .6, pick(GOODS)); g.box(0, 0, -.6, .06, 2.1, .06, 0x555555); g.cone(0, 2.0, -.3, 1.35, .45, pick(UMB)); fig(x - Math.sin(ry) * 1.05, z - Math.cos(ry) * 1.05, ry); addBox(x - .7, z - .7, x + .7, z + .7); };
  const staticVeh = (type, col, x, z, ry) => { const g = P(x, z).at(x, .1, z, ry); g.add(vehGeo(type, col), g.M, null); const L = type === 'bus' ? 5.2 : 2.3, fx = Math.sin(ry), fz = Math.cos(ry); for (const s of [-.6, 0, .6]) addBox(x + fx * L * s - 1, z + fz * L * s - 1, x + fx * L * s + 1, z + fz * L * s + 1); };
  const flag = (x, z) => { const g = P(x, z).at(x, .1, z, 0); g.cyl(0, 0, 0, .09, 10, 0xcfcfcf); [0x1e8e4e, 0xf2c300, 0xc62828, 0x111111, 0xc62828, 0xf2c300, 0x1e8e4e].forEach((cl, i) => g.box(1.4, 9.7 - i * .24 - .24, 0, 2.7, .24, .05, cl)); };
  const offRoad = (x, z, m = 1) => { const o = edgeNear(x, z, 6, 120); return !o || o.d > o.w / 2 + m; };
  const open = (x, z) => { for (let r = 0; r < 160; r += 8) for (let a = 0; a < 6.28; a += .5) { const qx = x + Math.cos(a) * r, qz = z + Math.sin(a) * r; if (!inside(qx, qz, 3) && offRoad(qx, qz, 3)) return [qx, qz]; } return [x, z]; };

  // ---- places (real coordinates from the map data) ----
  const CP = CITY.places, st = n => { const s = CITY.stations.find(q => q[0].includes(n)); return [s[1], s[2]]; };
  const mb = open(CP.rufaro[0] + 150, CP.rufaro[1] + 20);
  const def = (k, name, short, xz) => { PL[k] = { name, short: short || name, x: xz[0], z: xz[1], stop: kerb(xz[0], xz[1]) }; };
  def('copa', 'Copacabana Rank', 'Copacabana', open(-838, 256)); def('msq', 'Market Square Rank', 'Market Square', st('Market Square')); def('fourth', 'Fourth Street Terminus', 'Fourth Street', st('Fourth Street'));
  def('roadport', 'Roadport', 'Roadport', st('Roadport')); def('charge', 'Charge Office Rank', 'Charge Office', st('Charge Office')); def('mbare', 'Mbare Musika', 'Mbare', mb);
  def('town', 'Town House', 0, CP.town); def('gardens', 'Harare Gardens', 0, CP.gardens); def('hosp', 'West End Hospital', 0, CP.hospital); def('zrp', 'Harare Central Police', 0, CP.zrp);
  def('eastgate', 'Eastgate', 0, CP.eastgate); def('unity', 'Africa Unity Square', 0, CP.unity); def('rail', 'Railway Station', 0, CP.rail); def('rbz', 'Reserve Bank', 0, CP.rbz); def('joina', 'Joina City', 0, CP.joina);
  def('rufaro', 'Rufaro Stadium', 0, CP.rufaro); def('defence', 'Defence House', 0, CP.defence); def('parliament', 'Parliament', 0, CP.parliament); def('meikles', 'Meikles Hotel', 0, CP.meikles); def('gallery', 'National Gallery', 0, CP.gallery);
  def('rainbow', 'Rainbow Towers', 0, CP.rainbow); def('sports', 'Harare Sports Club', 0, CP.sportsclub); def('first', 'First Street Mall', 0, [-205, 135]);
  const mark = (k, pl, n = 0, out = 3.4) => { const q = pave(pl.x, pl.z, n, out); W.marks[k] = q; keep.push(q); return q; };
  mark('story0', PL.copa, 0); mark('story1', PL.mbare, 1); mark('story2', PL.msq, 0); mark('story3', PL.fourth, 0); mark('story4', PL.zrp, 2); mark('story5', PL.defence, 2);
  mark('zrp', PL.zrp, -1); mark('army', PL.defence, -1); mark('council', PL.town, -1); mark('ems', PL.hosp, -1); mark('buy', PL.mbare, -1);
  W.buy = W.marks.buy;
  W.vend = [['first', 'First Street'], ['copa', 'Copacabana'], ['fourth', 'Fourth Street'], ['unity', 'Africa Unity Square']].map(([k, name], i) => { const q = pave(PL[k].x, PL[k].z, 3, 2.6); keep.push(q); return { x: q.x, z: q.z, name }; });
  const fl = (type, pl, k) => { const q = pave(pl.x, pl.z, k, 1.5); keep.push(q); W.fleet.push([type, q.x, q.z, q.h]); };
  fl('police', PL.zrp, 0); fl('police', PL.zrp, 1); fl('army', PL.defence, 0); fl('army', PL.defence, 1); fl('council', PL.town, 0); fl('ambulance', PL.hosp, 0); fl('ambulance', PL.hosp, 1); fl('taxi', PL.fourth, 2); fl('ehail', PL.joina, 0); fl('fit', PL.msq, 2); fl('kombi', PL.copa, 2);
  W.start = pave(PL.copa.x, PL.copa.z, 1, 3.4); keep.push(W.start);

  // ---- ranks: shelters, parked kombis, touts ----
  for (const k of ['copa', 'msq', 'fourth', 'roadport', 'charge', 'mbare']) {
    const pl = PL[k]; label(pl.name, pl.x, 13, pl.z, 3.6);
    for (let i = 0; i < 16; i++) { const a = rnd() * 6.28, r = 6 + rnd() * 34, x = pl.x + Math.cos(a) * r, z = pl.z + Math.sin(a) * r; if (inside(x, z, 3.5) || !offRoad(x, z, 3.5) || !clear(x, z, 8)) continue; keep.push({ x, z });
      if (i < 9) staticVeh(k === 'roadport' || (k === 'fourth' && i < 3) ? 'bus' : 'kombi', pick([0xf4f4f0, 0xe8e8e2, 0xdfe6ee, 0xf1ead8]), x, z, Math.floor(rnd() * 4) * Math.PI / 2 + .2); else if (i < 13) stall(x, z, rnd() * 6.28); else { const g = P(x, z).at(x, .1, z, rnd() * 3); g.box(0, 3, 0, 12, .22, 4, pick([0x2e7d32, 0x1565c0, 0xc62828])); for (const px of [-5.6, 5.6]) for (const pz of [-1.7, 1.7]) g.box(px, 0, pz, .18, 3, .18, 0x666666); } }
    for (let i = 0; i < 8; i++) { const x = pl.x + rr(-28, 28), z = pl.z + rr(-28, 28); if (!inside(x, z, 1) && clear(x, z, 3)) fig(x, z, rnd() * 6.28); }
  }
  // Mbare Musika market sheds beside Rufaro
  for (let i = -3; i <= 3; i++) for (let j = -2; j <= 2; j++) { const x = mb[0] + i * 15 + 60, z = mb[1] + j * 13; if (inside(x, z, 6) || !offRoad(x, z, 6) || !clear(x, z, 9)) continue; const g = P(x, z).at(x, .1, z, 0); g.box(0, 0, 0, 9, .8, 3, 0x8b6b43); for (let q = -3; q <= 3; q++) g.box(q * 1.2, .8, 0, 1, .2 + rnd() * .3, 2.4, pick(GOODS)); g.box(0, 2.7, 0, 11, .15, 5.5, pick([0x8a4b32, 0x9aa1a6, 0x4f6f8f, 0x7d7d70])); for (const px of [-5, 5]) for (const pz of [-2.4, 2.4]) g.box(px, 0, pz, .15, 2.7, .15, 0x555555); addBox(x - 4.5, z - 1.5, x + 4.5, z + 1.5); fig(x + rr(-3, 3), z - 2.2, Math.PI); fig(x + rr(-3, 3), z + 2.4, 0); }
  { const [rx, rz] = CITY.places.rufaro; const g = CH('office', rx, rz), rg = CH('r', rx, rz); for (const [ox, oz, w, d] of [[0, -78, 150, 16], [0, 78, 150, 16], [-70, 0, 16, 130], [70, 0, 16, 130]]) { const x0 = rx + ox - w / 2, x1 = rx + ox + w / 2, z0 = rz + oz - d / 2, z1 = rz + oz + d / 2, pp = [x0, z0, x0, z1, x1, z1, x1, z0]; if (!offRoad(rx + ox, rz + oz, Math.max(w, d) / 2)) continue;
      for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; g.wall(pp[i * 2], pp[i * 2 + 1], pp[j * 2], pp[j * 2 + 1], 0, 13, 0xb9c0c6, Math.max(1, Math.round(Math.hypot(pp[j * 2] - pp[i * 2], pp[j * 2 + 1] - pp[i * 2 + 1]) / 4)) / 4, 0, 1); addSeg(pp[i * 2], pp[i * 2 + 1], pp[j * 2], pp[j * 2 + 1]); } rg.flat(pp, [[0, 1, 2], [0, 2, 3]], 13, 0x8f98a3); }
    label('Rufaro Stadium', rx, 24, rz, 3.6); }
  for (const [t, lx, lz, lh] of CITY.labels) label(t, lx, lh + 9, lz, t.length > 18 ? 3 : 3.6);
  label('Harare Gardens', PL.gardens.x, 16, PL.gardens.z); label('Africa Unity Square', PL.unity.x, 14, PL.unity.z); label('First Street Mall', PL.first.x, 12, PL.first.z, 3); if (CP.kopje) label('The Kopje', CP.kopje[0], 16, CP.kopje[1]);
  flag(W.marks.zrp.x + 2, W.marks.zrp.z + 2); flag(W.marks.army.x + 2, W.marks.army.z + 2); flag(W.marks.council.x + 2, W.marks.council.z + 2);
  for (const k of ['zrp', 'army']) for (let i = 0; i < 2; i++) fig(W.marks[k].x + 3 + i, W.marks[k].z - 2, 0, k === 'zrp' ? 0x4a6fa5 : 0x4b5a35, k === 'zrp' ? 0x2c3e50 : 0x3d4a2c);

  // ---- street life along real roads: stalls, trees, lamps ----
  const lampM = [], poolM = []; let nst = 0;
  for (const s of W.segs) {
    const [ax, az, bx, bz, e] = s, len = e.len; if (len < 22 || e.cls > 7 || e.cls === 5 || e.cls === 6) continue;
    const dx = (bx - ax) / len, dz = (bz - az) / len, lx = dz, lz = -dx, mx = (ax + bx) / 2, mz = (az + bz) / 2, core = Math.exp(-((mx + 300) ** 2 + (mz - 150) ** 2) / (650 * 650)), leafy = mz < -560 || mx > 650 || mx < -1500;
    for (let t = 12; t < len - 12; t += 1) {
      const side = rnd() < .5 ? 1 : -1, off = (e.cls === 7 ? e.w / 2 - 1.5 : e.w / 2 + 1.6), x = ax + dx * t + lx * side * off, z = az + dz * t + lz * side * off;
      if (rnd() < (e.cls === 7 ? .09 : .035) * core + (mz > 2300 && mx < -900 ? .012 : 0) && nst < 420 && clear(x, z) && !inside(x, z, 1.2) && (e.cls === 7 || offRoad(x, z, .5))) { stall(x, z, Math.atan2(-lx * side, -lz * side)); nst++; t += 5; continue; }
      if (e.cls <= 4 && rnd() < (leafy ? .06 : .012)) { const tx = ax + dx * t + lx * side * (e.w / 2 + 2.5), tz = az + dz * t + lz * side * (e.w / 2 + 2.5); if (!inside(tx, tz, 1.5) && offRoad(tx, tz, 1) && clear(tx, tz, 5)) { W.trees.push([tx, tz, rr(.9, 1.35), pick(leafy ? ['j', 'j', 'j', 'f', 'g'] : ['g', 'j', 'g'])]); t += 9; } }
    }
    if (e.cls <= 3) for (let t = 20; t < len - 10; t += 44) { const side = (Math.floor(t / 44) % 2) ? 1 : -1, x = ax + dx * t + lx * side * (e.w / 2 + 1.1), z = az + dz * t + lz * side * (e.w / 2 + 1.1); if (inside(x, z, .5)) continue; lampM.push([x, z, Math.atan2(-lx * side, -lz * side)]); addBox(x - .15, z - .15, x + .15, z + .15); }
  }
  // lamps (instanced)
  { const n = lampM.length, pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(.09, .12, 8, 5).translate(0, 4, 0), new THREE.MeshLambertMaterial({ color: 0x6a6f74 }), n);
    const hm = new THREE.MeshLambertMaterial({ color: 0xd8d8d0, emissive: 0xffd9a0, emissiveIntensity: 0 }), head = new THREE.InstancedMesh(new THREE.BoxGeometry(.5, .16, 1.9).translate(0, 8, .85), hm, n);
    const pm = new THREE.MeshBasicMaterial({ color: 0xffc670, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -10 }), pool = new THREE.InstancedMesh(new THREE.CircleGeometry(7.5, 14).rotateX(-Math.PI / 2), pm, n), m = new THREE.Matrix4();
    lampM.forEach(([lx, lz, ry], i) => { m.makeRotationY(ry).setPosition(lx, 0, lz); pole.setMatrixAt(i, m); head.setMatrixAt(i, m); m.makeTranslation(lx + Math.sin(ry) * 1.6, .15, lz + Math.cos(ry) * 1.6); pool.setMatrixAt(i, m); });
    pole.frustumCulled = head.frustumCulled = pool.frustumCulled = false; pool.renderOrder = 6; scene.add(pole, head, pool); W.lampMat = hm; W.poolMat = pm; }
  // robots: a head on the left kerb of every approach, three lamps each
  { const heads = []; for (const n of W.sigs) for (const j of n.ub) { const e = edge(j, n.i), J = W.nodes[j]; if (e.ow && !J.nb.includes(n.i)) continue; let dx = n.x - J.x, dz = n.z - J.z; const l = Math.hypot(dx, dz); dx /= l; dz /= l; const back = Math.min(l * .6, n.w / 2 + 3.4), side = e.ow ? e.w / 2 + .9 : e.w / 2 + .9;
      heads.push({ n, dx, dz, x: n.x - dx * back + dz * side, z: n.z - dz * back - dx * side, st: -9 }); }
    const nh = heads.length, pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(.08, .08, 4, 5).translate(0, 2, 0), new THREE.MeshLambertMaterial({ color: 0x3a3d40 }), nh), box = new THREE.InstancedMesh(new THREE.BoxGeometry(.42, 1.25, .34).translate(0, 4.4, 0), new THREE.MeshLambertMaterial({ color: 0x1c1c1c }), nh),
      lamps = new THREE.InstancedMesh(new THREE.BoxGeometry(.24, .24, .08), new THREE.MeshBasicMaterial(), nh * 3), m = new THREE.Matrix4(), cl = new THREE.Color(0x222222);
    heads.forEach((h, i) => { const ry = Math.atan2(-h.dx, -h.dz); m.makeRotationY(ry).setPosition(h.x, 0, h.z); pole.setMatrixAt(i, m); box.setMatrixAt(i, m); for (let k = 0; k < 3; k++) { m.makeRotationY(ry).setPosition(h.x - h.dx * .2, 4.8 - k * .4, h.z - h.dz * .2); lamps.setMatrixAt(i * 3 + k, m); lamps.setColorAt(i * 3 + k, cl); } });
    pole.frustumCulled = box.frustumCulled = lamps.frustumCulled = false; scene.add(pole, box, lamps); W.heads = heads; W.sigLamps = lamps; }
  // speed cameras + ZRP roadblocks on real roads
  for (const [nm, x, z] of [['Samora Machel', -1500, -420], ['Samora Machel', 900, -300], ['Julius Nyerere', -480, -60], ['Robert Mugabe', 900, 150], ['Herbert Chitepo', -500, -800], ['Seke Road', -330, 1250], ['Simon Mazorodze', -1800, 2400], ['Enterprise', 1100, -600], ['Chinhoyi', -1050, 1250], ['Remembrance', -1500, 2250], ['Jason Moyo', -100, 100], ['Borrowdale', 420, -1760]]) {
    const r = findRoad(nm, x, z); if (!r) continue; const lx = r.dz, lz = -r.dx, cx = r.x + lx * (r.w / 2 + 1.3), cz = r.z + lz * (r.w / 2 + 1.3), g = P(cx, cz).at(cx, 0, cz, Math.atan2(r.dx, r.dz));
    g.cyl(0, 0, 0, .1, 5, 0x8a8f94); g.box(0, 5, 0, .5, .45, .8, 0xf2c300); g.box(0, 5.1, .42, .3, .25, .1, 0x111111); g.box(0, 2.6, 0, 1.1, 1.1, .08, 0xffffff); g.box(0, 2.75, .02, .9, .8, .08, 0xc62828); g.box(0, 2.85, .04, .6, .6, .08, 0xffffff);
    W.cams.push({ x: r.x, z: r.z, name: r.name, limit: 60, cd: 0 }); addBox(cx - .15, cz - .15, cx + .15, cz + .15);
  }
  for (const [nm, x, z] of [['Samora Machel', 420, -430], ['Seke Road', -300, 1600], ['Robert Mugabe', -1500, 420], ['Herbert Chitepo', 600, -700]]) {
    const r = findRoad(nm, x, z); if (!r) continue; const ry = Math.atan2(r.dx, r.dz), g = P(r.x, r.z).at(r.x, 0, r.z, ry), co = Math.cos(ry), si = Math.sin(ry), hw = r.w / 2;
    const wp = (lx, lz) => [r.x + lx * co + lz * si, r.z - lx * si + lz * co];
    for (const a of [-6, 6]) for (const l of [-hw + .4, 0, hw - .4]) { if (l === 0 && r.w < 9) continue; g.cyl(l, .1, a, .32, 1, 0xff7a1a); g.cyl(l, .5, a, .33, .25, 0xffffff); const [wx, wz] = wp(l, a); addBox(wx - .3, wz - .3, wx + .3, wz + .3); }
    g.box(hw + 1.2, .1, -5, .12, 2.2, .12, 0x888888); g.box(hw + 1.2, 1.6, -5, 1.6, .9, .1, 0xd32f2f);
    const [o1x, o1z] = wp(hw + 1.4, -2), [o2x, o2z] = wp(-hw - 1.4, 2), [px, pz] = wp(hw + 2.6, 8); fig(o1x, o1z, ry - Math.PI / 2, 0x4a6fa5, 0x2c3e50); fig(o2x, o2z, ry + Math.PI / 2, 0x4a6fa5, 0x2c3e50); if (!inside(px, pz, 2.5)) staticVeh('police', 0xf7f7f7, px, pz, ry);
    label('ZRP ROADBLOCK', r.x, 6, r.z, 2.2); W.roadblocks.push({ x: r.x, z: r.z, name: r.name, dx: r.dx, dz: r.dz });
  }
  // potholes
  for (let i = 0; i < 900 && W.potholes.length < 170; i++) { const s = pick(W.segs), e = s[4]; if (e.cls > 4 || e.len < 40) continue; const t = rr(.2, .8), l = rr(-e.w / 2 + 1, e.w / 2 - 1), dx = (s[2] - s[0]) / e.len, dz = (s[3] - s[1]) / e.len, px = lerp(s[0], s[2], t) + dz * l, pz = lerp(s[1], s[3], t) - dx * l;
    if (W.roadblocks.some(b => Math.hypot(b.x - px, b.z - pz) < 30)) continue; W.potholes.push({ x: px, z: pz, r: rr(.8, 1.5), on: true }); }
  const m4 = new THREE.Matrix4(), pg = new THREE.CircleGeometry(1, 9).rotateX(-Math.PI / 2);
  W.potMesh = new THREE.InstancedMesh(pg, new THREE.MeshBasicMaterial({ color: 0x1d1a17, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -10 }), W.potholes.length);
  W.potholes.forEach((p, i) => { m4.makeScale(p.r, 1, p.r * rr(.7, 1)).setPosition(p.x, .12, p.z); W.potMesh.setMatrixAt(i, m4); }); W.potMesh.frustumCulled = false; W.potMesh.renderOrder = 5; scene.add(W.potMesh);
  W.patch = i => { W.potholes[i].on = false; m4.makeScale(0, 0, 0); W.potMesh.setMatrixAt(i, m4); W.potMesh.instanceMatrix.needsUpdate = true; };

  // ---- meshes ----
  const matP = new THREE.MeshLambertMaterial({ vertexColors: true });
  for (const k in chunks) { const ch = chunks[k], m = new THREE.Mesh(ch.build(), ch.kind === 'p' || ch.kind === 'r' ? matP : mats[ch.kind]); m.castShadow = sh && ch.kind !== 'r'; m.receiveShadow = sh; scene.add(m); if (ch.kind === 'p') { m.userData = { cx: ch.cx, cz: ch.cz }; W.propMeshes.push(m); } }
  // trees, grouped by district so far-away groves are culled
  const TREEC = { g: [0x3f7d3a, 0x4f8a35, 0x6b8f3a, 0x2f6b33], j: [0x9b72cf, 0x8a63c4, 0xa884d8], f: [0xd9482b, 0xe2603a] }, groups = {};
  for (const t of W.trees) { const k = Math.floor(t[0] / 500) + ':' + Math.floor(t[1] / 500); (groups[k] || (groups[k] = [])).push(t); addBox(t[0] - .3, t[1] - .3, t[0] + .3, t[1] + .3); }
  const tg = new THREE.CylinderGeometry(.2, .32, 1, 5), cg = new THREE.IcosahedronGeometry(1, Q.low ? 0 : 1), tm = new THREE.MeshLambertMaterial({ color: 0x5b4332 }), cm = new THREE.MeshLambertMaterial({ flatShading: true }), col = new THREE.Color();
  for (const k in groups) { const a = groups[k], trunk = new THREE.InstancedMesh(tg, tm, a.length), crown = new THREE.InstancedMesh(cg, cm, a.length);
    a.forEach(([tx, tz, s, kind], i) => { m4.makeScale(s, 3.6 * s, s).setPosition(tx, 1.8 * s, tz); trunk.setMatrixAt(i, m4); m4.makeScale(3.3 * s, 2.3 * s, 3.3 * s).setPosition(tx, 4.9 * s, tz); crown.setMatrixAt(i, m4); crown.setColorAt(i, col.set(pick(TREEC[kind]))); });
    trunk.computeBoundingSphere(); crown.computeBoundingSphere(); crown.castShadow = sh; scene.add(trunk, crown); }
  // billboards (fictional local acts)
  const bb = (pl, lines, bg) => { const q = pave(pl.x, pl.z, 5, 3.4), c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, 512, 256); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 196, 512, 60); g.textAlign = 'center'; g.fillStyle = '#fff'; g.font = 'bold 50px Arial'; g.fillText(lines[0], 256, 78); g.font = 'bold 30px Arial'; g.fillStyle = '#ffe36e'; g.fillText(lines[1], 256, 138); g.fillStyle = '#fff'; g.font = '26px Arial'; g.fillText(lines[2], 256, 236);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(13, 6.5), new THREE.MeshBasicMaterial({ map: canvasTex(c), side: THREE.DoubleSide })); m.position.set(q.x, 11.2, q.z); m.rotation.y = q.h + Math.PI; scene.add(m); const pm = new THREE.Mesh(new THREE.CylinderGeometry(.25, .25, 8, 6), tm); pm.position.set(q.x, 4, q.z); scene.add(pm); };
  bb(PL.gardens, ['ZIMDANCEHALL CUP CLASH', 'Seh Tawa · Queen Maruva · Dj Chibhodhoro', 'Harare Gardens · Saturday'], '#b3261e'); bb(PL.rufaro, ['SUNGURA NIGHTS', 'Baba Gitare & The Mbare Express', 'Live · Rufaro Stadium'], '#1b5e20');
  bb(PL.joina, ['HANDEI RIDE', 'Tap. Ride. Sharp-sharp.', 'Your city e-hailing app'], '#0e7a4b'); bb(PL.rbz, ['MBIRA DREAMS 98.3', 'Gogo Nyamasvisva · Vana Vembira', 'Roots music all night'], '#4527a0');
}
// refresh robot lamp colours (called a few times per second)
const _c1 = new THREE.Color();
export function updateSignals() {
  const L = W.sigLamps; let ch = false, bl = (G.time * 2 | 0) % 2;
  W.heads.forEach((h, i) => { let s = sigState(h.n, h.dx, h.dz); if (s === -1) s = 3 + bl; if (s === h.st) return; h.st = s; ch = true;
    L.setColorAt(i * 3, _c1.set(s === 2 ? 0xff2a1a : 0x2a0806)); L.setColorAt(i * 3 + 1, _c1.set(s === 1 || s === 4 ? 0xffb300 : 0x2a1e04)); L.setColorAt(i * 3 + 2, _c1.set(s === 0 ? 0x22e055 : 0x052a10)); });
  if (ch) L.instanceColor.needsUpdate = true;
}
