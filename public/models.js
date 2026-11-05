// Процедурные low-poly модели (Рим + пустыня)
import * as THREE from 'three';
import { ITEMS } from './shared.js';

const matCache = new Map();
export function M(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9, metalness: 0, ...opts }));
  return matCache.get(key);
}
const geoCache = new Map();
const G = (key, fn) => { if (!geoCache.has(key)) geoCache.set(key, fn()); return geoCache.get(key); };
const box = (w, h, d) => G(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
const cyl = (rt, rb, h, s = 8) => G(`c${rt},${rb},${h},${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));
const sph = (r, s = 8) => G(`s${r},${s}`, () => new THREE.SphereGeometry(r, s, Math.max(4, s - 2)));
const cone = (r, h, s = 8) => G(`k${r},${h},${s}`, () => new THREE.ConeGeometry(r, h, s));

export function mesh(geo, mat, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}

export const PAL = {
  stone: 0xe6dcc3, stoneDark: 0xbfb295, marble: 0xf3efe4, roof: 0xb4513a, roofDark: 0x8f3b2a,
  wood: 0x8a5a32, woodDark: 0x5e3b1f, sand: 0xe3c48d, skin: 0xd9a77c, bronze: 0xb08d3c, red: 0x9e2a22,
  green: 0x6f8f3a, leaf: 0x5d8a2e, dry: 0x9c8a4c, rock: 0xa89580, water: 0x2a9db0,
};

// ---------- Персонаж ----------
// spec — открытая специализация: от неё зависит снаряжение
export function makePlayer(color, spec = '') {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const tunic = M(color);
  const skin = M(PAL.skin);
  const leather = M(0x6b4423);
  const legL = new THREE.Group(), legR = new THREE.Group();
  legL.position.set(-0.17, 0.88, 0); legR.position.set(0.17, 0.88, 0);
  for (const leg of [legL, legR]) {
    mesh(cyl(0.1, 0.085, 0.82, 8), skin, 0, -0.42, 0, leg);
    mesh(box(0.2, 0.1, 0.32), leather, 0, -0.84, 0.05, leg);            // сандалия
    mesh(cyl(0.095, 0.095, 0.05, 8), leather, 0, -0.62, 0, leg);         // ремешки
    mesh(cyl(0.09, 0.09, 0.05, 8), leather, 0, -0.72, 0, leg);
  }
  body.add(legL, legR);
  mesh(cyl(0.3, 0.44, 0.55, 12), tunic, 0, 1.06, 0, body);              // подол
  mesh(cyl(0.33, 0.3, 0.62, 12), tunic, 0, 1.6, 0, body).scale.set(1, 1, 0.7); // торс
  mesh(cyl(0.31, 0.31, 0.09, 12), leather, 0, 1.3, 0, body).scale.set(1, 1, 0.72); // пояс
  mesh(box(0.08, 0.08, 0.04), M(PAL.bronze, { metalness: 0.6, roughness: 0.4 }), 0, 1.3, 0.23, body); // пряжка
  const armL = new THREE.Group(), armR = new THREE.Group();
  armL.position.set(-0.4, 1.85, 0); armR.position.set(0.4, 1.85, 0);
  for (const arm of [armL, armR]) {
    mesh(sph(0.13, 8), tunic, 0, -0.02, 0, arm);                         // рукав
    mesh(cyl(0.075, 0.065, 0.68, 8), skin, 0, -0.36, 0, arm);
    mesh(sph(0.075, 6), skin, 0, -0.72, 0, arm);
  }
  body.add(armL, armR);
  const hand = new THREE.Group(); hand.position.set(0, -0.72, 0.05); armR.add(hand);
  mesh(cyl(0.08, 0.09, 0.18, 8), skin, 0, 2.02, 0, body);               // шея
  const head = new THREE.Group(); head.position.set(0, 2.32, 0); body.add(head);
  mesh(sph(0.25, 14), skin, 0, 0, 0, head).scale.set(0.95, 1.05, 1);
  mesh(box(0.06, 0.1, 0.08), skin, 0, -0.02, 0.24, head);              // нос
  mesh(sph(0.03, 5), M(0x1a1a1a), -0.09, 0.04, 0.22, head);             // глаза
  mesh(sph(0.03, 5), M(0x1a1a1a), 0.09, 0.04, 0.22, head);
  const hair = mesh(sph(0.265, 14), M(0x3b2a1a), 0, 0.06, -0.03, head); hair.scale.set(1, 0.85, 1);
  // плащ
  const cape = new THREE.Group(); cape.position.set(0, 1.92, -0.2); body.add(cape);
  mesh(box(0.62, 1.15, 0.05), M(PAL.red), 0, -0.56, 0, cape);
  // снаряжение по специализации
  if (spec === 'warrior') {
    const helm = M(0xc9a74a, { metalness: 0.7, roughness: 0.35 });
    mesh(sph(0.29, 12), helm, 0, 0.08, 0, head).scale.set(1, 0.85, 1.05);
    mesh(box(0.06, 0.18, 0.5), M(0xb01c1c), 0, 0.36, 0, head);            // гребень
    mesh(box(0.04, 0.22, 0.12), helm, -0.25, -0.1, 0.05, head);           // нащёчники
    mesh(box(0.04, 0.22, 0.12), helm, 0.25, -0.1, 0.05, head);
    mesh(box(0.72, 0.5, 0.05), helm, 0, 1.62, 0.21, body);                // нагрудник
    const shield = mesh(box(0.7, 1.0, 0.08), M(0x9e2a22), 0, 1.5, -0.32, body);
    mesh(sph(0.1, 8), helm, 0, 0, -0.05, shield);
  } else if (spec === 'farmer') {
    mesh(cyl(0.48, 0.48, 0.03, 14), M(0xe0c46a), 0, 0.2, 0, head);       // соломенная шляпа
    mesh(cone(0.22, 0.26, 12), M(0xd6b85a), 0, 0.33, 0, head);
  } else if (spec === 'craftsman') {
    mesh(box(0.5, 0.75, 0.04), leather, 0, 1.25, 0.25, body);            // фартук
    mesh(box(0.06, 0.32, 0.06), M(0x777777, { metalness: 0.5 }), 0.3, 1.2, 0.2, body); // молоток на поясе
    mesh(cyl(0.27, 0.27, 0.08, 12), M(0x8a6a4a), 0, 0.14, 0, head);       // шапочка
  } else if (spec === 'gatherer') {
    const basket = mesh(cyl(0.26, 0.2, 0.55, 10), M(0xb08a4a), 0, 1.55, -0.36, body);
    mesh(cyl(0.27, 0.27, 0.05, 10), M(0x8a6a3a), 0, 0.28, 0, basket);
    mesh(box(0.04, 0.6, 0.04), M(0x6e5438), 0.08, 0.4, 0, basket);        // торчащие ветки
  }
  // маска (видна, когда тёмная роль её надела)
  const mask = new THREE.Group(); mask.visible = false; head.add(mask);
  mesh(sph(0.27, 12), M(0x15151a), 0, -0.02, 0.02, mask).scale.set(1.02, 0.6, 1.02);
  mesh(box(0.08, 0.04, 0.02), M(0xffffff, { emissive: 0x999999 }), -0.09, 0.05, 0.26, mask);
  mesh(box(0.08, 0.04, 0.02), M(0xffffff, { emissive: 0x999999 }), 0.09, 0.05, 0.26, mask);
  g.userData = { body, legL, legR, armL, armR, hand, head, cape, mask, weapon: null, weaponType: null };
  return g;
}
export function setWeapon(pl, type) {
  const u = pl.userData;
  if (u.weaponType === type) return;
  if (u.weapon) u.hand.remove(u.weapon);
  u.weapon = null; u.weaponType = type;
  if (!type) return;
  const w = new THREE.Group();
  if (type === 'gladius') {
    mesh(box(0.08, 0.75, 0.03), M(0xd0d6dc, { metalness: 0.6, roughness: 0.3 }), 0, 0, 0.42, w).rotation.x = Math.PI / 2;
    mesh(box(0.25, 0.05, 0.06), M(PAL.bronze), 0, 0, 0.05, w);
  } else if (type === 'spear') {
    mesh(cyl(0.03, 0.03, 2.2, 5), M(PAL.wood), 0, 0, 0.6, w).rotation.x = Math.PI / 2;
    mesh(cone(0.07, 0.3, 5), M(0xc0c6cc, { metalness: 0.6 }), 0, 0, 1.8, w).rotation.x = Math.PI / 2;
  } else if (type === 'axe') {
    mesh(cyl(0.035, 0.035, 0.9, 5), M(PAL.wood), 0, 0, 0.35, w).rotation.x = Math.PI / 2;
    mesh(box(0.05, 0.3, 0.22), M(0x888888, { metalness: 0.5 }), 0, 0.12, 0.72, w);
  } else if (type === 'treasure') {
    mesh(box(0.5, 0.35, 0.35), M(0x6b4423), 0, 0.1, 0.2, w);
  }
  u.hand.add(w); u.weapon = w;
}
export function animatePlayer(pl, t, moving, running, attacking, atkType = 'melee') {
  const u = pl.userData;
  const sp = running ? 13 : 8.5;
  const a = moving ? Math.sin(t * sp) * (running ? 0.85 : 0.55) : 0;
  u.legL.rotation.x = a; u.legR.rotation.x = -a;
  u.armL.rotation.x = -a * 0.7;
  if (attacking > 0) {
    if (atkType === 'throw') {
      // замах назад-вверх и бросок вперёд
      const k = 1 - attacking;
      u.armR.rotation.x = k < 0.35 ? -2.8 * (k / 0.35) : -2.8 + (k - 0.35) / 0.65 * 3.6;
      u.body.rotation.y = k < 0.35 ? -0.5 * (k / 0.35) : -0.5 + (k - 0.35) / 0.65 * 0.8;
    } else {
      // горизонтальный взмах
      const k = 1 - attacking;
      u.armR.rotation.x = -1.4;
      u.armR.rotation.z = 0.9 - k * 1.8;
      u.body.rotation.y = 0.4 - k * 0.8;
    }
  } else { u.armR.rotation.x = a * 0.7; u.armR.rotation.z = 0; u.body.rotation.y = 0; }
  u.body.position.y = moving ? Math.abs(Math.sin(t * sp)) * 0.07 : Math.sin(t * 2) * 0.015;
  u.cape.rotation.x = moving ? 0.25 + Math.sin(t * sp * 0.5) * 0.08 : 0.05;
}

// ---------- Чайка ----------
export function makeGull(scale = 1) {
  const g = new THREE.Group();
  const white = M(0xf4f4f0), grey = M(0x9aa3ab);
  const body = new THREE.Group(); g.add(body);
  mesh(sph(0.22, 8), white, 0, 0.32, 0, body).scale.set(0.8, 0.75, 1.4);
  mesh(sph(0.13, 8), white, 0, 0.45, 0.25, body);
  mesh(cone(0.04, 0.16, 5), M(0xf0b429), 0, 0.43, 0.42, body).rotation.x = Math.PI / 2;
  mesh(box(0.2, 0.04, 0.2), grey, 0, 0.3, -0.32, body);                   // хвост
  const wL = new THREE.Group(), wR = new THREE.Group();
  wL.position.set(-0.12, 0.38, 0); wR.position.set(0.12, 0.38, 0);
  mesh(box(0.55, 0.03, 0.25), grey, -0.27, 0, 0, wL);
  mesh(box(0.55, 0.03, 0.25), grey, 0.27, 0, 0, wR);
  body.add(wL, wR);
  mesh(box(0.03, 0.18, 0.03), M(0xf0b429), -0.06, 0.09, 0, body);
  mesh(box(0.03, 0.18, 0.03), M(0xf0b429), 0.06, 0.09, 0, body);
  g.scale.setScalar(scale);
  g.userData = { wL, wR, body };
  return g;
}
export function animateGull(gm, t, flying) {
  const u = gm.userData;
  const f = flying ? Math.sin(t * 14) * 0.9 : -0.15;
  u.wL.rotation.z = f; u.wR.rotation.z = -f;
  u.body.rotation.x = flying ? 0 : Math.sin(t * 3) * 0.05;
}
export function makeSpearProjectile() {
  const g = new THREE.Group();
  mesh(cyl(0.035, 0.035, 2.2, 6), M(PAL.wood), 0, 0, 0, g).rotation.x = Math.PI / 2;
  mesh(cone(0.08, 0.32, 6), M(0xc0c6cc, { metalness: 0.7, roughness: 0.3 }), 0, 0, 1.25, g).rotation.x = Math.PI / 2;
  return g;
}
export function makeGrass(s = 1) {
  const g = new THREE.Group();
  const m = M(0x6f9a3a), m2 = M(0x88b04b);
  for (let i = 0; i < 5; i++) {
    const c = mesh(cone(0.08, 0.7 + (i % 3) * 0.2, 4), i % 2 ? m : m2, Math.cos(i * 1.3) * 0.18, 0.35, Math.sin(i * 1.3) * 0.18, g);
    c.rotation.z = Math.cos(i * 2.1) * 0.25; c.castShadow = false;
  }
  g.scale.setScalar(s);
  return g;
}

// ---------- Звери ----------
export function makeAnimal(type) {
  const g = new THREE.Group();
  const parts = { legs: [] };
  let col, s;
  if (type === 'jackal') { col = 0xb98a52; s = 0.8; }
  else if (type === 'boar') { col = 0x4b3a2e; s = 1.0; }
  else { col = 0xc9a15d; s = 1.45; }
  const mat = M(col);
  const body = new THREE.Group(); g.add(body);
  const bl = type === 'boar' ? 1.5 : 1.3, bh = type === 'boar' ? 0.75 : 0.5;
  mesh(box(0.6 * s, bh * s, bl * s), mat, 0, 0.75 * s, 0, body);
  const head = mesh(box(0.45 * s, 0.42 * s, 0.5 * s), mat, 0, (0.85 + (type === 'boar' ? 0 : 0.15)) * s, (bl / 2 + 0.2) * s, body);
  if (type === 'jackal') {
    mesh(cone(0.08 * s, 0.3 * s, 4), mat, -0.13 * s, 0.25 * s, -0.05 * s, head);
    mesh(cone(0.08 * s, 0.3 * s, 4), mat, 0.13 * s, 0.25 * s, -0.05 * s, head);
    mesh(box(0.22 * s, 0.2 * s, 0.35 * s), mat, 0, -0.08 * s, 0.35 * s, head);
    mesh(cyl(0.05 * s, 0.1 * s, 0.6 * s, 5), mat, 0, 0.85 * s, -(bl / 2 + 0.2) * s, body).rotation.x = -0.9;
  } else if (type === 'boar') {
    mesh(box(0.3, 0.25, 0.25), M(0x6b4f3f), 0, -0.08, 0.32, head);
    mesh(cone(0.04, 0.25, 4), M(0xeeeedd), -0.15, -0.05, 0.35, head).rotation.x = -1.2;
    mesh(cone(0.04, 0.25, 4), M(0xeeeedd), 0.15, -0.05, 0.35, head).rotation.x = -1.2;
    mesh(box(0.15, 0.25, 1.2), M(0x2e231b), 0, 0.42, -0.1, body);
  } else {
    mesh(sph(0.48 * s, 7), M(0x7a4a22), 0, 0.02 * s, -0.08 * s, head).scale.set(1, 1, 0.8); // грива
    mesh(box(0.3 * s, 0.24 * s, 0.25 * s), mat, 0, -0.08 * s, 0.32 * s, head);
    mesh(cyl(0.04 * s, 0.04 * s, 0.8 * s, 4), mat, 0, 0.8 * s, -(bl / 2 + 0.3) * s, body).rotation.x = -1.1;
  }
  const lh = 0.55 * s;
  for (const [x, z] of [[-0.2, 0.45], [0.2, 0.45], [-0.2, -0.45], [0.2, -0.45]]) {
    const leg = new THREE.Group(); leg.position.set(x * s, 0.6 * s, z * bl * s); body.add(leg);
    mesh(box(0.14 * s, lh, 0.14 * s), mat, 0, -lh / 2, 0, leg);
    parts.legs.push(leg);
  }
  parts.body = body; parts.head = head;
  g.userData = parts;
  return g;
}
export function makeMonster() {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const sandM = M(0x8a6a3a), dark = M(0x3b2a1c), glow = M(0xff5a1f, { emissive: 0xff3a00, emissiveIntensity: 2 });
  mesh(box(3.2, 3.6, 2.2), sandM, 0, 4.6, 0, body);
  mesh(box(2.4, 1.6, 1.8), dark, 0, 2.2, 0, body);
  const head = mesh(box(1.6, 1.4, 1.6), sandM, 0, 7.1, 0.3, body);
  mesh(box(0.35, 0.2, 0.1), glow, -0.4, 0.15, 0.82, head);
  mesh(box(0.35, 0.2, 0.1), glow, 0.4, 0.15, 0.82, head);
  mesh(cone(0.25, 1.2, 4), dark, -0.7, 0.9, 0, head).rotation.z = 0.4;
  mesh(cone(0.25, 1.2, 4), dark, 0.7, 0.9, 0, head).rotation.z = -0.4;
  const armL = new THREE.Group(), armR = new THREE.Group();
  armL.position.set(-2.0, 6, 0); armR.position.set(2.0, 6, 0);
  mesh(box(1.0, 3.8, 1.0), sandM, 0, -1.8, 0, armL); mesh(box(1.3, 1.0, 1.3), dark, 0, -3.8, 0, armL);
  mesh(box(1.0, 3.8, 1.0), sandM, 0, -1.8, 0, armR); mesh(box(1.3, 1.0, 1.3), dark, 0, -3.8, 0, armR);
  body.add(armL, armR);
  const legL = new THREE.Group(), legR = new THREE.Group();
  legL.position.set(-0.9, 2.2, 0); legR.position.set(0.9, 2.2, 0);
  mesh(box(1.0, 2.2, 1.1), dark, 0, -1.1, 0, legL); mesh(box(1.0, 2.2, 1.1), dark, 0, -1.1, 0, legR);
  body.add(legL, legR);
  for (let i = 0; i < 5; i++) mesh(cone(0.3, 1.0, 4), dark, (i - 2) * 0.6, 6.6, -1.0, body).rotation.x = -0.6;
  const light = new THREE.PointLight(0xff5a1f, 6, 14); light.position.set(0, 7, 2); body.add(light);
  g.userData = { body, armL, armR, legL, legR, legs: [legL, legR] };
  return g;
}
export function animateAnimal(a, t, moving, attacking) {
  const u = a.userData;
  const sw = moving ? Math.sin(t * 12) * 0.6 : 0;
  if (u.armL) {
    u.legL.rotation.x = Math.sin(t * 4) * (moving ? 0.4 : 0); u.legR.rotation.x = -u.legL.rotation.x;
    u.armL.rotation.x = attacking > 0 ? -2 + (1 - attacking) * 2 : -u.legL.rotation.x * 0.6;
    u.armR.rotation.x = attacking > 0 ? -2 + (1 - attacking) * 2 : u.legL.rotation.x * 0.6;
    return;
  }
  u.legs.forEach((l, i) => (l.rotation.x = (i % 2 === (i < 2 ? 0 : 1) ? 1 : -1) * sw));
  u.body.position.y = moving ? Math.abs(Math.sin(t * 12)) * 0.06 : 0;
  u.head.rotation.x = attacking > 0 ? Math.sin(attacking * Math.PI) * 0.6 : 0;
}

// ---------- Растения, камни, ресурсы ----------
export function makePalm(s = 1) {
  const g = new THREE.Group();
  const trunkM = M(0x8b6b42);
  let y = 0, x = 0;
  for (let i = 0; i < 6; i++) { mesh(cyl(0.22 - i * 0.02, 0.26 - i * 0.02, 1.0, 6), trunkM, x, y + 0.5, 0, g); y += 0.95; x += 0.08 * i * 0.3; }
  for (let i = 0; i < 7; i++) {
    const leaf = mesh(box(0.5, 0.06, 2.6), M(PAL.leaf), 0, 0, 1.2);
    const piv = new THREE.Group(); piv.position.set(x, y, 0); piv.rotation.y = (i / 7) * Math.PI * 2; piv.rotation.x = 0.45;
    leaf.rotation.x = 0.25; piv.add(leaf); g.add(piv);
  }
  mesh(sph(0.22, 6), M(0x5a3d1f), x, y - 0.2, 0.15, g);
  g.scale.setScalar(s);
  return g;
}
export function makeDeadTree(s = 1) {
  const g = new THREE.Group();
  const m = M(0x6e5438);
  mesh(cyl(0.18, 0.32, 3, 6), m, 0, 1.5, 0, g);
  const b1 = mesh(cyl(0.08, 0.14, 1.8, 5), m, 0.5, 2.6, 0, g); b1.rotation.z = -0.8;
  const b2 = mesh(cyl(0.07, 0.12, 1.5, 5), m, -0.4, 2.9, 0.2, g); b2.rotation.z = 0.7;
  const b3 = mesh(cyl(0.06, 0.1, 1.2, 5), m, 0, 3.4, -0.4, g); b3.rotation.x = 0.6;
  // лежащее бревно рядом
  const log = mesh(cyl(0.22, 0.22, 2.2, 6), M(0x7d6040), 1.2, 0.22, 0.6, g); log.rotation.z = Math.PI / 2; log.rotation.y = 0.5;
  g.scale.setScalar(s);
  return g;
}
export function makeSandPile(s = 1) {
  const g = new THREE.Group();
  mesh(cone(1.5, 1.0, 9), M(0xf3e2b8), 0, 0.5, 0, g);
  mesh(cone(0.9, 0.7, 7), M(0xfaedcc), 0.9, 0.35, 0.5, g);
  mesh(box(0.08, 1.4, 0.08), M(PAL.wood), -1, 0.6, 0.6, g).rotation.z = 0.3; // воткнутая лопата
  mesh(box(0.3, 0.4, 0.05), M(0x777777), -1.2, 0.05, 0.6, g);
  g.scale.setScalar(s);
  return g;
}
export function makeRock(s = 1) {
  const g = new THREE.Group();
  const geo = G('rock', () => new THREE.DodecahedronGeometry(0.8, 0));
  const m1 = mesh(geo, M(PAL.rock), 0, 0.3, 0, g); m1.scale.set(1.2, 0.7, 1);
  const m2 = mesh(geo, M(0x9a8670), 0.7, 0.15, 0.3, g); m2.scale.set(0.6, 0.45, 0.6);
  g.scale.setScalar(s);
  return g;
}
export function makeShrub(s = 1) {
  const g = new THREE.Group();
  const m = M(PAL.dry);
  for (let i = 0; i < 4; i++) mesh(sph(0.35, 5), m, Math.cos(i * 1.7) * 0.3, 0.25, Math.sin(i * 1.7) * 0.3, g).scale.set(1, 0.7, 1);
  g.scale.setScalar(s * 0.8);
  return g;
}

// ---------- Римская архитектура ----------
function column(parent, x, z, h, r = 0.3, mat = M(PAL.marble), broken = 0) {
  const hh = h * (1 - broken);
  const cg = new THREE.Group(); cg.position.set(x, 0, z); parent.add(cg);
  mesh(box(r * 2.6, 0.2, r * 2.6), mat, 0, 0.1, 0, cg);
  mesh(cyl(r, r * 1.1, hh, 10), mat, 0, 0.2 + hh / 2, 0, cg);
  if (!broken) mesh(box(r * 2.6, 0.25, r * 2.6), mat, 0, 0.2 + hh + 0.12, 0, cg);
  return cg;
}
function gableRoof(parent, w, d, y, h, mat = M(PAL.roof)) {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2 - 0.3, 0); shape.lineTo(w / 2 + 0.3, 0); shape.lineTo(0, h); shape.lineTo(-w / 2 - 0.3, 0);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: d + 0.6, bevelEnabled: false });
  geo.translate(0, 0, -(d + 0.6) / 2);
  return mesh(geo, mat, 0, y, 0, parent);
}

export function makeBuilding(type) {
  const g = new THREE.Group();
  const st = M(PAL.stone), stD = M(PAL.stoneDark), wood = M(PAL.wood), woodD = M(PAL.woodDark);
  if (type === 'warehouse') {
    mesh(box(9, 0.4, 7), stD, 0, 0.2, 0, g);
    mesh(box(8.5, 3.6, 6.5), st, 0, 2.2, 0, g);
    gableRoof(g, 8.5, 6.5, 4, 2.2);
    mesh(box(2.2, 2.6, 0.2), woodD, 0, 1.7, 3.3, g);
    for (let i = -1; i <= 1; i += 2) mesh(box(0.8, 0.8, 0.8), wood, i * 3.5, 0.8, 4.2, g);
    mesh(cyl(0.4, 0.35, 1, 8), M(0xb06b3a), 2.5, 0.9, 4.0, g); // амфора
    mesh(cyl(0.4, 0.35, 1, 8), M(0xb06b3a), -2.4, 0.9, 4.4, g);
    // помост для собраний
    mesh(box(4, 0.3, 2), stD, 0, 0.15, 5.4, g);
  } else if (type === 'workshop') {
    mesh(box(7, 0.3, 6), stD, 0, 0.15, 0, g);
    mesh(box(5, 2.8, 4), st, -0.8, 1.7, -0.5, g);
    gableRoof(g, 5, 4, 3.1, 1.4).position.x = -0.8;
    mesh(box(1, 4, 1), M(0x9c5a3a), 1.3, 2.3, -1.6, g); // печь
    mesh(box(1.2, 0.3, 1.2), M(0x333333), 1.3, 4.4, -1.6, g);
    mesh(box(2, 0.9, 1), wood, 2.0, 0.75, 1.5, g); // верстак
    for (let i = 0; i < 4; i++) mesh(box(0.4, 0.25, 0.25), M(0xa5402f), -2.5 + (i % 2) * 0.45, 0.42 + Math.floor(i / 2) * 0.27, 2.2, g); // кирпичи
    for (let i = 0; i < 3; i++) mesh(box(2.2, 0.12, 0.35), M(0xc79a63), -0.2, 0.36 + i * 0.13, 2.2, g); // доски
  } else if (type === 'farm') {
    mesh(box(11, 0.15, 10), M(0x8a6a3c), 0, 0.08, 0, g);
    for (let r = -2; r <= 2; r++) {
      for (let c = -2; c <= 2; c++) {
        const lemon = (r + 2) % 2 === 0;
        const px = c * 1.8 + 0.5, pz = r * 1.8 + 0.5;
        if (lemon) { mesh(cyl(0.07, 0.09, 0.8, 5), M(0x6e5438), px, 0.5, pz, g); mesh(sph(0.55, 6), M(0x4f7d2a), px, 1.1, pz, g); mesh(sph(0.1, 5), M(0xffe03a), px + 0.3, 1.0, pz + 0.3, g); }
        else { mesh(box(0.9, 0.7, 0.9), M(0x7a9a3a), px, 0.4, pz, g); } // тутовник (шёлк)
      }
    }
    for (let i = -5; i <= 5; i += 2.5) { mesh(box(0.12, 0.9, 0.12), wood, i, 0.45, 5, g); mesh(box(0.12, 0.9, 0.12), wood, i, 0.45, -5, g); mesh(box(0.12, 0.9, 0.12), wood, 5.4, 0.45, i, g); mesh(box(0.12, 0.9, 0.12), wood, -5.4, 0.45, i, g); }
    mesh(box(11, 0.08, 0.08), wood, 0, 0.8, 5, g); mesh(box(11, 0.08, 0.08), wood, 0, 0.8, -5, g);
    mesh(box(0.08, 0.08, 10), wood, 5.4, 0.8, 0, g); mesh(box(0.08, 0.08, 10), wood, -5.4, 0.8, 0, g);
    const hut = new THREE.Group(); hut.position.set(-4, 0, -6.4); g.add(hut);
    mesh(box(2.4, 1.8, 1.8), st, 0, 0.9, 0, hut); gableRoof(hut, 2.4, 1.8, 1.8, 0.9);
  } else if (type === 'shipyard') {
    mesh(box(10, 0.5, 6), stD, 0, 0.25, -3, g);
    // деревянный слип уходит к воде (вдоль +z)
    mesh(box(5, 0.3, 12), wood, 0, 0.0, 5, g).rotation.x = 0.08;
    for (let i = 0; i < 5; i++) { mesh(cyl(0.2, 0.2, 3, 6), woodD, -2.3, -0.8, 1 + i * 2.6, g); mesh(cyl(0.2, 0.2, 3, 6), woodD, 2.3, -0.8, 1 + i * 2.6, g); }
    // кран
    mesh(box(0.4, 6, 0.4), wood, -4, 3, -2, g);
    const arm = mesh(box(0.3, 0.3, 6), wood, -4, 6, 0.5, g);
    mesh(cyl(0.02, 0.02, 3, 4), M(0x333333), -4, 4.5, 3.3, g);
    mesh(box(4, 2.5, 3), st, 2.5, 1.5, -4, g); gableRoof(g, 4, 3, 2.75, 1.2).position.set(2.5, 0, -4);
  } else if (type === 'townhall') {
    // храмоподобная базилика на подиуме
    for (let i = 0; i < 3; i++) mesh(box(14 - i * 0.6, 0.4, 11 - i * 0.6), M(PAL.marble), 0, 0.2 + i * 0.4, 0, g);
    const top = 1.2;
    mesh(box(9.5, 4.5, 6.5), st, 0, top + 2.25, -0.8, g);
    for (let i = 0; i < 6; i++) column(g, -5 + i * 2, 4.2, 4.6, 0.35).position.y = top;
    for (let i = 0; i < 4; i++) { column(g, -5.6, 2.4 - i * 2.2, 4.6, 0.35).position.y = top; column(g, 5.6, 2.4 - i * 2.2, 4.6, 0.35).position.y = top; }
    mesh(box(12.6, 0.6, 10), M(PAL.marble), 0, top + 5.2, 0, g);
    gableRoof(g, 12, 10, top + 5.5, 2.4);
    // фронтон: треугольник на фасаде
    mesh(box(2.4, 0.5, 0.2), M(PAL.bronze, { metalness: 0.5 }), 0, top + 6.4, 5.35, g);
    // орёл-штандарт
    mesh(cyl(0.06, 0.06, 3, 5), M(PAL.bronze), 6.6, 2.6, 5.2, g);
    mesh(box(0.8, 1.0, 0.05), M(PAL.red), 6.6, 3.5, 5.2, g);
    mesh(sph(0.2, 6), M(0xd4af37, { metalness: 0.7 }), 6.6, 4.2, 5.2, g);
  }
  return g;
}
export function makeScaffold(type, r) {
  const g = new THREE.Group();
  const wood = M(PAL.wood);
  const s = r * 0.8;
  for (const [x, z] of [[-s, -s], [s, -s], [-s, s], [s, s]]) mesh(box(0.2, 3.5, 0.2), wood, x, 1.75, z, g);
  mesh(box(s * 2, 0.15, 0.15), wood, 0, 3.4, -s, g); mesh(box(s * 2, 0.15, 0.15), wood, 0, 3.4, s, g);
  mesh(box(0.15, 0.15, s * 2), wood, -s, 3.4, 0, g); mesh(box(0.15, 0.15, s * 2), wood, s, 3.4, 0, g);
  mesh(box(s * 2, 0.15, 0.15), wood, 0, 1.6, -s, g).rotation.z = 0.5;
  mesh(box(s * 2, 0.3, s * 2), M(PAL.stoneDark), 0, 0.15, 0, g);
  // штабель материалов
  mesh(box(1.5, 0.5, 0.8), M(0xc79a63), s * 0.4, 0.5, s * 0.3, g);
  mesh(box(1, 0.6, 1), M(0xa5402f), -s * 0.4, 0.6, -s * 0.2, g);
  return g;
}
export function makeRuinedOverlay(r) {
  const g = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const a = i * 1.1;
    mesh(box(1 + Math.random(), 0.5, 1), M(PAL.stoneDark), Math.cos(a) * r * 0.7, 0.25, Math.sin(a) * r * 0.7, g).rotation.y = a;
  }
  const smoke = mesh(sph(1.2, 6), M(0x333333, { transparent: true, opacity: 0.5 }), 0, 4, 0, g);
  g.userData.smoke = smoke;
  return g;
}
export function makeShip() {
  const g = new THREE.Group();
  const hullM = M(0x6b4423);
  const hull = mesh(box(2.6, 1.2, 9), hullM, 0, 0.5, 0, g);
  mesh(box(2.0, 0.8, 1.6), hullM, 0, 0.9, 4.6, g).rotation.x = -0.5;
  mesh(box(2.0, 0.8, 1.6), hullM, 0, 0.9, -4.6, g).rotation.x = 0.5;
  mesh(box(2.8, 0.15, 9.2), M(0xb08d3c), 0, 1.15, 0, g);
  mesh(cyl(0.12, 0.12, 7, 6), M(PAL.wood), 0, 4.5, 0.5, g);
  mesh(box(4.5, 3.5, 0.08), M(0xf0e6d2), 0, 5, 0.6, g);
  mesh(box(1.2, 1.2, 0.1), M(PAL.red), 0, 5, 0.66, g);
  for (let i = -3; i <= 3; i++) { mesh(box(2.8, 0.06, 0.1), M(PAL.woodDark), -1.6, 0.6, i * 1.1, g).rotation.z = 0.4; mesh(box(2.8, 0.06, 0.1), M(PAL.woodDark), 1.6, 0.6, i * 1.1, g).rotation.z = -0.4; }
  return g;
}
export function makeBoat() {
  const g = new THREE.Group();
  mesh(box(1.5, 0.6, 4), M(0x6b4423), 0, 0.3, 0, g);
  mesh(box(1.2, 0.1, 3.6), M(0x8a5a32), 0, 0.6, 0, g);
  mesh(box(1.4, 0.05, 0.25), M(0x5e3b1f), 0, 0.65, 0.3, g);
  return g;
}

// ---------- Точки интереса ----------
export function makePOI(type) {
  const g = new THREE.Group();
  const st = M(PAL.stone), stD = M(PAL.stoneDark);
  if (type === 'ruins') {
    for (let i = 0; i < 3; i++) mesh(box(14 - i, 0.4, 9 - i), stD, 0, 0.2 + i * 0.4, 0, g);
    const br = [0, 0.6, 0.2, 0.8, 0, 0.5, 0.9, 0.3];
    for (let i = 0; i < 4; i++) { column(g, -4.5 + i * 3, 3, 5, 0.38, st, br[i]).position.y = 1.2; column(g, -4.5 + i * 3, -3, 5, 0.38, st, br[i + 4]).position.y = 1.2; }
    mesh(box(7, 0.6, 1), st, -1.5, 6.9, 3, g); // уцелевший архитрав
    for (let i = 0; i < 5; i++) mesh(cyl(0.38, 0.38, 1.6, 10), st, -6 + i * 2.8, 0.4, 6 + (i % 2), g).rotation.z = Math.PI / 2;
    mesh(box(1.4, 2, 1), M(PAL.marble), 0, 2.2, 0, g); // постамент
  } else if (type === 'village') {
    const spots = [[-6, -4], [5, -5], [-4, 6], [6, 5], [0, -9]];
    for (const [x, z] of spots) {
      const h = new THREE.Group(); h.position.set(x, 0, z); h.rotation.y = Math.random() * 6; g.add(h);
      mesh(box(3.5, 2, 3), M(0xc9a876), 0, 1, 0, h);
      mesh(box(1, 1.4, 0.1), M(0x3a2a1a), 0, 0.7, 1.52, h);
      if (Math.random() < 0.5) gableRoof(h, 3.5, 3, 2, 1.0, M(PAL.roofDark)).rotation.z = 0.15;
      else mesh(box(1.5, 0.8, 3), M(0xb89866), 1, 2.1, 0, h).rotation.z = 0.3; // обвал
    }
    mesh(cyl(1.1, 1.2, 0.9, 10), st, 0, 0.45, 0, g); // колодец
    mesh(cyl(0.8, 0.8, 0.95, 10), M(0x222222), 0, 0.5, 0, g);
  } else if (type === 'shrine') {
    mesh(cyl(4.5, 5, 0.5, 12), stD, 0, 0.25, 0, g);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; column(g, Math.cos(a) * 3.5, Math.sin(a) * 3.5, 3.5, 0.25, st, i === 2 ? 0.5 : 0).position.y = 0.5; }
    mesh(cyl(4, 4, 0.4, 12), st, 0, 4.6, 0, g);
    mesh(cone(4.2, 1.6, 12), M(0x8e9a6a), 0, 5.6, 0, g);
    mesh(box(1.2, 1.1, 0.8), M(PAL.marble), 0, 1.05, 0, g);
    const fire = mesh(cone(0.3, 0.6, 6), M(0x77ff88, { emissive: 0x33ff66, emissiveIntensity: 1.5 }), 0, 1.9, 0, g);
    g.userData.fire = fire;
  } else if (type === 'altar') {
    const dark = M(0x4a3b33);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; const s = mesh(box(1.2, 3.5 + (i % 3), 0.8), dark, Math.cos(a) * 7, 1.8, Math.sin(a) * 7, g); s.rotation.y = -a; s.rotation.z = (i % 2 ? 0.1 : -0.08); }
    mesh(box(3, 1.2, 1.8), dark, 0, 0.6, 0, g);
    mesh(box(2.6, 0.08, 1.4), M(0x6a0d0d, { emissive: 0x330000 }), 0, 1.24, 0, g);
    mesh(sph(0.3, 6), M(0xddddcc), 0.8, 1.45, 0.2, g); // череп
  } else if (type === 'cove') {
    for (let i = 0; i < 5; i++) mesh(G('rock', () => new THREE.DodecahedronGeometry(0.8, 0)), M(PAL.rock), Math.cos(i) * 6, 1, Math.sin(i * 2) * 4, g).scale.set(3, 2.5, 2.5);
    const boat = makeBoat(); boat.position.set(0, -0.2, 6); g.add(boat);
    mesh(box(0.2, 1.6, 0.2), M(PAL.wood), 1.5, 0.8, 3.5, g);
    mesh(box(0.6, 0.6, 0.6), M(0x6b4423), -1.5, 0.3, 3.5, g);
  }
  return g;
}
export function makeDen() {
  const g = new THREE.Group();
  const geo = G('rock', () => new THREE.DodecahedronGeometry(0.8, 0));
  for (let i = 0; i < 6; i++) { const a = i * 1.05; mesh(geo, M(0x8f7a62), Math.cos(a) * 3, 0.6, Math.sin(a) * 3, g).scale.set(2, 1.4 + (i % 2), 2); }
  for (let i = 0; i < 5; i++) mesh(box(0.1, 0.1, 0.7), M(0xeeeedd), Math.cos(i * 2) * 1.5, 0.05, Math.sin(i * 2) * 1.5, g).rotation.y = i;
  return g;
}

// ---------- Предметы на земле ----------
export function makeLootMesh(type) {
  const g = new THREE.Group();
  const def = ITEMS[type];
  const c = def ? def.color : 0xffffff;
  const k = def ? def.kind : '';
  if (type === 'hide') { mesh(box(0.9, 0.05, 0.6), M(c), 0, 0.05, 0, g); mesh(box(0.3, 0.05, 0.25), M(c), 0.5, 0.05, 0.2, g); }
  else if (type === 'gull') { const gl = makeGull(1); gl.rotation.z = Math.PI / 2; gl.position.y = 0.25; g.add(gl); }
  else if (k === 'token') mesh(G('oct', () => new THREE.OctahedronGeometry(0.22, 0)), M(c, { emissive: c, emissiveIntensity: 0.6 }), 0, 0.35, 0, g);
  else if (k === 'weapon') mesh(box(0.15, 0.9, 0.08), M(c, { metalness: 0.5, roughness: 0.4 }), 0, 0.6, 0, g).rotation.z = 0.6;
  else if (k === 'heal') { mesh(cyl(0.15, 0.2, 0.4, 6), M(c), 0, 0.3, 0, g); mesh(box(0.25, 0.08, 0.05), M(0xc0392b), 0, 0.35, 0.18, g); }
  else if (k === 'coins') mesh(sph(0.25, 6), M(c, { metalness: 0.6 }), 0, 0.3, 0, g).scale.set(1, 0.8, 1);
  else if (k === 'ingredient') mesh(G('ico', () => new THREE.IcosahedronGeometry(0.22, 0)), M(c, { emissive: c, emissiveIntensity: 0.3 }), 0, 0.3, 0, g);
  else if (type === 'map') mesh(cyl(0.08, 0.08, 0.6, 6), M(c), 0, 0.2, 0, g).rotation.z = Math.PI / 2;
  else if (type === 'tools') mesh(box(0.5, 0.25, 0.3), M(c), 0, 0.2, 0, g);
  else mesh(box(0.4, 0.3, 0.3), M(c, { emissive: c, emissiveIntensity: 0.4 }), 0, 0.3, 0, g);
  // свечение
  const ring = new THREE.Mesh(G('ring', () => new THREE.RingGeometry(0.5, 0.65, 16)), new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; g.add(ring);
  g.userData.ring = ring;
  return g;
}
export function makeClueMesh() {
  const g = new THREE.Group();
  mesh(box(0.35, 0.05, 0.25), M(0xffffff, { emissive: 0x66ccff, emissiveIntensity: 1.2 }), 0, 0.1, 0, g);
  const beam = new THREE.Mesh(cyl(0.15, 0.15, 6, 6), new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.35 }));
  beam.position.y = 3; g.add(beam);
  return g;
}

// ---------- Надписи ----------
export function makeLabel(text, color = '#fff') {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  ctx.font = 'bold 36px Georgia';
  const w = Math.ceil(ctx.measureText(text).width) + 24;
  c.width = w; c.height = 52;
  ctx.font = 'bold 36px Georgia';
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, w, 52);
  ctx.fillStyle = color; ctx.textBaseline = 'middle'; ctx.fillText(text, 12, 27);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sp.scale.set(w / 52 * 0.45, 0.45, 1);
  sp.renderOrder = 10;
  return sp;
}
