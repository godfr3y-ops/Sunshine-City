import { THREE, G, clamp, angDiff, rrand, rpick, dist } from './util.js';
import { VT, vehGeo, matVeh } from './models.js';
import { W, collide, hit, nearestNode, BOUNDS, edge, laneOff, route, sigState } from './world.js';

const shadowGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const shadowMat = new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: .28, depthWrite: false });
const _o = { x: 0, z: 0 };

export class Veh {
  constructor(type, x, z, h, color) {
    const t = this.t = VT[type]; this.type = type;
    this.x = x; this.z = z; this.h = h; this.speed = 0; this.vx = 0; this.vz = 0;
    this.thr = 0; this.steer = 0; this.hb = 0; this.hp = this.maxHp = t.hp; this.dead = false;
    this.ai = null; this.keep = false; this.noRev = false; this.stuckT = 0; this.revT = 0;
    this.cr = t.W / 2 + .15; this.co = t.L / 2 - t.W / 2;       // two collision circles: radius, offset along body
    this.mass = t.L * t.W;
    color = color ?? rpick(t.colors);
    this.mesh = new THREE.Group();
    this.hi = new THREE.Mesh(vehGeo(type, color), matVeh); this.lo = new THREE.Mesh(vehGeo(type, color, true), matVeh); this.lo.visible = false;
    this.sh = new THREE.Mesh(shadowGeo, shadowMat); this.sh.scale.set(t.W + .5, 1, t.L + .4); this.sh.position.y = .08;
    this.hi.castShadow = G.Q.shadow > 0; this.mesh.add(this.hi, this.lo, this.sh); this.mesh.rotation.order = 'YXZ';
    G.scene.add(this.mesh); this.sync(0);
  }
  update(dt) {
    const t = this.t; const thr = this.dead ? 0 : this.thr, st = this.dead ? 0 : this.steer;
    if (thr > 0) { if (this.speed < 0) this.speed += 22 * thr * dt; else this.speed += t.acc * thr * dt * (1 - this.speed / t.max * .7); }
    else if (thr < 0) { if (this.speed > .3) this.speed += 24 * thr * dt; else if (!this.noRev) this.speed += t.acc * .7 * thr * dt; else this.speed = 0; }
    this.speed -= this.speed * (.12 + (thr === 0 ? .4 : 0) + (this.dead ? 1.5 : 0)) * dt;
    if (this.hb) this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 15 * dt);
    this.speed = clamp(this.speed, -t.max * .35, t.max);
    const sp = Math.abs(this.speed), f = clamp(sp / 5, 0, 1) * (1 - .5 * clamp(sp / t.max, 0, 1));
    this.h += st * 1.9 * f * dt * (this.speed >= 0 ? 1 : -1) * (this.hb ? 1.35 : 1);
    const fx = Math.sin(this.h), fz = Math.cos(this.h), k = 1 - Math.exp(-(this.hb ? 2.2 : 7) * dt);
    this.vx += (fx * this.speed - this.vx) * k; this.vz += (fz * this.speed - this.vz) * k;
    this.x += this.vx * dt; this.z += this.vz * dt;
    this.x = clamp(this.x, BOUNDS.x0, BOUNDS.x1); this.z = clamp(this.z, BOUNDS.z0, BOUNDS.z1);
    // static world
    for (const s of [1, -1]) {
      _o.x = this.x + fx * this.co * s; _o.z = this.z + fz * this.co * s; const ox = _o.x, oz = _o.z;
      if (collide(_o, this.cr)) {
        this.x += _o.x - ox; this.z += _o.z - oz;
        const vn = this.vx * hit.nx + this.vz * hit.nz;
        if (vn < 0) { this.vx -= hit.nx * vn * 1.35; this.vz -= hit.nz * vn * 1.35; this.speed = this.vx * fx + this.vz * fz; if (-vn > 5) this.damage((-vn - 5) * 2.2); }
      }
    }
  }
  damage(a) {
    if (this.dead) return;
    this.hp -= a;
    if (G.player && G.player.veh === this) G.onPlayerCrash(a);
    if (this.hp <= 0) { this.hp = 0; this.dead = true; if (this.ai && !this.ai.flee) this.ai = null; }
  }
  sync(d) {
    const m = this.mesh; m.position.set(this.x, .13, this.z); m.rotation.set(0, this.h, clamp(-this.steer * this.speed * .004, -.07, .07));
    const far = d > G.Q.lod; this.hi.visible = !far; this.lo.visible = far; this.sh.visible = !far && !G.Q.shadow; m.visible = d < G.Q.far;
  }
  remove() { G.scene.remove(this.mesh); const i = G.vehicles.indexOf(this); if (i >= 0) G.vehicles.splice(i, 1); }
}

export function spawnVeh(type, x, z, h, color) { const v = new Veh(type, x, z, h, color); G.vehicles.push(v); return v; }

// pairwise vehicle collisions (two circles each)
export function collideVehicles() {
  const vs = G.vehicles;
  for (let i = 0; i < vs.length; i++) for (let j = i + 1; j < vs.length; j++) {
    const a = vs[i], b = vs[j], dx = b.x - a.x, dz = b.z - a.z, R = a.t.L / 2 + b.t.L / 2 + 1;
    if (dx * dx + dz * dz > R * R) continue;
    const afx = Math.sin(a.h), afz = Math.cos(a.h), bfx = Math.sin(b.h), bfz = Math.cos(b.h);
    for (const sa of [1, -1]) for (const sb of [1, -1]) {
      const ax = a.x + afx * a.co * sa, az = a.z + afz * a.co * sa, bx = b.x + bfx * b.co * sb, bz = b.z + bfz * b.co * sb;
      let nx = bx - ax, nz = bz - az; const d = Math.hypot(nx, nz), min = a.cr + b.cr;
      if (d >= min || d < 1e-4) continue;
      nx /= d; nz /= d; const pen = min - d, ma = a.mass, mb = b.mass, tot = ma + mb;
      a.x -= nx * pen * mb / tot; a.z -= nz * pen * mb / tot; b.x += nx * pen * ma / tot; b.z += nz * pen * ma / tot;
      const vrel = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
      if (vrel < 0) {
        const jimp = -1.25 * vrel;
        a.vx -= nx * jimp * mb / tot; a.vz -= nz * jimp * mb / tot; b.vx += nx * jimp * ma / tot; b.vz += nz * jimp * ma / tot;
        a.speed = a.vx * afx + a.vz * afz; b.speed = b.vx * bfx + b.vz * bfz;
        if (-vrel > 3) { const dmg = (-vrel - 3) * 2.4; a.damage(dmg * mb / tot * 2); b.damage(dmg * ma / tot * 2); if (a.ai) a.ai.shock = 2.5; if (b.ai) b.ai.shock = 2.5; G.chaos = Math.max(G.chaos, 2); }
      }
    }
  }
}

// ---------- AI ----------
function unstick(v, dt) {
  if (v.revT > 0) { v.revT -= dt; v.noRev = false; v.thr = -1; v.steer = v.revS; v.hb = 0; return true; }
  if (Math.abs(v.speed) < 1.2) { v.stuckT += dt; if (v.stuckT > 1.6) { v.stuckT = 0; v.revT = 1.1; v.revS = Math.random() < .5 ? -1 : 1; } } else v.stuckT = 0;
  return false;
}
function blocked(v) {
  const fx = Math.sin(v.h), fz = Math.cos(v.h), reach = 5 + v.t.L / 2 + Math.max(0, v.speed) * .9;
  for (const o of G.vehicles) {
    if (o === v) continue; const dx = o.x - v.x, dz = o.z - v.z, f = dx * fx + dz * fz;
    if (f > 0 && f < reach + o.t.L / 2 && Math.abs(dx * fz - dz * fx) < 1.3 + o.t.W / 2) return true;
  }
  const p = G.player; if (!p.veh) { const dx = p.x - v.x, dz = p.z - v.z, f = dx * fx + dz * fz; if (f > 0 && f < reach && Math.abs(dx * fz - dz * fx) < 1.6) return true; }
  for (const q of G.peds) { if (!q.on || q.state === 'down') continue; const dx = q.x - v.x, dz = q.z - v.z, f = dx * fx + dz * fz; if (f > 0 && f < reach - 1 && Math.abs(dx * fz - dz * fx) < 1.4) return true; }
  return false;
}
function aiLane(v, dt) {
  const ai = v.ai, n = W.nodes, a = n[ai.a], b = n[ai.b], e = edge(ai.a, ai.b); let dx = b.x - a.x, dz = b.z - a.z; const len = Math.hypot(dx, dz) || 1; dx /= len; dz /= len;
  const s = (v.x - a.x) * dx + (v.z - a.z) * dz, junc = b.ub.length >= 3, sw = junc ? b.w / 2 + 2 : Math.min(3, len * .5);
  if (s > len - sw) {
    let opts = b.nb.filter(i => i !== ai.a);
    if (!opts.length) { if (!ai.flee && dist(v.x, v.z, G.pp().x, G.pp().z) > 140) { ai.dead = true; return; } opts = b.ub.filter(i => i !== ai.a); if (!opts.length) opts = [ai.a]; }
    let c = rpick(opts);
    if (ai.flee) { const p = G.pp(); let best = -1e9; for (const o of opts) { const sc = dist(n[o].x, n[o].z, p.x, p.z) + Math.random() * 90; if (sc > best) { best = sc; c = o; } } }
    else if (opts.length > 1 && Math.random() < .62) { let best = -2; for (const o of opts) { const ox = n[o].x - b.x, oz = n[o].z - b.z, ol = Math.hypot(ox, oz) || 1, dt2 = (ox * dx + oz * dz) / ol; if (dt2 > best) { best = dt2; c = o; } } }
    ai.a = ai.b; ai.b = c; return;
  }
  if (ai.flee && unstick(v, dt)) return;
  v.noRev = true;
  const look = 7 + Math.abs(v.speed) * .5, t = Math.min(s + look, len), off = e ? laneOff(e, ai.side || 1) : 3;
  const tx = a.x + dx * t + dz * off, tz = a.z + dz * t - dx * off;
  const d = angDiff(v.h, Math.atan2(tx - v.x, tz - v.z));
  v.steer = clamp(d * 2.2, -1, 1);
  let tgt = ai.cruise;
  if (junc && s > len - 24) tgt = Math.min(tgt, ai.flee ? 11 : 7.5);
  if (Math.abs(d) > .5) tgt = Math.min(tgt, ai.flee ? 9 : 6);
  if (!ai.flee) {
    if (ai.shock > 0) { ai.shock -= dt; tgt = 0; }
    if (b.sig === 1) { const ds = len - s - (b.w / 2 + 2.6); if (ds < 15 && ds > -1 && sigState(b, dx, dz) !== 0) tgt = ds < 3 ? 0 : Math.min(tgt, 4); }
    for (const rb of W.roadblocks) if (Math.abs(v.x - rb.x) < 22 && Math.abs(v.z - rb.z) < 22) tgt = Math.min(tgt, 3.5);
    if (v.type === 'kombi') { ai.stopT -= dt; if (ai.stopT < 0) { if (ai.stopT < -3) ai.stopT = rrand(18, 45); else tgt = 0; } }
    if (blocked(v)) tgt = 0;
  }
  v.thr = clamp((tgt - v.speed) * .6, -1, 1); v.hb = (tgt === 0 && v.speed < .6) ? 1 : 0;
  if (Math.abs(v.speed) < .4) { ai.jam = (ai.jam || 0) + dt; } else ai.jam = 0;
}
// drive to a point using the road graph when far, direct steering when close
function aiSeek(v, dt, tx, tz, cap) {
  if (unstick(v, dt)) return;
  const ai = v.ai, dd = dist(v.x, v.z, tx, tz), n = W.nodes; let gx = tx, gz = tz;
  if (dd > 45) {
    ai.pt = (ai.pt || 0) - dt;
    if (ai.pt <= 0 || !ai.path) { ai.pt = 1.3; ai.path = route(nearestNode(v.x, v.z), nearestNode(tx, tz), false); ai.pi = 0;
      const p = ai.path; if (p && p.length > 1) { const A = n[p[0]], Bn = n[p[1]]; if (dist(v.x, v.z, A.x, A.z) + dist(v.x, v.z, Bn.x, Bn.z) < dist(A.x, A.z, Bn.x, Bn.z) + 4) ai.pi = 1; } }
    const p = ai.path; if (p && p.length) { while (ai.pi < p.length - 1 && dist(v.x, v.z, n[p[ai.pi]].x, n[p[ai.pi]].z) < 11) ai.pi++; gx = n[p[ai.pi]].x; gz = n[p[ai.pi]].z; }
  }
  const d = angDiff(v.h, Math.atan2(gx - v.x, gz - v.z));
  v.steer = clamp(d * 2.5, -1, 1); v.noRev = true; v.hb = 0;
  let tgt = cap; if (Math.abs(d) > .7) tgt = Math.min(tgt, 8); if (dd < 14) tgt = Math.min(tgt, ai.mode === 'pursue' ? G.pspeed() + 2.5 : 4);
  v.thr = clamp((tgt - v.speed) * .6, -1, 1);
}
export function updateAI(v, dt) {
  const ai = v.ai; if (!ai || v.dead) { if (!ai && G.player.veh !== v) { v.thr = 0; v.steer = 0; v.hb = 1; } return; }
  if (ai.mode === 'lane') aiLane(v, dt);
  else if (ai.mode === 'pursue') { const p = G.pp(); aiSeek(v, dt, p.x, p.z, G.player.wanted >= 3 ? v.t.max : v.t.max * .8); }
  else if (ai.mode === 'goto') aiSeek(v, dt, ai.tx, ai.tz, ai.cap || 15);
  else { v.thr = 0; v.steer = 0; v.hb = 1; }
}
// put a vehicle back on the road graph as ordinary traffic
export function toLane(v, cruise) {
  const a = nearestNode(v.x, v.z), nb = W.nodes[a].nb.length ? W.nodes[a].nb : W.nodes[a].ub; let b = nb[0], bd = -2; const fx = Math.sin(v.h), fz = Math.cos(v.h);
  for (const o of nb) { const ox = W.nodes[o].x - v.x, oz = W.nodes[o].z - v.z, l = Math.hypot(ox, oz) || 1, d = (ox * fx + oz * fz) / l; if (d > bd) { bd = d; b = o; } }
  v.ai = { mode: 'lane', a, b, cruise: cruise || rrand(9, 13), stopT: rrand(10, 40), side: Math.random() < .5 ? 1 : -1 }; v.keep = false;
}
export function lanePose(a, b, along, side = 1) {
  const A = W.nodes[a], Bn = W.nodes[b], e = edge(a, b); let dx = Bn.x - A.x, dz = Bn.z - A.z; const len = Math.hypot(dx, dz) || 1; dx /= len; dz /= len;
  const t = Math.max(0, Math.min(along, len - 6)), off = e ? laneOff(e, side) : 3;
  return { x: A.x + dx * t + dz * off, z: A.z + dz * t - dx * off, h: Math.atan2(dx, dz) };
}
