// Tiny WebAudio synth: engine, horn, crashes, siren, and three procedurally generated radio stations.
// All "artists" and track names are invented for the game.
export const A = { ctx: null, station: -1, step: 0, next: 0, trk: '' };
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
let noiseBuf;
export function audioInit() {
  if (A.ctx) return;
  try {
    const c = A.ctx = new (window.AudioContext || window.webkitAudioContext)();
    A.master = c.createGain(); A.master.gain.value = .55; A.master.connect(c.destination);
    A.radio = c.createGain(); A.radio.gain.value = 0; A.radio.connect(A.master);
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    A.eng = c.createOscillator(); A.eng.type = 'sawtooth'; A.engF = c.createBiquadFilter(); A.engF.type = 'lowpass'; A.engF.frequency.value = 320; A.engG = c.createGain(); A.engG.gain.value = 0;
    A.eng.connect(A.engF); A.engF.connect(A.engG); A.engG.connect(A.master); A.eng.start();
    A.sir = c.createOscillator(); A.sir.type = 'triangle'; A.sirG = c.createGain(); A.sirG.gain.value = 0; A.sir.connect(A.sirG); A.sirG.connect(A.master); A.sir.start();
    if (c.state === 'suspended') c.resume();
  } catch (e) { A.ctx = null; }
}
/** Call from every user gesture — iOS/WKWebView keeps AudioContext suspended otherwise. */
export function audioUnlock() {
  try {
    if (!A.ctx) audioInit();
    if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume();
  } catch (e) { /* ignore */ }
}
function tone(f, t, dur, type, vol, dest, f2) {
  const c = A.ctx, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0008, t + dur); o.connect(g); g.connect(dest || A.master); o.start(t); o.stop(t + dur + .02);
}
function noise(t, dur, vol, type, freq, dest) {
  const c = A.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = noiseBuf; f.type = type; f.frequency.value = freq;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0008, t + dur); s.connect(f); f.connect(g); g.connect(dest || A.master); s.start(t, Math.random() * .5, dur + .02);
}
export function sfxHorn() { if (!A.ctx) return; const t = A.ctx.currentTime; tone(392, t, .35, 'square', .07); tone(494, t, .35, 'square', .06); }
export function sfxCrash(v) { if (!A.ctx) return; const t = A.ctx.currentTime; noise(t, .28, v, 'lowpass', 900); tone(90, t, .2, 'sine', v, null, 40); }
export function sfxCash() { if (!A.ctx) return; const t = A.ctx.currentTime; tone(988, t, .09, 'square', .05); tone(1319, t + .08, .16, 'square', .05); }
export function sfxWhistle() { if (!A.ctx) return; const t = A.ctx.currentTime; for (let i = 0; i < 3; i++) tone(2300, t + i * .22, .16, 'sine', .09, null, 2600); }
/** Short bark before a hwindi line so phones without voices still feel the shout. */
export function sfxHwindiBark() {
  if (!A.ctx) return;
  const t = A.ctx.currentTime;
  tone(220, t, .08, 'sawtooth', .05, null, 380);
  tone(310, t + .06, .12, 'square', .04, null, 190);
  noise(t + .02, .1, .05, 'bandpass', 1200);
}
let _voiceBusy = 0;
/**
 * Speak a Zimbabwe street / hwindi phrase (Web Speech API) + bark SFX.
 * Funny volume: shouty rate, slightly lower pitch for "rank energy".
 */
export function speakPhrase(text, { shout = true } = {}) {
  if (!text) return;
  audioUnlock();
  sfxHwindiBark();
  // iOS speechSynthesis is late/unsynced with gameplay — keep bark + on-screen toast only
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) return;
  try {
    const syn = window.speechSynthesis;
    if (!syn) return;
    const now = performance.now();
    if (now < _voiceBusy) return;
    syn.cancel();
    const u = new SpeechSynthesisUtterance(String(text));
    u.rate = shout ? 1.12 : 1.02;
    u.pitch = shout ? 0.85 : 1.0;
    u.volume = 0.85;
    const voices = syn.getVoices?.() || [];
    const prefer = voices.find(v => /en(-|_)?(ZA|GB|US|AU|IN)/i.test(v.lang)) || voices.find(v => /^en/i.test(v.lang));
    if (prefer) u.voice = prefer;
    _voiceBusy = now + Math.min(4200, 900 + text.length * 45);
    syn.speak(u);
  } catch (e) { /* speech optional */ }
}

// ---- radio ----
const R = () => A.radio;
const kick = t => tone(130, t, .16, 'sine', .5, R(), 42);
const snare = (t, v = .22) => noise(t, .1, v, 'highpass', 1800, R());
const hat = (t, v = .07) => noise(t, .03, v, 'highpass', 7000, R());
const pluck = (m, t, v = .16, d = .45) => { tone(mtof(m), t, d, 'sine', v, R()); tone(mtof(m) * 2.76, t, d * .25, 'sine', v * .25, R()); };
const STATIONS = [
  { name: 'Dhorobha FM — Zimdancehall', bpm: 98, div: 4, tracks: ['"Mari Yekombi" — Seh Tawa', '"Pothole Riddim" — Dj Chibhodhoro ft. Queen Maruva', '"Copacabana Girl" — Killer Madhuve'],
    play(i, t) { const s = i % 16, bar = (i >> 4) % 4, root = [45, 41, 43, 45][bar];
      if (s % 4 === 0) kick(t); if (s === 3 || s === 6 || s === 11 || s === 14) snare(t); if (s % 2 === 0) hat(t, .04);
      if ([0, 3, 6, 8, 11, 14].includes(s)) tone(mtof(root - 12), t, .22, 'triangle', .3, R());
      if (s === 2 || s === 10) for (const k of [0, 3, 7]) tone(mtof(root + 12 + k), t, .12, 'square', .03, R());
      if (bar % 2 === 1 && [4, 6, 7, 12].includes(s)) tone(mtof(root + 24 + [0, 3, 5, 7][s % 4]), t, .14, 'sawtooth', .035, R()); } },
  { name: 'Mbira Dreams 98.3 — roots', bpm: 126, div: 3, tracks: ['"Nhemamusasa (kombi version)" — Gogo Nyamasvisva', '"Mvura Ngainaye" — Vana Vembira', '"Chaminuka Street" — Sekuru Dzomba'],
    play(i, t) { const s = i % 4, ch = [[55, 59, 62], [55, 59, 64], [55, 60, 64], [57, 60, 64]][((i >> 2) % 12) / 3 | 0], rot = (i >> 2) % 3;
      noise(t, .04, i % 3 === 0 ? .1 : .045, 'highpass', 5000, R());
      if (s === 0) pluck(ch[rot] - 12, t, .22, .6); else if (s === 1) pluck(ch[(rot + 1) % 3] + 12, t, .13); else if (s === 2) pluck(ch[(rot + 2) % 3], t, .15); else pluck(ch[rot] + 12, t, .11);
      if (i % 12 === 7) pluck(ch[2] + 24, t, .07, .3); } },
  { name: 'Sungura Express', bpm: 152, div: 4, tracks: ['"Mukoma Hwindi" — Baba Gitare & The Mbare Express', '"Rufaro Sunday" — Sungura Kings', '"Amai Vemusika" — Mhofu Guitar Band'],
    play(i, t) { const s = i % 16, root = [60, 65, 67, 65][(i >> 4) % 4], tri = [0, 4, 7, 12];
      if (s === 0 || s === 8 || s === 10) kick(t); if (s === 4 || s === 12) snare(t, .14); if (s % 2 === 0) hat(t, .06);
      if (s % 4 === 0) tone(mtof(root - 24 + (s % 8 ? 7 : 0)), t, .2, 'triangle', .3, R());
      tone(mtof(root + 12 + tri[[0, 2, 1, 2, 3, 2, 1, 2][i % 8]]), t, .11, 'triangle', .1, R());
      if (s % 4 === 2) tone(mtof(root + tri[1]), t, .07, 'square', .025, R()); } },
];
export function radioNext() { A.station = A.station >= STATIONS.length - 1 ? -1 : A.station + 1; A.step = 0; A.next = 0; if (A.station >= 0) { const s = STATIONS[A.station]; A.trk = s.tracks[(Math.random() * s.tracks.length) | 0]; } }
export function radioName() { return A.station < 0 ? 'Radio off' : `${STATIONS[A.station].name} · now playing ${A.trk}`; }

export function audioUpdate(G, dt, active) {
  const c = A.ctx; if (!c) return; const t = c.currentTime, v = G.player.veh;
  const sp = v && active ? Math.abs(v.speed) : 0;
  A.eng.frequency.setTargetAtTime(v ? 48 + sp * 4.2 + Math.abs(v.thr) * 10 : 40, t, .08); A.engG.gain.setTargetAtTime(v && active && !v.dead ? .05 + Math.abs(v.thr) * .03 : 0, t, .1);
  const sir = active && G.player.wanted > 0; A.sirG.gain.setTargetAtTime(sir ? .035 : 0, t, .2); if (sir) A.sir.frequency.setValueAtTime(760 + 260 * Math.sin(t * 5.5), t);
  const on = v && active && A.station >= 0; A.radio.gain.setTargetAtTime(on ? .5 : 0, t, .15);
  if (on) { const s = STATIONS[A.station], stepDur = 60 / s.bpm / s.div; if (A.next < t) A.next = t + .03; let n = 0; while (A.next < t + .14 && n++ < 8) { s.play(A.step++, A.next); A.next += stepDur; } }
}
