// High-detail procedural Ngwere mesh (Three.js “AAA-lite”).
// Outfit locked to turnaround: flag cap, black hoodie + yellow stripes/logo, cargo joggers, black-yellow highs, backpack, watch.
import { THREE } from './util.js';

const BLK = 0x141416, YEL = 0xf2b90f, SK = 0x6a4530, LOC = 0x19110b, PANT = 0x1a1a1e, WHT = 0xf4f4f4;

function std(c, rough = .72, metal = .03, emis = 0, emisI = 0) {
  return new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal, emissive: emis, emissiveIntensity: emisI });
}

function tex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

/** Build Ngwere group + animatable parts. */
export function makeNgwere() {
  const g = new THREE.Group();
  const mats = {};
  const mat = c => mats[c] || (mats[c] = std(c, c === SK ? .55 : .75, c === SK ? .02 : .04, c === SK ? 0x1a0f0a : 0, c === SK ? .1 : 0));
  const add = (geo, m, x, y, z, parent) => {
    const o = new THREE.Mesh(geo, typeof m === 'number' ? mat(m) : m);
    o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; (parent || g).add(o); return o;
  };
  const cap = (r, len, sx = 1, sz = 1) => new THREE.CapsuleGeometry(r, len, 8, 16).scale(sx, 1, sz);
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const sph = (r, sx = 1, sy = 1, sz = 1) => new THREE.SphereGeometry(r, 28, 20).scale(sx, sy, sz);
  const grp = (x, y, z, parent) => { const o = new THREE.Group(); o.position.set(x, y, z); (parent || g).add(o); return o; };

  // Face albedo — higher detail
  const face = tex(1024, 512, x => {
    x.fillStyle = '#6a4530'; x.fillRect(0, 0, 1024, 512);
    const cx = 256;
    // pores / tone variation
    for (let i = 0; i < 900; i++) {
      x.fillStyle = `rgba(${40 + Math.random() * 30},${20 + Math.random() * 20},${10},0.04)`;
      x.fillRect(cx - 90 + Math.random() * 180, 60 + Math.random() * 200, 2, 2);
    }
    x.fillStyle = 'rgba(0,0,0,.14)'; x.fillRect(cx - 70, 280, 140, 90);
    x.fillStyle = 'rgba(255,220,190,.08)'; x.fillRect(cx - 40, 120, 80, 70);
    for (const s of [-1, 1]) {
      x.fillStyle = '#f3efe8'; x.beginPath(); x.ellipse(cx + s * 32, 200, 14, 8, 0, 0, 6.3); x.fill();
      x.fillStyle = '#2a1a10'; x.beginPath(); x.arc(cx + s * 32, 200, 6.5, 0, 6.3); x.fill();
      x.fillStyle = '#0c0806'; x.beginPath(); x.arc(cx + s * 32, 200, 3, 0, 6.3); x.fill();
      x.strokeStyle = '#1a100a'; x.lineWidth = 7; x.lineCap = 'round';
      x.beginPath(); x.moveTo(cx + s * 14, 178); x.quadraticCurveTo(cx + s * 32, 168, cx + s * 50, 180); x.stroke();
    }
    x.strokeStyle = 'rgba(30,15,8,.55)'; x.lineWidth = 4;
    x.beginPath(); x.moveTo(cx - 5, 210); x.lineTo(cx - 10, 255); x.quadraticCurveTo(cx, 265, cx + 10, 255); x.stroke();
    x.fillStyle = '#4a2a22'; x.beginPath(); x.ellipse(cx, 300, 22, 8, 0, 0, 6.3); x.fill();
    x.strokeStyle = '#2e1812'; x.lineWidth = 3; x.beginPath(); x.moveTo(cx - 20, 298); x.quadraticCurveTo(cx, 305, cx + 20, 298); x.stroke();
  });

  const head = grp(0, 1.62, 0);
  add(new THREE.SphereGeometry(.122, 36, 28).scale(.92, 1.14, 1.02), new THREE.MeshStandardMaterial({
    map: face, roughness: .48, metalness: .02, emissive: 0xffffff, emissiveMap: face, emissiveIntensity: .14,
  }), 0, 0, 0, head);
  for (const s of [-1, 1]) add(sph(.032, .55, 1.05, .85), SK, s * .112, -.008, .01, head);
  add(new THREE.CylinderGeometry(.052, .06, .11, 16), SK, 0, 1.49, 0);

  // Cap + brim + Zimbabwe flag
  add(new THREE.SphereGeometry(.132, 28, 14, 0, 6.3, 0, Math.PI / 2).scale(.96, .82, 1.04), 0x0a0a0c, 0, .065, 0, head);
  add(new THREE.CylinderGeometry(.126, .126, .03, 24).scale(1, 1, 1.04), 0x0a0a0c, 0, .058, 0, head);
  add(new THREE.CylinderGeometry(.108, .108, .016, 22, 1, false, -Math.PI / 2, Math.PI).scale(1, 1, 1.28), 0x0a0a0c, 0, .052, .078, head).castShadow = false;
  const flagT = tex(128, 80, x => {
    ['#1e8e4e', '#f2c300', '#c62828', '#111', '#c62828', '#f2c300', '#1e8e4e'].forEach((c, i) => { x.fillStyle = c; x.fillRect(0, i * 80 / 7, 128, 80 / 7 + 1); });
    x.fillStyle = '#fff'; x.beginPath(); x.moveTo(0, 0); x.lineTo(40, 40); x.lineTo(0, 80); x.fill();
    x.fillStyle = '#f2c300'; x.beginPath(); x.moveTo(10, 28); x.lineTo(22, 40); x.lineTo(10, 52); x.lineTo(4, 40); x.fill();
  });
  const fp = add(new THREE.PlaneGeometry(.075, .048), new THREE.MeshStandardMaterial({ map: flagT, roughness: .55 }), 0, .118, .132, head);
  fp.rotation.x = -.28;

  // Locs
  for (let i = 0; i < 18; i++) {
    const th = Math.PI * (-.08 + i * 1.16 / 17), ln = .14 + (i % 5) * .032;
    const o = add(cap(.015, ln), LOC, Math.cos(th) * .115, -.02 - ln / 2, -Math.sin(th) * .115 - .01, head);
    o.rotation.z = Math.cos(th) * .2; o.rotation.x = Math.sin(th) * .15;
  }

  // Hoodie torso
  add(cap(.178, .36, 1.18, .82), BLK, 0, 1.16, 0);
  add(sph(.155, 1.18, .65, .88), BLK, 0, 1.46, -.09);
  add(new THREE.CylinderGeometry(.205, .205, .055, 20).scale(1.2, 1, .82), WHT, 0, .84, 0);
  add(new THREE.CylinderGeometry(.21, .215, .1, 20).scale(1.2, 1, .82), 0x101012, 0, .91, 0);
  add(box(.28, .14, .035), 0x1c1c20, 0, 1.0, .16);
  const logoT = tex(512, 192, x => {
    x.clearRect(0, 0, 512, 192);
    x.fillStyle = '#f2b90f'; x.font = 'italic 900 110px Georgia, "Segoe Script", serif';
    x.textAlign = 'center'; x.fillText('Ngwere', 256, 130);
  });
  add(new THREE.PlaneGeometry(.38, .14), new THREE.MeshStandardMaterial({ map: logoT, transparent: true, roughness: .45 }), 0, 1.25, .168);
  for (const s of [-1, 1]) {
    add(new THREE.CylinderGeometry(.007, .007, .22, 6), YEL, s * .048, 1.34, .17);
    add(box(.05, .48, .022), 0x0c0c0e, s * .155, 1.2, .155).rotation.z = s * .05;
  }

  // Backpack (layered)
  add(cap(.13, .22, 1.35, .78), 0x0e0e10, 0, 1.16, -.235);
  add(box(.22, .14, .04), 0x18181c, 0, 1.08, -.34);
  add(box(.08, .03, .012), 0x9a9a9a, 0, 1.22, -.342);
  for (const s of [-1, 1]) add(box(.04, .55, .03), 0x1a1a1e, s * .12, 1.25, -.12);

  // Arms
  const arm = s => {
    const sh = grp(s * .26, 1.4, 0);
    add(cap(.062, .22), BLK, 0, -.16, 0, sh);
    add(box(.016, .34, .058), YEL, s * .058, -.17, 0, sh);
    add(sph(.066, 1, .88, 1), BLK, -s * .012, -.01, 0, sh);
    const el = grp(0, -.32, 0, sh);
    add(cap(.054, .12), BLK, 0, -.08, 0, el);
    add(box(.016, .15, .052), YEL, s * .052, -.08, 0, el);
    add(new THREE.CylinderGeometry(.058, .058, .038, 12), 0x121214, 0, -.16, 0, el);
    add(cap(.042, .11), SK, 0, -.23, 0, el);
    add(sph(.048, .85, 1.2, 1.05), SK, 0, -.34, .008, el);
    if (s < 0) add(new THREE.CylinderGeometry(.048, .048, .032, 12), 0x0a0a0a, 0, -.28, 0, el); // watch
    return [sh, el];
  };

  // Legs
  const leg = s => {
    const hip = grp(s * .105, .88, 0);
    add(cap(.09, .28), PANT, 0, -.21, 0, hip);
    add(box(.04, .16, .13), 0x222226, s * .095, -.28, 0, hip);
    add(box(.042, .035, .135), 0x2c2c31, s * .095, -.2, 0, hip);
    if (s < 0) {
      const f = add(new THREE.PlaneGeometry(.055, .034), new THREE.MeshStandardMaterial({ map: flagT, roughness: .55 }), s * .118, -.28, 0, hip);
      f.rotation.y = -Math.PI / 2;
    }
    const kn = grp(0, -.44, 0, hip);
    add(cap(.074, .26), PANT, 0, -.19, 0, kn);
    add(new THREE.CylinderGeometry(.07, .064, .055, 12), 0x121214, 0, -.38, 0, kn);
    // Jordan-like highs
    add(new THREE.CylinderGeometry(.06, .064, .09, 12), 0x0a0a0c, 0, -.41, -.005, kn);
    add(box(.1, .09, .26), 0x0a0a0c, 0, -.425, .055, kn);
    add(box(.102, .058, .095), YEL, 0, -.44, .14, kn);
    add(box(.104, .052, .105), YEL, 0, -.415, -.035, kn);
    add(box(.102, .032, .065), YEL, 0, -.39, .065, kn);
    add(box(.108, .026, .28), 0xf6f6f2, 0, -.475, .055, kn);
    add(box(.11, .014, .285), YEL, 0, -.492, .055, kn);
    return [hip, kn];
  };

  const [aL, eL] = arm(-1), [aR, eR] = arm(1), [lL, kL] = leg(-1), [lR, kR] = leg(1);
  return { group: g, parts: { legL: lL, legR: lR, armL: aL, armR: aR, kL, kR, eL, eR, head } };
}
