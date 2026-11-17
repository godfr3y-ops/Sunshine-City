// Hwindi / street slang pack — funny Zimbabwe lines for Sunshine City: Harare Hustle.
// Spoken via Web Speech + shown as toasts near ranks, kombis, and CBD hustle.

export const HWINDI = [
  { text: 'Town here! Town here!', shout: true, tip: 'Hwindi pulling passengers to CBD' },
  { text: 'Zviriko? Zviriko shamwari!', shout: false, tip: 'Street greeting' },
  { text: 'Bho here? Bho here!', shout: false, tip: 'You good?' },
  { text: 'Madiii! Madiiiii!', shout: true, tip: 'How much? / what\'s the vibe' },
  { text: 'Safe here! Safe here!', shout: false, tip: 'All good / chill' },
  { text: 'Usandifendera shaa!!', shout: true, tip: 'Don\'t disrespect me bro' },
  { text: 'Vabereki! Hunzai mari dzekombi!', shout: true, tip: 'Parents, bring kombi fare' },
  { text: 'NOP! NOP! One dollar!', shout: true, tip: 'National Oil / fuel / rank shout energy' },
  { text: 'Chitungwiza! Chitungwiza! Unit L! Seke!', shout: true, tip: 'Route call' },
  { text: 'Mabvuku! Tafara! Mabvuku-Tafara!', shout: true, tip: 'Eastern suburbs route' },
  { text: 'Mbare-Mbare! Mbare Musika!', shout: true, tip: 'Market route' },
  { text: 'Copacabana! Copa! Last two!', shout: true, tip: 'Rank call' },
  { text: 'Avondale! Avondale! Two more!', shout: true, tip: 'Northern route' },
  { text: 'Roadport! Roadport! Intercity!', shout: true, tip: 'Long distance' },
  { text: 'One dollar! One dollar! Mota yazara!', shout: true, tip: 'Full load' },
  { text: 'Pamberi pano! Huya! Huya tiende!', shout: true, tip: 'Come this way' },
  { text: 'Iwe! Don\'t push the door, it\'s already open!', shout: true, tip: 'Classic kombi comedy' },
  { text: 'Driver, robot iro rakatsuka — green! Green!', shout: true, tip: 'Traffic light yell' },
  { text: 'Change yako iripo — keep the cents, ndazodii?', shout: false, tip: 'Fare comedy' },
  { text: 'Eish pothole! Hold your tomatoes!', shout: true, tip: 'Road hazard joke' },
];

export const GREET = [
  'Ndeipi gaz!',
  'Zviriko?',
  'Bho here?',
  'Safe here!',
  'Madii shamwari?',
  'Sharp-sharp!',
  'Hesi!',
];

export const BANTER = [
  'Usandifendera shaa!! This rank has rules!',
  'Vabereki hunzai mari dzekombi — no free rides today!',
  'NOP? Fuel is fuel, blaz. Pay and sit.',
  'Chitungwiza via Mabvuku? Aiwa, wrong kombi!',
  'Mabvuku-Tafara last seat — squeeze, squeeze!',
  'Town here but this guy wants Avondale… choose one life!',
  'Safe here until Spanner\'s boys arrive… then not safe.',
  'Madiii for tomatoes? Office workers pay double at First Street!',
  'Bho here? ZRP is behind you — make it bho somewhere else!',
  'Zviriko? Zviriko is hustle. Hustle never sleeps in Harare.',
];

export const PAX_FUNNY = [
  '"Mudhara, chimbichimbi! Boss is already shouting on WhatsApp."',
  '"Ndiburutsei pa corner — drop me where the jacarandas start."',
  '"Eish, these potholes will finish your shocks AND my back."',
  '"Do you have change for ten? …Okay fine, keep the dollar."',
  '"Turn up the radio — ndiyo song yangu, Ngwere!"',
  '"Driver, robot iro harisi kushanda — just go, safe here!"',
  '"Usandifendera shaa!! I said LEFT side, Zimbabwe drives left!"',
  '"Vabereki vakandipa mari yekombi only — no tips, sorry."',
  '"Chitungwiza? Bro this is a mushikashika not a time machine."',
  '"Mabvuku-Tafara after rush hour? You are brave, gaz."',
  '"NOP queue again? Then walk. Kanjani."',
  '"Bho here? After that pothole… not really bho."',
];

export const AMB_BY_DISTRICT = {
  'Kopje · Downtown': [
    'Hwindi: "Town here! Town here!"',
    'Hwindi: "Chitungwiza! Unit L! Seke!"',
    'Vendor: "Freezits! Cold drinks! Madiii!"',
    'Tout: "Mbare-Mbare! Ngwere, huya tiende!"',
    'Hwindi: "Vabereki hunzai mari dzekombi!"',
  ],
  'Downtown (Kopje side)': [
    'Hwindi: "Town here! Town here!"',
    'Hwindi: "Chitungwiza! Unit L! Seke!"',
    'Vendor: "Freezits! Cold drinks!"',
    'Passerby: "Zviriko? Safe here!"',
  ],
  'Harare CBD': [
    'Hwindi: "Avondale! Avondale! Two more!"',
    'Hwindi: "Copacabana! Last seat!"',
    'Vendor: "Airtime! Airtime! Maputi!"',
    'Money changer: "Change money? Good rate, boss. Bho here?"',
    'Street: "Usandifendera shaa!! That was MY parking!"',
  ],
  'Mbare': [
    'Tout: "Mbare-Mbare-Mbare! Town one dollar!"',
    'Vendor: "Madomasi! Matemba! Zvese zviripo!"',
    'Hwindi: "Mabvuku! Tafara! Squeeze in!"',
    'Rank: "NOP? Then push the kombi, mdara!"',
  ],
  'Graniteside': ['A haulage truck rattles past.', 'Worker: "Safe here — just don\'t block the gate."'],
  'The Avenues': ['The jacarandas are in bloom.', 'Neighbour: "Bho here? Quiet today… for Harare."'],
};

/** Pick a random hwindi line (prefer shouty rank calls). */
export function pickHwindi(preferShout = true) {
  const pool = preferShout ? HWINDI.filter(p => p.shout) : HWINDI;
  return pool[(Math.random() * pool.length) | 0] || HWINDI[0];
}

export function pickBanter() {
  return BANTER[(Math.random() * BANTER.length) | 0];
}

export function pickGreet() {
  return GREET[(Math.random() * GREET.length) | 0];
}

export function pickPax() {
  return PAX_FUNNY[(Math.random() * PAX_FUNNY.length) | 0];
}

export function ambientFor(districtName) {
  return AMB_BY_DISTRICT[districtName] || null;
}
