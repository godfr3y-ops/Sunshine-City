// Converts the raw OpenStreetMap extract (© OpenStreetMap contributors, ODbL) into the compact city data the game ships.
// usage: node tools/prep.mjs <osm_cbd.json> <suburbs-data.js>
import fs from 'node:fs';
const [cbdPath, subPath] = process.argv.slice(2);
const osm = JSON.parse(fs.readFileSync(cbdPath, 'utf8'));
const subSrc = fs.readFileSync(subPath, 'utf8'); const SUB = JSON.parse(subSrc.slice(subSrc.indexOf('{'), subSrc.lastIndexOf('}') + 1));
// local metres: x east, z south, origin Africa Unity Square
const LAT0 = -17.8295, LON0 = 31.0518, A = 6378137, E2 = 6.69437999014e-3, S0 = Math.sin(LAT0 * Math.PI / 180);
const KX = Math.PI / 180 * A / Math.sqrt(1 - E2 * S0 * S0) * Math.cos(LAT0 * Math.PI / 180), KY = Math.PI / 180 * A * (1 - E2) / Math.pow(1 - E2 * S0 * S0, 1.5);
const nodes = new Map(), ways = new Map(), rels = [];
for (const e of osm.elements) { if (e.type === 'node') { if (!nodes.has(e.id) || e.tags) nodes.set(e.id, e); } else if (e.type === 'way') { if (!ways.has(e.id) || e.tags) ways.set(e.id, e); } else rels.push(e); }
const xy = id => { const n = nodes.get(id); return n ? [(n.lon - LON0) * KX, -(n.lat - LAT0) * KY] : null; };
const pts = w => w.nodes.map(xy).filter(Boolean);
const CBD = [-2523, -1826, 1399, 1383], SOUTH = [-2700, 1383, -80, 3350];
const inB = (p, b) => p[0] >= b[0] && p[0] <= b[2] && p[1] >= b[1] && p[1] <= b[3];
function clip(line, b) {   // returns runs of the polyline inside box b
  const out = []; let cur = null;
  const cross = (p, q) => { let t0 = 0, t1 = 1; const d = [q[0] - p[0], q[1] - p[1]];
    for (const [pp, qq] of [[-d[0], p[0] - b[0]], [d[0], b[2] - p[0]], [-d[1], p[1] - b[1]], [d[1], b[3] - p[1]]]) { if (pp === 0) { if (qq < 0) return null; } else { const r = qq / pp; if (pp < 0) { if (r > t1) return null; if (r > t0) t0 = r; } else { if (r < t0) return null; if (r < t1) t1 = r; } } }
    return [[p[0] + d[0] * t0, p[1] + d[1] * t0], [p[0] + d[0] * t1, p[1] + d[1] * t1], t0 > 0, t1 < 1]; };
  for (let i = 0; i < line.length - 1; i++) { const c = cross(line[i], line[i + 1]); if (!c) { if (cur) { out.push(cur); cur = null; } continue; }
    if (!cur || c[2]) { if (cur) out.push(cur); cur = [c[0]]; } cur.push(c[1]); if (c[3]) { out.push(cur); cur = null; } }
  if (cur) out.push(cur); return out.filter(r => r.length > 1);
}
function rdp(p, eps) { if (p.length < 3) return p; let dm = 0, ix = 0; const [ax, az] = p[0], [bx, bz] = p[p.length - 1], dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz) || 1;
  for (let i = 1; i < p.length - 1; i++) { const d = Math.abs((p[i][0] - ax) * dz - (p[i][1] - az) * dx) / len; if (d > dm) { dm = d; ix = i; } }
  return dm <= eps ? [p[0], p[p.length - 1]] : rdp(p.slice(0, ix + 1), eps).slice(0, -1).concat(rdp(p.slice(ix), eps)); }
function rdpRing(r, eps) { if (r.length < 5) return r; let k = 0, dm = 0; for (let i = 1; i < r.length; i++) { const d = Math.hypot(r[i][0] - r[0][0], r[i][1] - r[0][1]); if (d > dm) { dm = d; k = i; } }
  return rdp(r.slice(0, k + 1), eps).slice(0, -1).concat(rdp(r.slice(k).concat([r[0]]), eps).slice(0, -1)); }
const area = r => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]); return a / 2; };
const cen = r => [r.reduce((s, p) => s + p[0], 0) / r.length, r.reduce((s, p) => s + p[1], 0) / r.length];
const hash = (x, z) => { let h = Math.imul(Math.round(x * 7) | 0, 73856093) ^ Math.imul(Math.round(z * 7) | 0, 19349663); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const names = [], nameIx = new Map(), nm = s => { if (!s) return -1; s = s.replace(/\s+/g, ' ').trim(); if (!nameIx.has(s)) { nameIx.set(s, names.length); names.push(s); } return nameIx.get(s); };
const fixName = s => s && s.replace('Keneth', 'Kenneth').replace('Steet', 'Street').replace(/ \(2nd St\. Extension\)| \(2nd Street\)| \(Union\)/, '').replace('Fourth Street/ S.V Muzenda', 'Simon Muzenda (Fourth) Street').replace('Harare street', 'Harare Street').replace('Weale road', 'Weale Road');

// ---------------- roads ----------------
const CLS = { trunk: 0, primary: 1, secondary: 2, tertiary: 3, unclassified: 4, residential: 4, living_street: 4, trunk_link: 5, primary_link: 5, secondary_link: 5, tertiary_link: 5, service: 6, pedestrian: 7, footway: 8, path: 8, cycleway: 8 };
const DEFW = [14, 13, 11, 10, 8, 5, 4.5, 9, 2.6];
let lines = [];   // {cls,w,ow,name,p}
for (const w of ways.values()) { const t = w.tags; if (!t || !t.highway || !(t.highway in CLS)) continue; if (t.area === 'yes') continue;
  const cls = CLS[t.highway]; let wd = DEFW[cls]; const ln = parseInt(t.lanes); let ow = t.oneway === 'yes' || t.junction === 'roundabout' ? 1 : 0;
  if (cls <= 5 && ln) wd = Math.max(ow ? 4 : 6.5, Math.min(18, ln * 3.4)); else if (cls === 4 && ow) wd = 6.5;
  let p = pts(w); if (t.oneway === '-1') { p.reverse(); ow = 1; }
  if (cls >= 6) ow = 0;
  for (const run of clip(p, CBD)) lines.push({ cls, w: wd, ow, name: fixName(t.name), p: run });
}
const dec = a => { const p = [[a[0], a[1]]]; for (let i = 2; i < a.length; i += 2) p.push([p[p.length - 1][0] + a[i], p[p.length - 1][1] + a[i + 1]]); return p; };
for (const r of SUB.roads) { const p = dec(r[3]); if (!p.some(q => inB(q, SOUTH))) continue; if (r[2]) continue;
  const cls = Math.min(4, r[0]); for (const run of clip(p, SOUTH)) lines.push({ cls, w: Math.max(7, Math.min(16, r[1])), ow: 0, name: fixName(r[4]), p: run, sub: 1 }); }
// snap seam endpoints (CBD clip points <-> suburb starts)
const ends = []; for (const l of lines) { ends.push(l.p[0], l.p[l.p.length - 1]); }
for (const l of lines) if (l.sub) for (const e of [l.p[0], l.p[l.p.length - 1]]) { if (Math.abs(e[1] - 1383) > 2) continue; let best = null, bd = 6; for (const o of ends) { if (o === e) continue; const d = Math.hypot(o[0] - e[0], o[1] - e[1]); if (d < bd && d > 0) { bd = d; best = o; } } if (best) { e[0] = best[0]; e[1] = best[1]; } }
const key = p => Math.round(p[0] * 5) + ',' + Math.round(p[1] * 5);
const use = new Map(); for (const l of lines) l.p.forEach((p, i) => { const k = key(p); use.set(k, (use.get(k) || 0) + (i === 0 || i === l.p.length - 1 ? 2 : 1)); });
const edges = [];
for (const l of lines) { let cur = [l.p[0]]; for (let i = 1; i < l.p.length; i++) { cur.push(l.p[i]); if (i === l.p.length - 1 || use.get(key(l.p[i])) > 1) { if (cur.length > 1) edges.push({ ...l, p: rdp(cur, l.cls >= 6 ? 1.2 : .7) }); cur = [l.p[i]]; } } }
const r1 = v => Math.round(v * 10);
const enc = p => { const o = [r1(p[0][0]), r1(p[0][1])]; for (let i = 1; i < p.length; i++) o.push(r1(p[i][0]) - r1(p[i - 1][0]), r1(p[i][1]) - r1(p[i - 1][1])); return o; };
const roads = edges.filter(e => Math.hypot(e.p[0][0] - e.p[e.p.length - 1][0], e.p[0][1] - e.p[e.p.length - 1][1]) > .3 || e.p.length > 2).map(e => [e.cls, Math.round(e.w * 10) / 10, e.ow, nm(e.name), enc(e.p)]);

// ---------------- buildings ----------------
const LM = [[/Joina City/i, 105, 'Joina City'], [/Reserve Bank/i, 118, 'Reserve Bank of Zimbabwe'], [/Karigamombe/i, 78, 'Karigamombe Centre'], [/Monomatapa/i, 62, 'Monomotapa Hotel'], [/ZB Life Towers/i, 62, 'ZB Life Towers'], [/Old Mutual Centre/i, 66, 'Old Mutual Centre'],
  [/Meikles|Miekles Hotel/i, 46, 'Meikles Hotel'], [/Eastgate Shopping/i, 32, 'Eastgate'], [/Rainbow Towers/i, 70, 'Rainbow Towers'], [/Zanu Pf Head/i, 58, 'ZANU-PF HQ'], [/Netone Building/i, 52, 'NetOne (Kopje Plaza)'], [/Livingstone House/i, 68, 'Livingstone House'],
  [/Mukwati/i, 64, 'Mukwati Building'], [/Kaguvi Building/i, 60, 'Kaguvi Building'], [/Defence House$/, 48, 'Defence House'], [/Parliament of Zimbabwe/i, 16, 'Parliament'], [/Town House/i, 15, 'Town House'], [/Train Station/i, 11, 'Harare Railway Station'],
  [/National Gallery/i, 11, 'National Gallery'], [/Cresta Jameson/i, 42, null], [/New Ambassador/i, 34, null], [/Holiday Inn/i, 40, null], [/Sacred Heart/i, 24, 'Cathedral of the Sacred Heart'], [/^The Anglican Church/i, 20, 'Anglican Cathedral'],
  [/Charge Office$/i, 18, 'ZRP Harare Central'], [/High Court/i, 16, 'High Court'], [/West End Hospital/i, 14, 'West End Hospital'], [/ZB Centre/i, 50, null], [/Herald/i, 30, 'Herald House'], [/Main Post/i, 22, 'Main Post Office'], [/Roadport/i, 9, 'Roadport'], [/Angwa City/i, 40, null], [/Construction House|Finsure|Nicoz|CABS|Chiyedza|Bromley/i, 36, null]];
const bld = [], labels = [], places = {};
function addBuilding(ring, t) {
  if (ring.length > 3 && Math.hypot(ring[0][0] - ring[ring.length - 1][0], ring[0][1] - ring[ring.length - 1][1]) < .05) ring = ring.slice(0, -1);
  ring = rdpRing(ring, .45); if (ring.length < 3) return;
  let ar = area(ring); if (Math.abs(ar) < 14) return; if (ar > 0) ring.reverse(); ar = Math.abs(ar);
  const c = cen(ring); if (!inB(c, [CBD[0] - 30, CBD[1] - 30, CBD[2] + 30, CBD[3] + 30])) return;
  const rn = hash(c[0], c[1]), rn2 = hash(c[1], c[0]), b = t.building || 'yes', core = Math.exp(-((c[0] + 230) ** 2 + (c[1] + 80) ** 2) / (620 * 620));
  let h = parseFloat(t.height) || (parseFloat(t['building:levels']) ? parseFloat(t['building:levels']) * 3.3 + 1 : 0), label = null;
  for (const [re, lh, lb] of LM) if (t.name && re.test(t.name)) { h = Math.max(h, lh); label = lb; break; }
  const indus = /industrial|warehouse|shed|garage|hangar|depot/.test(b);
  if (!h) { if (indus) h = 6 + rn * 4; else if (/house|detached|residential|hut|roof/.test(b) || (ar < 230 && core < .25)) h = ar < 120 ? 3.4 : 3.4 + (rn < .25 ? 3.3 : 0);
    else if (/apartments/.test(b)) h = (3 + Math.floor(rn * 4)) * 3.3; else { const lv = 1 + Math.floor(rn * 2.2 + core * (2 + rn2 * 9) + (ar > 900 ? core * rn * 6 : 0)); h = lv * 3.4 + 1; } }
  h = Math.min(h, 125);
  let type = indus ? 4 : h > 38 ? 3 : h > 13 ? 2 : (ar < 260 && h < 8 && core < .3) ? 0 : /apartments|residential/.test(b) && h > 8 ? 5 : 1;
  if (/church|cathedral|mosque|synagogue/.test(b + (t.amenity === 'place_of_worship' ? 'church' : ''))) type = 1;
  bld.push([Math.round(h * 10) / 10, type, enc(ring)]);
  if (label && !labels.some(l => l[0] === label)) { labels.push([label, Math.round(c[0]), Math.round(c[1]), Math.round(h)]); }
  return c;
}
const done = new Set();
for (const r of rels) { const t = r.tags || {}; if (!t.building) continue; for (const m of r.members || []) if (m.type === 'way' && m.role !== 'inner' && ways.has(m.ref)) { const w = ways.get(m.ref); if (w.nodes[0] === w.nodes[w.nodes.length - 1]) { addBuilding(pts(w), t); done.add(w.id); } } }
for (const w of ways.values()) { const t = w.tags; if (!t || !t.building || done.has(w.id) || w.nodes[0] !== w.nodes[w.nodes.length - 1]) continue; addBuilding(pts(w), t); }
for (const b of SUB.buildings) { const ring = dec(b[2]), c = cen(ring); if (!inB(c, SOUTH)) continue; let rg = ring; if (area(rg) > 0) rg = rg.slice().reverse(); bld.push([b[1], b[0] === 0 ? 4 : b[0] === 2 ? 5 : 1, enc(rdpRing(rg, .6))]); }

// ---------------- green areas, rails, named places ----------------
const parks = [], rails = [], stations = [];
for (const w of ways.values()) { const t = w.tags; if (!t) continue;
  if (t.railway === 'rail') { for (const run of clip(pts(w), [CBD[0], CBD[1], CBD[2], CBD[3]])) rails.push(enc(rdp(run, .8))); continue; }
  const closed = w.nodes[0] === w.nodes[w.nodes.length - 1]; if (!closed) continue; const ring = pts(w).slice(0, -1); if (ring.length < 3) continue; const c = cen(ring);
  const green = /park|garden|golf_course|recreation_ground/.test(t.leisure || '') || /grass|recreation_ground|cemetery/.test(t.landuse || '');
  if ((green || t.leisure === 'pitch') && inB(c, CBD)) parks.push([t.leisure === 'pitch' ? 1 : 0, enc(rdpRing(ring, 1))]);
  if (t.amenity === 'bus_station') stations.push([t.name || 'Bus terminus', Math.round(c[0]), Math.round(c[1])]);
  const P = (k, re) => { if (t.name && re.test(t.name) && !places[k]) places[k] = [Math.round(c[0]), Math.round(c[1])]; };
  P('joina', /Joina City/i); P('eastgate', /Eastgate Shopping/i); P('rbz', /Reserve Bank/i); P('meikles', /Miekles Hotel/i); P('parliament', /^Parliament of Zimbabwe/); P('rail', /Train Station/i); P('gallery', /National Gallery/i);
  P('defence', /Defence House$/); P('hospital', /West End Hospital/i); P('unity', /Africa Unity Square/i); P('sportsclub', /Harare Sports Club/i); P('rainbow', /Rainbow Towers/i); P('zanu', /Zanu Pf/i); P('cathedral', /Sacred Heart/i); P('poly', /^Harare Polytechnic/); P('karigamombe', /Karigamombe/i);
  if (t.leisure === 'park' && !t.name && Math.abs(c[0] + 513) < 40 && Math.abs(c[1] + 510) < 40) places.gardens = [Math.round(c[0]), Math.round(c[1])];
}
for (const r of rels) { const t = r.tags || {}; const ws = (r.members || []).filter(m => m.type === 'way' && ways.has(m.ref)).map(m => pts(ways.get(m.ref))).flat(); if (!ws.length) continue; const c = cen(ws);
  if (/Town House/.test(t.name || '')) places.town = [Math.round(c[0]), Math.round(c[1])]; if (/Charge Office/.test(t.name || '')) places.zrp = [Math.round(c[0]), Math.round(c[1])]; if (/High Court/.test(t.name || '')) places.highcourt = [Math.round(c[0]), Math.round(c[1])]; }
for (const a of SUB.areas) { const ring = dec(a[1]), c = cen(ring); if (!inB(c, SOUTH)) continue; if (a[0] === 16) { parks.push([1, enc(ring)]); if (!places.rufaro || Math.abs(area(ring)) > 8000) places.rufaro = [Math.round(c[0]), Math.round(c[1])]; } else if (a[0] === 4 || a[0] === 10) parks.push([0, enc(ring)]); }
for (const n of nodes.values()) if (n.tags && n.tags.name === 'City View Point') places.kopje = xy(n.id).map(Math.round);
const out = { names, roads, bld, parks, rails, stations, labels, places };
const js = '// Derived from OpenStreetMap data © OpenStreetMap contributors, available under the Open Database License (ODbL).\nexport const CITY = ' + JSON.stringify(out) + ';\n';
fs.writeFileSync(new URL('../src/citydata.js', import.meta.url), js);
const cc = {}; for (const r of roads) cc[r[0]] = (cc[r[0]] || 0) + 1;
console.log(`roads ${roads.length}`, cc, `bld ${bld.length} parks ${parks.length} rails ${rails.length} names ${names.length} -> ${(js.length / 1024) | 0} KB`);
console.log(places, stations, labels.length);
const tc = {}; for (const b of bld) tc[b[1]] = (tc[b[1]] || 0) + 1; console.log('types', tc, 'tall', bld.filter(b => b[0] > 38).length);
