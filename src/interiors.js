// Playable building interiors — door → walk inside → exit.
import { THREE, clamp, dist } from './util.js';

const mat = (c, rough = .85) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: .02 });

function boxMesh(w, h, d, c, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof c === 'number' ? mat(c) : c);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}

function buildApartment(root) {
  boxMesh(12, .2, 10, 0x6b5a45, 0, .1, 0, root);
  boxMesh(12, .15, 10, 0xe8e0d4, 0, 3.1, 0, root);
  boxMesh(12.2, 3, .25, 0xe5dcc8, 0, 1.55, -5, root);
  boxMesh(12.2, 3, .25, 0xe5dcc8, 0, 1.55, 5, root);
  boxMesh(.25, 3, 10.2, 0xe5dcc8, -6, 1.55, 0, root);
  boxMesh(.25, 3, 10.2, 0xe5dcc8, 6, 1.55, 0, root);
  boxMesh(.2, 3, 5.5, 0xddd4c0, 1.2, 1.55, -2.2, root);
  boxMesh(2.4, .55, .9, 0x2c3e50, -2.5, .4, 2.2, root);
  boxMesh(2.4, .35, .25, 0x1a252f, -2.5, .85, 2.55, root);
  boxMesh(1.2, .08, .7, 0x5d4037, -2.5, .55, .8, root);
  boxMesh(1.4, .7, .35, 0x263238, 3.5, .45, -3.8, root);
  boxMesh(1.1, .65, .05, 0x111111, 3.5, 1.2, -3.95, root);
  boxMesh(3.2, .9, .7, 0xcfd8dc, -3.8, .55, -3.6, root);
  boxMesh(.7, .9, .7, 0xb0bec5, -1.8, .55, -3.6, root);
  boxMesh(2, .4, 2.4, 0x5d4037, 3.8, .35, 2.5, root);
  boxMesh(1.9, .2, 2.2, 0xd7ccc8, 3.8, .6, 2.5, root);
  boxMesh(1.1, 2.2, .08, 0x4e342e, 0, 1.2, 4.88, root);
  const lamp = new THREE.PointLight(0xffe0b2, 1.15, 14); lamp.position.set(0, 2.6, 0); root.add(lamp);
}

function buildShop(root) {
  boxMesh(10, .2, 8, 0x78909c, 0, .1, 0, root);
  boxMesh(10, .15, 8, 0xeceff1, 0, 3.1, 0, root);
  boxMesh(10.2, 3, .25, 0xfff8e1, 0, 1.55, -4, root);
  boxMesh(10.2, 3, .25, 0xfff8e1, 0, 1.55, 4, root);
  boxMesh(.25, 3, 8.2, 0xfff8e1, -5, 1.55, 0, root);
  boxMesh(.25, 3, 8.2, 0xfff8e1, 5, 1.55, 0, root);
  for (const z of [-2, 0, 2]) {
    boxMesh(3.5, 1.6, .4, 0x5d4037, -2.5, .95, z, root);
    boxMesh(3.5, .05, .38, 0xffecb3, -2.5, .55, z, root);
    boxMesh(3.5, .05, .38, 0xffecb3, -2.5, 1.1, z, root);
  }
  boxMesh(2.2, 1, .7, 0x37474f, 2.8, .6, 2.5, root);
  boxMesh(.4, .35, .4, 0x263238, 2.8, 1.25, 2.5, root);
  boxMesh(.6, .4, .6, 0xc62828, 3.2, .35, -2, root);
  boxMesh(.6, .4, .6, 0xf9a825, 2.4, .35, -2, root);
  boxMesh(1.1, 2.2, .08, 0x4e342e, 0, 1.2, 3.88, root);
  const lamp = new THREE.PointLight(0xfff3e0, 1.25, 12); lamp.position.set(0, 2.7, 0); root.add(lamp);
}

function buildBank(root) {
  boxMesh(14, .2, 12, 0x546e7a, 0, .1, 0, root);
  boxMesh(14, .15, 12, 0xeceff1, 0, 3.4, 0, root);
  boxMesh(14.2, 3.3, .3, 0xcfd8dc, 0, 1.7, -6, root);
  boxMesh(14.2, 3.3, .3, 0xcfd8dc, 0, 1.7, 6, root);
  boxMesh(.3, 3.3, 12.2, 0xcfd8dc, -7, 1.7, 0, root);
  boxMesh(.3, 3.3, 12.2, 0xcfd8dc, 7, 1.7, 0, root);
  // teller counters
  for (const x of [-3.5, 0, 3.5]) {
    boxMesh(2.4, 1.15, .7, 0x37474f, x, .7, -3.5, root);
    boxMesh(2.2, .08, .6, 0x90a4ae, x, 1.3, -3.5, root);
    boxMesh(.5, .4, .08, 0x263238, x, 1.55, -3.2, root); // screen
  }
  // waiting chairs
  for (const x of [-4, -1.5, 1, 3.5]) boxMesh(.7, .55, .7, 0x1a237e, x, .4, 2.5, root);
  // ATM wall
  boxMesh(1.2, 1.6, .25, 0x212121, -5.2, 1.0, 4.5, root);
  boxMesh(.7, .5, .05, 0x00e676, -5.2, 1.15, 4.62, root);
  // Zimbabwe bird / bank emblem hint
  boxMesh(1.5, 1.5, .08, 0xffc107, 0, 2.2, -5.85, root);
  boxMesh(1.2, 2.3, .1, 0x455a64, 0, 1.25, 5.85, root); // exit door
  const lamp = new THREE.PointLight(0xe3f2fd, 1.35, 18); lamp.position.set(0, 2.9, 0); root.add(lamp);
  const lamp2 = new THREE.PointLight(0xfff8e1, .6, 10); lamp2.position.set(0, 2.5, -3); root.add(lamp2);
}

function buildZrp(root) {
  boxMesh(13, .2, 11, 0x455a64, 0, .1, 0, root);
  boxMesh(13, .15, 11, 0xb0bec5, 0, 3.3, 0, root);
  boxMesh(13.2, 3.2, .28, 0x37474f, 0, 1.65, -5.5, root);
  boxMesh(13.2, 3.2, .28, 0x37474f, 0, 1.65, 5.5, root);
  boxMesh(.28, 3.2, 11.2, 0x37474f, -6.5, 1.65, 0, root);
  boxMesh(.28, 3.2, 11.2, 0x37474f, 6.5, 1.65, 0, root);
  // reception desk
  boxMesh(4, 1.1, .9, 0x1a237e, 0, .65, -2.8, root);
  boxMesh(3.8, .08, .8, 0x283593, 0, 1.25, -2.8, root);
  // holding / interview booths
  boxMesh(.15, 2.4, 3, 0x263238, 3.5, 1.3, 1.5, root);
  boxMesh(.15, 2.4, 3, 0x263238, -3.5, 1.3, 1.5, root);
  boxMesh(2.5, .9, .6, 0x424242, 4.5, .55, 1.5, root);
  boxMesh(2.5, .9, .6, 0x424242, -4.5, .55, 1.5, root);
  // ZRP colours stripe
  boxMesh(12.5, .2, .08, 0x1c3f94, 0, 2.6, -5.35, root);
  boxMesh(12.5, .12, .08, 0xf2c300, 0, 2.4, -5.35, root);
  // notice board
  boxMesh(2.2, 1.4, .06, 0xefebe9, -4, 1.8, -5.2, root);
  // chairs
  for (const x of [-2, 0, 2]) boxMesh(.65, .5, .65, 0x212121, x, .35, 3.2, root);
  boxMesh(1.15, 2.25, .1, 0x1a237e, 0, 1.2, 5.35, root);
  const lamp = new THREE.PointLight(0xcfd8dc, 1.2, 16); lamp.position.set(0, 2.8, 0); root.add(lamp);
  const red = new THREE.PointLight(0xff1744, .35, 8); red.position.set(2, 2.5, -2); root.add(red);
  const blu = new THREE.PointLight(0x2979ff, .35, 8); blu.position.set(-2, 2.5, -2); root.add(blu);
}

const KINDS = {
  apartment: { build: buildApartment, title: "Ngwere's flat", action: null, halfW: 5.6, halfD: 4.6 },
  shop: { build: buildShop, title: 'Corner shop', action: 'shop', halfW: 4.6, halfD: 3.6 },
  bank: { build: buildBank, title: 'CBZ / Reserve Bank hall', action: 'bank', halfW: 6.5, halfD: 5.5 },
  zrp: { build: buildZrp, title: 'Harare Central ZRP', action: 'zrp', halfW: 6.0, halfD: 5.0 },
};

function makeLabel(text) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = 'rgba(8,12,16,.75)'; x.fillRect(0, 0, 256, 64);
  x.fillStyle = '#ffd23f'; x.font = 'bold 28px Arial'; x.textAlign = 'center'; x.fillText(text, 128, 42);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
  m.scale.set(2.4, .6, 1); return m;
}

/** @param {object} PL world places from world.js */
export function placeDoors(scene, PL) {
  const doors = [];
  const spots = [
    { kind: 'apartment', x: (PL.copa?.x ?? -838) + 10, z: (PL.copa?.z ?? 256) + 8, h: 0, label: 'Flat' },
    { kind: 'shop', x: (PL.first?.x ?? PL.town?.x ?? -200) - 6, z: (PL.first?.z ?? PL.town?.z ?? 0) + 8, h: Math.PI, label: 'Shop' },
    { kind: 'bank', x: (PL.rbz?.x ?? -100) + 12, z: (PL.rbz?.z ?? 50) + 10, h: 0, label: 'Bank' },
    { kind: 'zrp', x: (PL.zrp?.x ?? 0) + 8, z: (PL.zrp?.z ?? 0) + 6, h: Math.PI * .25, label: 'ZRP' },
  ];
  for (const s of spots) {
    const g = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.3, .18), mat(0x3e2723, .7));
    frame.position.set(0, 1.15, 0); g.add(frame);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.05, .08), mat(0x5d4037, .65));
    door.position.set(0, 1.1, .08); g.add(door);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(.04, 8, 8), mat(0xc9a227, .4));
    knob.position.set(.35, 1.0, .14); g.add(knob);
    g.position.set(s.x, 0, s.z); g.rotation.y = s.h; scene.add(g);
    const spr = makeLabel(s.label); spr.position.set(s.x, 2.6, s.z); scene.add(spr);
    doors.push({ ...s, mesh: g, label: spr });
  }
  return doors;
}

export function enterInterior(kind, door, scene) {
  const def = KINDS[kind]; if (!def) return null;
  const root = new THREE.Group();
  root.position.set(door.x, 0.02, door.z);
  root.rotation.y = door.h || 0;
  def.build(root);
  scene.add(root);
  const fx = Math.sin(door.h || 0), fz = Math.cos(door.h || 0);
  return {
    kind, title: def.title, root, action: def.action || null, buy: def.action === 'shop',
    halfW: def.halfW, halfD: def.halfD, door,
    spawn: { x: door.x - fx * 1.6, z: door.z - fz * 1.6, h: (door.h || 0) + Math.PI },
  };
}

export function leaveInterior(interior, scene) {
  if (!interior) return;
  scene.remove(interior.root);
  interior.root.traverse(o => {
    o.geometry?.dispose?.();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose?.());
  });
}

export function collideInterior(p, interior) {
  if (!interior) return;
  const h = interior.door.h || 0;
  const fx = Math.sin(h), fz = Math.cos(h), rx = fz, rz = -fx;
  const dx = p.x - interior.door.x, dz = p.z - interior.door.z;
  let localX = dx * rx + dz * rz;
  let localZ = dx * fx + dz * fz;
  localX = clamp(localX, -interior.halfW, interior.halfW);
  localZ = clamp(localZ, -interior.halfD, 0.35);
  p.x = interior.door.x + localX * rx + localZ * fx;
  p.z = interior.door.z + localX * rz + localZ * fz;
}

export function nearDoor(doors, x, z, r = 2.4) {
  let best = null, bd = r;
  for (const d of doors) {
    const dd = dist(d.x, d.z, x, z);
    if (dd < bd) { bd = dd; best = d; }
  }
  return best;
}

/** Simple dashboard / wheel attached to a vehicle mesh for cockpit view. */
export function attachCockpit(veh) {
  if (veh.cockpit) return veh.cockpit;
  const g = new THREE.Group();
  const dash = new THREE.Mesh(new THREE.BoxGeometry(veh.t.W * .85, .12, .35), mat(0x1a1a1a, .55));
  dash.position.set(0, veh.t.H * .55, veh.t.L * .12); g.add(dash);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(.18, .03, 8, 16), mat(0x222222, .4));
  wheel.rotation.x = Math.PI / 2; wheel.position.set(-veh.t.W * .18, veh.t.H * .48, veh.t.L * .05); g.add(wheel);
  const cluster = new THREE.Mesh(new THREE.BoxGeometry(.35, .12, .02), mat(0x0d47a1, .3));
  cluster.position.set(0, veh.t.H * .58, veh.t.L * .28); g.add(cluster);
  veh.mesh.add(g); veh.cockpit = g; g.visible = false; return g;
}
