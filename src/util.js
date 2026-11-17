import * as THREE from 'three';
export { THREE };
export const G = {};            // global game state

let seed = 20261116;
export function rnd() { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296; }
export const rr = (a, b) => a + rnd() * (b - a);
export const pick = a => a[(rnd() * a.length) | 0];
export const rrand = (a, b) => a + Math.random() * (b - a);
export const rpick = a => a[(Math.random() * a.length) | 0];
export const rint = n => (Math.random() * n) | 0;
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
export function angDiff(a, b) { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; }

const _c = new THREE.Color(), _v = new THREE.Vector3(), _n = new THREE.Matrix3(), _T = new THREE.Matrix4(),
  _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
export const BOX = new THREE.BoxGeometry(1, 1, 1), CYL = new THREE.CylinderGeometry(.5, .5, 1, 10), CONE = new THREE.ConeGeometry(.5, 1, 8);

// Geometry builder: merges many primitives into ONE vertex-coloured mesh (one draw call).
export class GB {
  constructor() { this.p = []; this.n = []; this.c = []; this.u = []; this.i = []; this.M = new THREE.Matrix4(); }
  at(x = 0, y = 0, z = 0, ry = 0) { this.M.makeRotationY(ry).setPosition(x, y, z); return this; }
  add(geo, m, color) {
    const P = geo.attributes.position, N = geo.attributes.normal, U = geo.attributes.uv, C = geo.attributes.color, base = this.p.length / 3;
    _n.getNormalMatrix(m); if (color != null) _c.set(color);
    for (let i = 0; i < P.count; i++) {
      _v.fromBufferAttribute(P, i).applyMatrix4(m); this.p.push(_v.x, _v.y, _v.z);
      _v.fromBufferAttribute(N, i).applyMatrix3(_n).normalize(); this.n.push(_v.x, _v.y, _v.z);
      if (color != null) this.c.push(_c.r, _c.g, _c.b); else this.c.push(C.getX(i), C.getY(i), C.getZ(i));
      this.u.push(U ? U.getX(i) : 0, U ? U.getY(i) : 0);
    }
    if (geo.index) { const I = geo.index; for (let i = 0; i < I.count; i++) this.i.push(base + I.getX(i)); }
    else for (let i = 0; i < P.count; i++) this.i.push(base + i);
    return base;
  }
  box(x, y0, z, w, h, d, c) { _T.makeScale(w, h, d).setPosition(x, y0 + h / 2, z).premultiply(this.M); return this.add(BOX, _T, c); }
  cyl(x, y0, z, r, h, c) { _T.makeScale(r * 2, h, r * 2).setPosition(x, y0 + h / 2, z).premultiply(this.M); return this.add(CYL, _T, c); }
  cone(x, y0, z, r, h, c) { _T.makeScale(r * 2, h, r * 2).setPosition(x, y0 + h / 2, z).premultiply(this.M); return this.add(CONE, _T, c); }
  wheel(x, y, z, r, w, c) {
    _q.setFromAxisAngle(_s.set(0, 0, 1), Math.PI / 2);
    _T.compose(_p.set(x, y, z), _q, _s.set(r * 2, w, r * 2)).premultiply(this.M); this.add(CYL, _T, c);
  }
  // building box with tiling window UVs
  bld(x, y0, z, w, h, d, c, win = true) {
    const b = this.box(x, y0, z, w, h, d, c);
    const nu = Math.max(1, Math.round(w / 4)), nd = Math.max(1, Math.round(d / 4)), nv = Math.max(1, Math.round(h / 3.4));
    for (let i = 0; i < 24; i++) {
      const f = i >> 2, k = (b + i) * 2;
      if (!win || f === 2 || f === 3) { this.u[k] = .03; this.u[k + 1] = .03; } else { this.u[k] *= (f < 2 ? nd : nu); this.u[k + 1] *= nv; }
    }
  }
  quad(x0, z0, x1, z1, y, c, uv) {
    const b = this.p.length / 3; _c.set(c);
    this.p.push(x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1);
    for (let i = 0; i < 4; i++) { this.n.push(0, 1, 0); this.c.push(_c.r, _c.g, _c.b); }
    if (uv) this.u.push(...uv); else this.u.push(0, 0, 0, 0, 0, 0, 0, 0);
    this.i.push(b, b + 3, b + 2, b, b + 2, b + 1);
  }
  // box whose top face is shrunk/shifted: sloped windscreens and cabins
  trap(x, y0, z, w, h, d, c, tz = .7, shift = 0, tx = .92) {
    const k = tz + ':' + shift + ':' + tx; let geo = GB.traps[k];
    if (!geo) { geo = new THREE.BoxGeometry(1, 1, 1); const P = geo.attributes.position; for (let i = 0; i < P.count; i++) if (P.getY(i) > 0) P.setXYZ(i, P.getX(i) * tx, P.getY(i), P.getZ(i) * tz + shift); geo.computeVertexNormals(); GB.traps[k] = geo; }
    _T.makeScale(w, h, d).setPosition(x, y0 + h / 2, z).premultiply(this.M); return this.add(geo, _T, c);
  }
  // --- helpers for the map-data city ---
  v(x, y, z, nx, ny, nz, u, w) { this.p.push(x, y, z); this.n.push(nx, ny, nz); this.c.push(_c.r, _c.g, _c.b); if (this.worldUV) this.u.push(x / 4, z / 4); else this.u.push(u, w); return this.p.length / 3 - 1; }
  wall(ax, az, bx, bz, y0, y1, c, u, v0, v1) {      // outward normal = (-dz, dx)
    const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l; _c.set(c);
    const A = this.v(ax, y0, az, nx, 0, nz, 0, v0), B = this.v(bx, y0, bz, nx, 0, nz, u, v0), C = this.v(bx, y1, bz, nx, 0, nz, u, v1), D = this.v(ax, y1, az, nx, 0, nz, 0, v1);
    this.i.push(A, B, C, A, C, D);
  }
  flat(pts, tris, y, c) { _c.set(c); const b = this.p.length / 3; for (let i = 0; i < pts.length; i += 2) this.v(pts[i], y, pts[i + 1], 0, 1, 0, .01, .01);
    for (const t of tris) { const [i0, i1, i2] = t, ax = pts[i1 * 2] - pts[i0 * 2], az = pts[i1 * 2 + 1] - pts[i0 * 2 + 1], bx = pts[i2 * 2] - pts[i0 * 2], bz = pts[i2 * 2 + 1] - pts[i0 * 2 + 1]; if (az * bx - ax * bz > 0) this.i.push(b + i0, b + i1, b + i2); else this.i.push(b + i0, b + i2, b + i1); } }
  strip(ax, az, bx, bz, w, y, c, vr = 1, off = 0) {   // flat ribbon from a to b, width w, lateral offset off (left +)
    const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz) || 1, lx = dz / l, lz = -dx / l, h = w / 2; _c.set(c);
    const A = this.v(ax + lx * (off + h), y, az + lz * (off + h), 0, 1, 0, 0, 0), B = this.v(bx + lx * (off + h), y, bz + lz * (off + h), 0, 1, 0, 0, vr),
      C = this.v(bx + lx * (off - h), y, bz + lz * (off - h), 0, 1, 0, 1, vr), D = this.v(ax + lx * (off - h), y, az + lz * (off - h), 0, 1, 0, 1, 0);
    this.i.push(A, C, B, A, D, C);
  }
  disc(x, z, r, y, c, n = 10) { _c.set(c); const o = this.v(x, y, z, 0, 1, 0, .5, .5); for (let i = 0; i <= n; i++) { const a = -i / n * Math.PI * 2; this.v(x + Math.cos(a) * r, y, z + Math.sin(a) * r, 0, 1, 0, .5, .5); if (i) this.i.push(o, o + i, o + i + 1); } }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    g.setIndex(this.i); g.computeBoundingSphere();
    return g;
  }
}

GB.traps = {};
export function canvasTex(c, repeat) {
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; }
  return t;
}
export function textSprite(text, o = {}) {
  const size = 44, c = document.createElement('canvas'), x = c.getContext('2d');
  x.font = `bold ${size}px Arial, sans-serif`;
  const w = Math.ceil(x.measureText(text).width) + 28; c.width = w; c.height = size + 22;
  x.fillStyle = o.bg || 'rgba(12,16,22,.72)'; x.beginPath();
  if (x.roundRect) x.roundRect(0, 0, w, c.height, 14); else x.rect(0, 0, w, c.height); x.fill();
  x.font = `bold ${size}px Arial, sans-serif`; x.fillStyle = o.fg || '#fff'; x.textBaseline = 'middle'; x.fillText(text, 14, c.height / 2 + 2);
  const t = canvasTex(c); t.generateMipmaps = false; t.minFilter = THREE.LinearFilter;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  const h = o.h || 3; if (o.screen) { s.material.sizeAttenuation = false; s.scale.set(h * .0075 * w / c.height, h * .0075, 1); } else s.scale.set(h * w / c.height, h, 1); s.renderOrder = 5;
  return s;
}
