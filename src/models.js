import { THREE, GB } from './util.js';

// Vehicle types. L/W/H metres, max m/s, acc m/s², hp = toughness.
export const VT = {
  kombi:   { name: 'Kombi', kind: 'van', L: 5.0, W: 1.9, H: 2.0, max: 27, acc: 8, hp: 140, job: 'Kombi run', colors: [0xf4f4f0, 0xe8e8e2, 0xdfe6ee, 0xf1ead8] },
  fit:     { name: 'Mushikashika hatchback', kind: 'hatch', L: 3.9, W: 1.7, H: 1.5, max: 31, acc: 11, hp: 90, job: 'Mushikashika pickups', colors: [0xb8bcc2, 0x3d5a80, 0x8d99ae, 0x7d1d1d, 0xe8e8e8, 0x2f3b45] },
  sedan:   { name: 'Sedan', kind: 'sedan', L: 4.5, W: 1.8, H: 1.45, max: 32, acc: 10, hp: 100, colors: [0x8a8f98, 0x1f2a44, 0xd8d8d8, 0x5b1a1a, 0x23402f, 0xc9b78c] },
  ehail:   { name: 'Handei Ride (e-hailing)', kind: 'hatch', L: 3.8, W: 1.7, H: 1.5, max: 31, acc: 11, hp: 95, job: 'E-hailing trip', colors: [0xf2f2f2, 0xd9dde2] },
  taxi:    { name: 'Metered taxi', kind: 'sedan', L: 4.5, W: 1.8, H: 1.45, max: 31, acc: 10, hp: 105, job: 'Taxi fare', colors: [0xf5f5f0] },
  pickup:  { name: 'Bakkie', kind: 'pickup', L: 5.1, W: 1.85, H: 1.75, max: 30, acc: 9, hp: 130, colors: [0xe6e6e6, 0x6e6e6e, 0x1d3557, 0x8a5a2b] },
  boss:    { name: 'Twin-cab', kind: 'pickup', L: 5.2, W: 1.9, H: 1.8, max: 33, acc: 12, hp: 220, colors: [0x101114] },
  police:  { name: 'ZRP patrol car', kind: 'sedan', L: 4.6, W: 1.8, H: 1.45, max: 36, acc: 13, hp: 170, colors: [0xf7f7f7] },
  army:    { name: 'Army truck', kind: 'truck', L: 7.0, W: 2.4, H: 2.9, max: 24, acc: 6.5, hp: 340, colors: [0x55603c] },
  council: { name: 'City Council truck', kind: 'truck', L: 6.0, W: 2.3, H: 2.6, max: 24, acc: 7, hp: 230, colors: [0xf0f0ea] },
  ambulance: { name: 'Ambulance', kind: 'van', L: 5.3, W: 2.0, H: 2.3, max: 33, acc: 10, hp: 170, job: 'Ambulance call-out', colors: [0xfafafa] },
  bus:     { name: 'City bus', kind: 'bus', L: 11, W: 2.5, H: 3.1, max: 21, acc: 5, hp: 320, colors: [0xf2f2f2, 0xe9edf5] },
};
for (const k in VT) VT[k].id = k;

const GL = 0x1b2733, TY = 0x121212, LT = 0xfff3c0, RD = 0xb31717, STR = [0x1f6fd1, 0xc62828, 0x1e8e4e, 0xf2a900];
const cache = {};
export const matVeh = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .55, metalness: .18 });

export function vehGeo(type, color, lo) {
  const k = type + ':' + color + (lo ? 'L' : 'H');
  return cache[k] || (cache[k] = build(type, color, lo));
}

function build(type, col, lo) {
  const t = VT[type], { L, W, H } = t, g = new GB();
  const tall = t.kind === 'van' || t.kind === 'bus' || t.kind === 'truck';
  if (lo) {                     // LOD1: two boxes
    if (tall) g.box(0, .4, 0, W, H - .4, L, type === 'army' ? 0x4d5a3a : col);
    else { g.box(0, .3, 0, W, H * .45, L, col); g.box(0, .3 + H * .45, -L * .06, W * .88, H * .38, L * .55, GL); }
    return g.build();
  }
  const wheels = (zf, zr, r = .36) => { for (const s of [-1, 1]) for (const z of [zf, zr]) g.wheel(s * (W / 2 - .08), r, z, r, .28, TY); };
  const lights = (y) => {
    for (const s of [-1, 1]) { g.box(s * (W / 2 - .3), y, L / 2, .34, .16, .08, LT); g.box(s * (W / 2 - .3), y, -L / 2, .34, .16, .08, RD); }
    g.box(0, .32, L / 2 + .04, W * .96, .2, .12, 0x2a2a2a); g.box(0, .32, -L / 2 - .04, W * .96, .2, .12, 0x2a2a2a);
  };
  const stripe = STR[(col >> 4) % 4];
  if (t.kind === 'van') {
    g.box(0, .35, -.25, W, H - .35, L - .5, col); g.box(0, .35, L / 2 - .3, W, .75, .6, col); g.trap(0, 1.1, L / 2 - .3, W, H - 1.1, .6, col, .25, -.37, .96);
    g.box(0, 1.2, -.3, W + .04, .55, L * .7, GL);
    g.trap(0, 1.12, L / 2 - .27, W * .9, H - 1.25, .6, GL, .25, -.37, .94);
    g.box(0, 1.2, -L / 2 + .02, W * .8, .5, .1, GL);
    g.box(0, .82, 0, W + .05, .16, L * .97, stripe);
    if (type === 'ambulance') { g.box(0, 1.15, 0, W + .06, .2, L * .97, 0xd32f2f); g.box(-.3, H, L * .3, .5, .16, .3, 0xff2020); g.box(.3, H, L * .3, .5, .16, .3, 0x1e50ff);
      for (const s of [-1, 1]) { g.box(s * (W / 2 + .02), 1.45, -L * .22, .04, .5, .16, 0xd32f2f); g.box(s * (W / 2 + .02), 1.62, -L * .22, .04, .16, .5, 0xd32f2f); } }
    else { g.box(0, H, -.3, W * .82, .05, L * .56, 0x333333);
    g.box(-.25, H + .05, -.7, .9, .34, .7, 0x7a4b2a); g.box(.3, H + .05, .2, .6, .26, .8, 0x2f5d8a); g.box(-.3, H + .05, .35, .5, .3, .5, 0xb23a48); }
    wheels(L * .32, -L * .32); lights(.7);
  } else if (t.kind === 'hatch' || t.kind === 'sedan') {
    const cl = t.kind === 'hatch' ? .6 : .48, cz = t.kind === 'hatch' ? -L * .09 : -L * .04;
    g.box(0, .3, 0, W, .5, L, col); g.trap(0, .8, 0, W, .14, L, col, .97, 0, .96);
    const hb = t.kind === 'hatch';
    g.trap(0, .93, cz, W * .93, .5, L * cl, GL, hb ? .7 : .62, hb ? -.07 : -.02, .86);
    g.box(0, 1.43, cz + (hb ? -.07 : -.02) * L * cl, W * .8, .05, L * cl * (hb ? .7 : .62), col);
    for (const s of [-1, 1]) { g.box(s * (W / 2 - .02), .52, L * .31, .08, .34, .82, 0x1c1c1c); g.box(s * (W / 2 - .02), .52, -L * .31, .08, .34, .82, 0x1c1c1c); g.box(s * (W / 2 + .06), .98, cz + L * cl * .3, .1, .1, .16, col); }
    wheels(L * .31, -L * .31); lights(.66);
    if (type === 'taxi') { g.box(0, 1.47, cz, .55, .2, .26, 0xffd21f); g.box(0, .5, 0, W + .04, .16, L * .92, 0xffd21f); }
    if (type === 'ehail') { g.box(0, .5, 0, W + .04, .14, L * .92, 0x19b36b); g.box(0, 1.47, cz + .3, .3, .12, .2, 0x19b36b); }
    if (type === 'police') {
      g.box(0, .48, 0, W + .04, .18, L * .94, 0x1c3f94); g.box(0, .68, 0, W + .04, .07, L * .94, 0xf2c300);
      g.box(-.28, 1.47, cz, .45, .15, .26, 0x1e50ff); g.box(.28, 1.47, cz, .45, .15, .26, 0xff2020);
    }
  } else if (t.kind === 'pickup') {
    g.box(0, .42, 0, W, .62, L, col);
    g.trap(0, 1.04, L * .1, W * .93, .58, L * .38, GL, .74, -.03, .88);
    g.box(0, 1.62, L * .1 - .03 * L * .38, W * .82, .06, L * .38 * .74, col);
    for (const s of [-1, 1]) g.box(s * (W / 2 - .05), 1.04, -L * .28, .1, .36, L * .4, col);
    g.box(0, 1.04, -L / 2 + .05, W, .36, .1, col);
    if (type === 'boss') { g.box(0, .5, L / 2 + .12, W * .9, .5, .12, 0x9a9a9a); g.box(0, 1.66, L * .1, W * .7, .1, .2, 0xffd21f); }
    wheels(L * .32, -L * .32, .42); lights(.82);
  } else if (t.kind === 'truck') {
    g.box(0, .55, 0, W * .8, .3, L, 0x222222);
    g.box(0, .85, L / 2 - 1, W, 1.5, 1.9, col);
    g.box(0, 1.62, L / 2 - .04, W * .86, .58, .1, GL);
    for (const s of [-1, 1]) g.box(s * (W / 2), 1.62, L / 2 - 1, .06, .5, 1.1, GL);
    if (type === 'army') { g.box(0, .85, -.95, W, H - .85, L - 2.1, 0x4d5a3a); g.box(0, H - .02, -.95, W * .7, .08, L - 2.4, 0x444f33); }
    else { g.box(0, .85, -.95, W, 1.5, L - 2.1, 0xe07b1a); g.box(0, 1.5, -.95, W + .04, .22, L - 2.2, 0x1f6fd1); }
    for (const s of [-1, 1]) for (const z of [L / 2 - 1, -L * .2, -L * .38]) g.wheel(s * (W / 2 - .1), .5, z, .5, .34, TY);
    lights(1.0);
  } else {   // bus
    g.box(0, .45, 0, W, H - .45, L, col);
    g.box(0, 1.6, 0, W + .04, .85, L * .92, GL);
    g.box(0, 1.05, 0, W + .05, .26, L * .98, 0x1f6fd1); g.box(0, .8, 0, W + .05, .1, L * .98, 0xf2c300);
    g.box(0, 1.5, L / 2 - .04, W * .9, 1.1, .12, GL);
    for (const s of [-1, 1]) for (const z of [L * .33, -L * .3]) g.wheel(s * (W / 2 - .1), .5, z, .5, .34, TY);
    lights(.9);
  }
  return g.build();
}
