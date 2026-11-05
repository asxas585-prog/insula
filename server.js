// Insula Deserta — авторитарный игровой сервер (прототип)
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import * as S from './public/shared.js';

const { CFG, BUILDINGS, ITEMS, ROLES, SECRET, ROLE_TASKS, ANIMALS, COLORS, SPECS, ROLE_TOKEN } = S;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const DEV = process.env.DEV === '1' || process.argv.includes('--dev');
const FAST = process.env.FAST === '1' || process.argv.includes('--dev');
if (FAST) S.applyFast();
const MIN_PLAYERS = DEV ? 1 : 3;
const MAX_PLAYERS = 8;

// ---------- Статика ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  let file;
  if (url.startsWith('/vendor/')) file = path.join(__dirname, 'node_modules/three/build', path.basename(url));
  else if (url.startsWith('/addons/')) {
    const rel = path.normalize(url.slice('/addons/'.length)).replace(/^(\.\.[/\\])+/, '');
    file = path.join(__dirname, 'node_modules/three/examples/jsm', rel);
  }
  else file = path.join(__dirname, 'public', url === '/' ? 'index.html' : path.normalize(url).replace(/^(\.\.[/\\])+/, ''));
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});
const wss = new WebSocketServer({ server });

// ---------- Утилиты ----------
const now = () => Date.now() / 1000;
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const rand = (a, b) => a + Math.random() * (b - a);
let uid = 100000;
const nid = () => uid++;
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---------- Состояние ----------
const conns = new Map(); // ws -> player
let G;
function newGame() {
  const keep = G ? [...G.players.values()] : [];
  G = {
    phase: 'lobby', seed: Math.floor(Math.random() * 1e9), world: null,
    players: new Map(), buildings: [], animals: [], nodes: new Map(), loot: new Map(), clues: [],
    store: { log: 0, sand: 0, plank: 0, brick: 0, lemon: 0, silk: 0, hide: 0, denarii: 0 },
    projectiles: [], gulls: [], nextGull: 0,
    ship: { state: 'none', del: {}, returnAt: 0, cargo: 0 },
    voyages: 0, vote: null, lastVote: -999, monster: null, start: 0, t: 0,
    nextRaid: 0, nextBreed: 0, ended: null,
  };
  for (const p of keep) if (p.ws) { resetPlayer(p); G.players.set(p.id, p); }
}
let pidSeq = 1;
function resetPlayer(p) {
  Object.assign(p, {
    role: 'explorer', formerRole: null, revealed: false, x: 0, z: 0, ry: 0, anim: 0,
    hp: 100, maxHp: 100, alive: true, ghost: false, respawnAt: 0, lastHit: 0,
    inv: { log: 0, sand: 0, plank: 0, brick: 0, lemon: 0, silk: 0, hide: 0 }, items: [], eq: -1, masked: false,
    xp: 0, level: 1, done: [], lastSecret: -999, atkAt: 0, gatherAt: 0, clues: [], treasure: null, ritualDone: false,
    vote: null, kills: 0,
  });
}
newGame();

const send = (p, msg) => { if (p.ws && p.ws.readyState === 1) p.ws.send(JSON.stringify(msg)); };
const broadcast = (msg) => { const s = JSON.stringify(msg); for (const p of G.players.values()) if (p.ws && p.ws.readyState === 1) p.ws.send(s); };
function log(text, kind = 'info', to = null) {
  const m = { type: 'log', text, kind };
  if (to) send(to, m); else broadcast(m);
}
const gtime = () => (G.phase === 'playing' ? now() - G.start : 0);
const isNight = () => S.dayFrac(gtime()) > 1 - CFG.nightFrac;
const living = () => [...G.players.values()].filter((p) => p.alive && !p.ghost);

function lobbyState() {
  const list = [...G.players.values()];
  broadcast({
    type: 'lobby', minPlayers: MIN_PLAYERS, maxPlayers: MAX_PLAYERS, dev: DEV, fast: FAST,
    players: list.map((p, i) => ({ id: p.id, name: p.name, spec: p.spec, color: p.color, host: i === 0, devRole: p.devRole || '' })),
  });
}

// ---------- Старт игры ----------
function startGame() {
  const W = S.generateWorld(G.seed);
  G.world = W;
  for (const n of W.nodes) G.nodes.set(n.id, { ...n, regenAt: 0 });
  for (const l of W.loot) G.loot.set(l.id, { ...l });
  for (const d of W.dens) for (let i = 0; i < d.count; i++) spawnAnimal(d.type, d, rand(2, 7));
  for (let i = 0; i < CFG.gullMax; i++) spawnGull(false);
  G.nextGull = CFG.gullRespawn;
  G.phase = 'playing';
  G.start = now();
  G.nextRaid = CFG.raidFirst;
  G.nextBreed = CFG.breedInterval;

  // Распределение скрытых ролей: в каждой игре обязательно Сыщик, Сын императора и минимум одна тёмная роль
  const ps = shuffle([...G.players.values()]);
  const n = ps.length;
  const badCount = n >= 7 ? 3 : n >= 5 ? 2 : 1;
  const pool = ['detective', 'heir'];
  shuffle(['impostor', 'warlock', 'smuggler']).slice(0, badCount).forEach((r) => pool.push(r));
  while (pool.length < n) pool.push('explorer');
  // (в тестовых играх меньше чем на 3 игрока часть ролей просто не достанется)
  const roles = shuffle(pool.slice(0, Math.max(n, 3))).slice(0, n);
  if (n < 3) roles.sort(() => Math.random() - 0.5);
  ps.forEach((p, i) => {
    resetPlayer(p);
    p.role = DEV && p.devRole ? p.devRole : roles[i];
    if (p.spec === 'warrior') { p.maxHp = 130; p.hp = 130; }
    const a = (i / n) * Math.PI * 2;
    p.x = W.camp.x + Math.cos(a) * 3; p.z = W.camp.z + Math.sin(a) * 3;
  });
  for (const p of G.players.values()) {
    send(p, {
      type: 'init', id: p.id, world: W, fast: FAST, dev: DEV,
      role: p.role, roster: [...G.players.values()].map((q) => ({ id: q.id, name: q.name, color: q.color, spec: q.spec })),
    });
  }
  log('Корабль высадил вас на пустынном острове. Постройте Склад на берегу (клавиша B).', 'good');
}

function spawnAnimal(type, den, spread = 4) {
  const a = rand(0, Math.PI * 2);
  const def = ANIMALS[type];
  const an = { id: nid(), type, x: den.x + Math.cos(a) * spread, z: den.z + Math.sin(a) * spread, ry: 0, hp: def.hp, maxHp: def.hp,
    den, mode: 'home', wp: null, cd: 0, target: null, raidUntil: 0, hurtBy: null, hurtAt: 0, atk: 0 };
  G.animals.push(an);
  return an;
}

// ---------- Инвентарь ----------
const resCount = (p) => S.CARRY_RES.reduce((s, k) => s + p.inv[k], 0);
const capOf = (p) => CFG.invCap + (p.role === 'heir' ? CFG.heirCapBonus : 0) + (p.spec === 'gatherer' ? CFG.gathererCapBonus : 0);
const freeCap = (p) => Math.max(0, capOf(p) - resCount(p));
const hasItem = (p, type) => p.items.findIndex((i) => i.type === type);
function addItem(p, type) {
  if (p.items.length >= CFG.slots) return false;
  p.items.push({ id: nid(), type });
  return true;
}
function removeItemAt(p, idx) {
  p.items.splice(idx, 1);
  if (p.eq === idx) p.eq = -1; else if (p.eq > idx) p.eq--;
}
function removeItem(p, type) { const i = hasItem(p, type); if (i >= 0) removeItemAt(p, i); return i >= 0; }
function addXp(p, n) {
  if (p.role === 'heir') n *= 2;
  p.xp += n;
  const lvl = Math.floor(Math.sqrt(p.xp / 60)) + 1;
  if (lvl > p.level) {
    p.level = lvl;
    p.maxHp = 100 + (p.spec === 'warrior' ? 30 : 0) + (lvl - 1) * 10;
    p.hp = Math.min(p.maxHp, p.hp + 20);
    log(`Новый уровень: ${lvl}!`, 'good', p);
  }
}
function dropLoot(type, x, z, extra = {}, spread = 1) {
  const l = { id: nid(), item: type, x: x + rand(-spread, spread), z: z + rand(-spread, spread), ...extra };
  G.loot.set(l.id, l);
  broadcast({ type: 'lootAdd', loot: l });
}

// ---------- Постройки ----------
const builtOf = (type) => G.buildings.filter((b) => b.type === type && b.built && !b.ruined);
const nearBuilding = (p, b, extra = 3.5) => dist(p, b) < BUILDINGS[b.type].r + extra;
const warehouse = () => G.buildings.find((b) => b.type === 'warehouse' && b.built);

function canPlace(type, x, z) {
  const def = BUILDINGS[type];
  if (!def) return 'Нет такой постройки';
  if (G.buildings.filter((b) => b.type === type).length >= def.max) return 'Достигнут лимит таких построек';
  for (const r of def.req) if (!G.buildings.some((b) => b.type === r && b.built)) return `Сначала нужна постройка: ${BUILDINGS[r].name}`;
  if (def.voyages && G.voyages < def.voyages) return `Нужно совершить торговых рейсов: ${def.voyages} (сейчас ${G.voyages})`;
  const h = S.terrainHeight(x, z);
  if (h < 0.2) return 'Слишком близко к воде';
  if (h > 6.5) return 'Слишком высоко — здесь горы';
  if (S.islandT(x, z) > 0.98) return 'За пределами острова';
  if (def.shore && !S.isShore(x, z)) return 'Нужно строить у самого берега';
  // уклон
  const d = def.r * 0.7;
  const hs = [S.terrainHeight(x + d, z), S.terrainHeight(x - d, z), S.terrainHeight(x, z + d), S.terrainHeight(x, z - d)];
  if (Math.max(...hs) - Math.min(...hs) > 3.5) return 'Слишком неровная земля';
  for (const b of G.buildings) if (Math.hypot(b.x - x, b.z - z) < BUILDINGS[b.type].r + def.r + 1) return 'Мешает другая постройка';
  for (const p of G.world.pois) if (Math.hypot(p.x - x, p.z - z) < 16 + def.r) return 'Слишком близко к древним руинам';
  return null;
}
function placeBuilding(p, type, x, z, ry) {
  const err = canPlace(type, x, z);
  if (err) return log(err, 'bad', p);
  const def = BUILDINGS[type];
  const b = { id: nid(), type, x, z, ry, built: false, ruined: false, del: {}, hp: def.hp * 0.3, maxHp: def.hp, stock: 0, farmT: 0, nextCrop: 'lemon' };
  for (const k in def.cost) b.del[k] = 0;
  G.buildings.push(b);
  log(`${p.name} заложил(а) стройку: ${def.name}`, 'info');
}
function takeFrom(p, from, res, want) {
  if (want <= 0) return 0;
  if (from === 'store') {
    const w = warehouse();
    if (!w || dist(p, w) > 60) return 0; // со склада можно брать только в пределах поселения
    const n = Math.min(want, G.store[res] || 0);
    G.store[res] -= n; return n;
  }
  if (res === 'denarii') return 0;
  const n = Math.min(want, p.inv[res] || 0);
  p.inv[res] -= n; return n;
}
function deliver(p, b, from) {
  if (b.built) return;
  const def = BUILDINGS[b.type];
  let total = 0;
  for (const k in def.cost) {
    const n = takeFrom(p, from, k, def.cost[k] - b.del[k]);
    b.del[k] += n; total += n;
  }
  if (!total) return log(from === 'store' ? 'На складе нет нужных ресурсов' : 'У вас нет нужных ресурсов', 'bad', p);
  addXp(p, Math.ceil(total / 2));
  const fullFrac = Object.keys(def.cost).reduce((s, k) => s + b.del[k] / def.cost[k], 0) / Object.keys(def.cost).length;
  b.hp = Math.max(b.hp, def.hp * (0.3 + 0.7 * fullFrac));
  if (Object.keys(def.cost).every((k) => b.del[k] >= def.cost[k])) {
    b.built = true; b.hp = b.maxHp;
    log(`Построено: ${def.name}!`, 'good');
    addXp(p, 30);
    if (b.type === 'townhall') endGame({ side: 'good', text: 'Ратуша возведена! Поселение основано, торговля с Римом налажена.' });
  }
}
function repairBuilding(p, b, from) {
  const missing = b.maxHp - b.hp;
  if (missing <= 0) return;
  const need = Math.ceil(missing / CFG.hpPerPlank);
  const n = takeFrom(p, from, 'plank', need);
  if (!n) return log('Нужны доски для ремонта', 'bad', p);
  b.hp = Math.min(b.maxHp, b.hp + n * CFG.hpPerPlank);
  if (b.hp >= b.maxHp && b.ruined) { b.ruined = false; log(`${BUILDINGS[b.type].name} восстановлен(а)`, 'good'); }
  addXp(p, n);
}
function damageBuilding(b, dmg) {
  if (b.ruined) return;
  b.hp -= dmg;
  if (b.hp <= 0) {
    b.hp = 0;
    if (!b.built) {
      // недостроенное — теряет половину вложенного
      for (const k in b.del) b.del[k] = Math.floor(b.del[k] / 2);
      b.hp = b.maxHp * 0.2;
      log(`Стройка «${BUILDINGS[b.type].name}» разорена! Часть материалов потеряна.`, 'bad');
    } else {
      b.ruined = true;
      log(`${BUILDINGS[b.type].name} разрушен(а)! Почините досками.`, 'bad');
      if (b.type === 'shipyard' && G.ship.state === 'docked') G.ship.state = 'damaged';
    }
    return true;
  }
  return false;
}

// ---------- Бой ----------
function killPlayer(p, byPlayer, byMonster = false) {
  p.alive = false;
  p.hp = 0;
  if (byPlayer) {
    p.ghost = true;
    for (const it of p.items) dropLoot(it.type, p.x, p.z);
    p.items = []; p.eq = -1;
    log(`${p.name} погиб(ла) от руки другого поселенца...`, 'bad');
    send(p, { type: 'dead', permanent: true });
    if (p.role === 'heir' && !G.ended) {
      endGame({ side: 'bad', text: `Сын императора (${p.name}) убит! Тёмная сторона побеждает.` });
    }
  } else {
    p.respawnAt = now() + CFG.respawnTime;
    log(`${p.name} ${byMonster ? 'раздавлен(а) чудовищем' : 'растерзан(а) зверями'}. Возрождение через ${CFG.respawnTime} с.`, 'bad');
    send(p, { type: 'dead', permanent: false, t: CFG.respawnTime, monster: byMonster });
  }
}
function damagePlayer(p, dmg, attacker) {
  if (!p.alive || p.ghost || G.ended) return;
  p.hp -= dmg; p.lastHit = now();
  broadcast({ type: 'fx', fx: 'hit', x: p.x, z: p.z });
  if (p.hp <= 0) killPlayer(p, attacker && attacker.name ? attacker : null, attacker && attacker.type === 'monster');
}
// урон по зверю/чудовищу; при смерти — опыт, шкуры
function hitCreature(a, dmg, p) {
  const t = now();
  a.hp -= dmg; a.hurtBy = p.id; a.hurtAt = t;
  broadcast({ type: 'fx', fx: 'hit', x: a.x, z: a.z });
  if (a.hp > 0) return;
  addXp(p, ANIMALS[a.type].xp);
  if (a.type === 'monster') {
    log(`Чудовище из песков повержено! (${p.name} нанёс последний удар)`, 'good');
    const owner = G.players.get(G.monster.owner);
    if (owner) { owner.plotFailed = true; log('Ваше чудовище уничтожено. Ваш замысел провален.', 'bad', owner); }
    G.monster = null;
  } else if (ANIMALS[a.type].hides) {
    dropLoot('hide', a.x, a.z, { n: ANIMALS[a.type].hides }, 0.5);
  }
}
const playerDmg = (p, base) => base * (p.spec === 'warrior' ? 1.4 : 1) * (1 + (p.level - 1) * 0.05);
function playerAttack(p, ry) {
  const t = now();
  const it = p.eq >= 0 ? p.items[p.eq] : null;
  const wpn = it && ITEMS[it.type].kind === 'weapon' ? ITEMS[it.type] : S.FIST;
  if (t - p.atkAt < wpn.cd) return;
  p.atkAt = t; p.ry = ry; p.atk = t;
  if (wpn.thrown) {
    // бросок копья: предмет покидает инвентарь и летит
    removeItemAt(p, p.eq);
    p.atkType = 'throw';
    spawnProjectile(p, 'spear', ry, wpn.speed, wpn.range, playerDmg(p, wpn.dmg));
    return;
  }
  p.atkType = 'melee';
  const dmg = playerDmg(p, wpn.dmg);
  const fx = Math.sin(ry), fz = Math.cos(ry);
  const inArc = (e, extra = 0) => {
    const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz);
    if (d > wpn.range + extra) return false;
    if (d < 0.8) return true;
    return (dx * fx + dz * fz) / d > 0.45;
  };
  let hit = false;
  const targets = [...G.animals];
  if (G.monster) targets.push(G.monster);
  for (const a of targets) {
    if (a.hp <= 0 || !inArc(a, a.type === 'monster' ? 2.5 : 0.6)) continue;
    hitCreature(a, dmg, p); hit = true;
    break;
  }
  if (!hit) {
    for (const q of G.players.values()) {
      if (q === p || !q.alive || q.ghost || !inArc(q, 0.3)) continue;
      damagePlayer(q, dmg, p);
      if (!q.alive) p.kills++;
      break;
    }
  }
  G.animals = G.animals.filter((a) => a.hp > 0);
}

// ---------- Снаряды: брошенное копьё и чайка ----------
function spawnProjectile(p, type, ry, speed, range, dmg) {
  const pr = { id: nid(), type, owner: p.id, x: p.x + Math.sin(ry) * 0.8, z: p.z + Math.cos(ry) * 0.8, sx: p.x, sz: p.z,
    dx: Math.sin(ry), dz: Math.cos(ry), speed, max: range, dist: 0, dmg, born: gtime() };
  G.projectiles.push(pr);
}
function projectileHit(pr, kind, target) {
  const owner = G.players.get(pr.owner);
  if (pr.type === 'spear') {
    if (kind === 'gull') {
      G.gulls = G.gulls.filter((g) => g !== target);
      dropLoot('gull', target.x, target.z, {}, 0.3);
      if (owner) log('Чайка поймана! Подберите её.', 'good', owner);
    } else if (kind === 'animal') hitCreature(target, pr.dmg, owner);
    else if (kind === 'player') { damagePlayer(target, pr.dmg, owner); if (!target.alive && owner) owner.kills++; }
    G.animals = G.animals.filter((a) => a.hp > 0);
  } else if (pr.type === 'gull' && kind === 'player') gullStrike(owner, target);
}
function gullStrike(det, q) {
  q.masked = false;
  if (ROLES[q.role].side === 'bad' && !q.revealed) {
    dropLoot(ROLE_TOKEN[q.role], q.x, q.z, { from: q.name }, 1.5);
    // заодно выпадает один квестовый предмет, если он есть
    const qi = q.items.findIndex((i) => ['quest', 'ingredient', 'treasure'].includes(ITEMS[i.type].kind));
    if (qi >= 0) { const it = q.items[qi]; removeItemAt(q, qi); dropLoot(it.type, q.x, q.z, {}, 1.5); }
    log(`${det ? det.name : 'Сыщик'} бросил чайку в ${q.name} — из него что-то выпало!`, 'warn');
  } else {
    log(`${det ? det.name : 'Сыщик'} бросил чайку в ${q.name}. Ничего не выпало.`, 'info');
  }
}
function updateProjectiles(dt) {
  const keep = [];
  for (const pr of G.projectiles) {
    let done = false;
    const step = pr.speed * dt, n = Math.ceil(step / 0.5);
    for (let i = 0; i < n && !done; i++) {
      pr.x += pr.dx * step / n; pr.z += pr.dz * step / n; pr.dist += step / n;
      if (S.terrainHeight(pr.x, pr.z) > CFG.mountainH - 2) { done = true; break; }
      if (pr.type === 'spear') {
        const g = G.gulls.find((g) => Math.hypot(g.x - pr.x, g.z - pr.z) < 1.3);
        if (g) { projectileHit(pr, 'gull', g); done = true; break; }
        const targets = G.monster ? [...G.animals, G.monster] : G.animals;
        const a = targets.find((a) => a.hp > 0 && Math.hypot(a.x - pr.x, a.z - pr.z) < (a.type === 'monster' ? 3 : 1.3));
        if (a) { projectileHit(pr, 'animal', a); done = true; break; }
      }
      const q = [...G.players.values()].find((q) => q.id !== pr.owner && q.alive && !q.ghost && Math.hypot(q.x - pr.x, q.z - pr.z) < 1.1);
      if (q) { projectileHit(pr, 'player', q); done = true; break; }
      if (pr.dist >= pr.max) done = true;
    }
    if (!done) { keep.push(pr); continue; }
    if (pr.type === 'spear') {
      if (S.terrainHeight(pr.x, pr.z) > -2) dropLoot('spear', pr.x - pr.dx, pr.z - pr.dz, {}, 0.2);
      else { const o = G.players.get(pr.owner); if (o) log('Копьё утонуло в море...', 'bad', o); }
    }
  }
  G.projectiles = keep;
}

// ---------- Чайки ----------
function spawnGull(fromSea) {
  const spots = G.world.gullSpots;
  if (!spots.length) return;
  const s = spots[Math.floor(Math.random() * spots.length)];
  const g = { id: nid(), x: s.x + rand(-2, 2), z: s.z + rand(-2, 2), ry: rand(0, 6.28), state: 'idle', tx: 0, tz: 0, hop: 0 };
  if (fromSea) { const a = Math.atan2(s.z, s.x); g.x = s.x + Math.cos(a) * 50; g.z = s.z + Math.sin(a) * 50; g.state = 'fly'; g.tx = s.x; g.tz = s.z; }
  G.gulls.push(g);
}
function updateGulls(dt) {
  for (const g of G.gulls) {
    if (g.state === 'fly') {
      const dx = g.tx - g.x, dz = g.tz - g.z, d = Math.hypot(dx, dz);
      if (d < 0.5) { g.state = 'idle'; continue; }
      const st = Math.min(d, 13 * dt);
      g.x += dx / d * st; g.z += dz / d * st; g.ry = Math.atan2(dx, dz);
      continue;
    }
    // спокойная чайка вспархивает, если кто-то подошёл близко
    if (living().some((p) => Math.hypot(p.x - g.x, p.z - g.z) < 6)) {
      const spots = G.world.gullSpots, s = spots[Math.floor(Math.random() * spots.length)];
      g.state = 'fly'; g.tx = s.x + rand(-2, 2); g.tz = s.z + rand(-2, 2);
      continue;
    }
    g.hop -= dt;
    if (g.hop <= 0) { g.hop = rand(1.5, 5); g.ry = rand(0, 6.28); const nx = g.x + Math.sin(g.ry) * 0.8, nz = g.z + Math.cos(g.ry) * 0.8; if (S.terrainHeight(nx, nz) > 0) { g.x = nx; g.z = nz; } }
  }
}

// ---------- Тайные действия ----------
function poiNear(p, type, r = 14) { return G.world.pois.find((q) => q.type === type && dist(p, q) < r); }
function secretOptions(p) {
  if (!p.alive || p.ghost || p.revealed || p.plotFailed) return [];
  const tasks = ROLE_TASKS[p.role];
  if (!tasks) return [];
  if (now() - p.lastSecret < CFG.secretCd) return [];
  const res = [];
  const notDone = (a) => !p.done.includes(a);
  if (p.role === 'impostor' && hasItem(p, 'tools') >= 0) {
    const b = G.buildings.filter((b) => b.built && !b.ruined && nearBuilding(p, b)).sort((a, c) => dist(p, a) - dist(p, c))[0];
    if (b && notDone('sabotage')) res.push({ action: 'sabotage', target: b.id });
    const w = warehouse();
    const goods = G.store.plank + G.store.brick + G.store.lemon + G.store.silk + G.store.hide;
    if (w && nearBuilding(p, w) && goods >= 5 && notDone('steal')) res.push({ action: 'steal', target: w.id });
    const sy = builtOf('shipyard')[0];
    if (sy && nearBuilding(p, sy) && G.ship.state === 'docked' && notDone('wreck')) res.push({ action: 'wreck', target: sy.id });
  }
  if (p.role === 'warlock') {
    const ingr = p.items.filter((i) => ITEMS[i.type].kind === 'ingredient').length;
    if (notDone('brew') && ingr >= 2 && poiNear(p, 'shrine')) res.push({ action: 'brew' });
    if (p.done.includes('brew') && notDone('ritual') && hasItem(p, 'darkpotion') >= 0 && poiNear(p, 'ruins')) res.push({ action: 'ritual' });
    if (p.done.includes('ritual') && notDone('summon') && poiNear(p, 'altar')) res.push({ action: 'summon' });
  }
  if (p.role === 'smuggler') {
    if (notDone('decipher') && hasItem(p, 'map') >= 0) res.push({ action: 'decipher' });
    if (p.treasure && notDone('dig') && dist(p, p.treasure) < 4) res.push({ action: 'dig' });
    if (p.done.includes('dig') && hasItem(p, 'treasure') >= 0 && poiNear(p, 'cove', 12)) res.push({ action: 'smuggle' });
  }
  return res;
}
function doSecret(p, action) {
  const opt = secretOptions(p).find((o) => o.action === action);
  if (!opt) return log('Сейчас это сделать нельзя', 'bad', p);
  const def = SECRET[action];
  p.lastSecret = now();
  switch (action) {
    case 'sabotage': {
      const b = G.buildings.find((x) => x.id === opt.target);
      damageBuilding(b, b.maxHp * 0.65);
      break;
    }
    case 'steal': {
      let left = 10;
      for (const k of shuffle(['plank', 'brick', 'lemon', 'silk', 'hide'])) { const n = Math.min(left, G.store[k]); G.store[k] -= n; left -= n; }
      log('Со склада пропала часть припасов!', 'bad');
      break;
    }
    case 'wreck': G.ship.state = 'damaged'; log('Корабль на верфи повреждён! Нужен ремонт.', 'bad'); break;
    case 'brew': {
      let k = 0;
      for (let i = p.items.length - 1; i >= 0 && k < 2; i--) if (ITEMS[p.items[i].type].kind === 'ingredient') { removeItemAt(p, i); k++; }
      addItem(p, 'darkpotion');
      break;
    }
    case 'ritual': removeItem(p, 'darkpotion'); p.ritualDone = true; log('Небо на миг потемнело... Кто-то творит тёмную магию.', 'bad'); break;
    case 'summon': {
      const alt = poiNear(p, 'altar');
      const m = { id: nid(), type: 'monster', x: alt.x, z: alt.z, ry: 0, hp: ANIMALS.monster.hp, maxHp: ANIMALS.monster.hp,
        owner: p.id, born: now(), destroyed: 0, cd: 0, target: null, atk: 0 };
      G.monster = m;
      log('Земля дрожит! Из песков у Древнего алтаря поднялось ЧУДОВИЩЕ и идёт к поселению!', 'bad');
      broadcast({ type: 'fx', fx: 'summon', x: m.x, z: m.z });
      break;
    }
    case 'decipher': {
      removeItem(p, 'map');
      const spots = G.world.treasureSpots;
      p.treasure = spots[Math.floor(Math.random() * spots.length)];
      log('Вы расшифровали карту. Место клада отмечено на карте (M).', 'info', p);
      break;
    }
    case 'dig': {
      if (!addItem(p, 'treasure')) { p.lastSecret = 0; return log('Нет места в инвентаре для сокровища', 'bad', p); }
      break;
    }
    case 'smuggle': removeItem(p, 'treasure'); break;
  }
  p.done.push(action);
  // улика на месте действия
  const prev = p.done.length - 1;
  const color = COLORS.find((c) => c.hex === p.color);
  const hints = [
    `Рядом брошено снаряжение — похоже, это был ${SPECS[p.spec].name.toLowerCase()}.`,
    `На месте зацепился лоскут туники ${color ? color.name : 'неясного'} цвета.`,
    `На песке нацарапана буква «${p.name[0].toUpperCase()}».`,
  ];
  G.clues.push({ id: nid(), x: p.x + rand(-1.5, 1.5), z: p.z + rand(-1.5, 1.5), action, label: def.clue, culprit: p.id,
    hint: hints[Math.min(prev, 2)], t: gtime() });
  broadcast({ type: 'fx', fx: 'secret', x: p.x, z: p.z });
  log(`Выполнено: ${def.name} (${p.done.length}/3)`, 'good', p);
  addXp(p, 20);
  if (p.done.length >= 3 && p.role !== 'warlock') {
    endGame({ side: 'bad', who: p.id, text: p.role === 'smuggler'
      ? `Контрабандист ${p.name} тайно вывез сокровище с острова!` : `Импостер ${p.name} сорвал все планы поселенцев!` });
  }
}

// ---------- Голосование ----------
function callVote(p) {
  if (p.role !== 'detective' || !p.alive || p.ghost) return;
  const w = warehouse();
  if (!w || !nearBuilding(p, w, 6)) return log('Голосование созывается у Склада', 'bad', p);
  if (p.clues.length < CFG.cluesForVote) return log(`Нужно собрать хотя бы ${CFG.cluesForVote} улики`, 'bad', p);
  if (gtime() - G.lastVote < CFG.voteCd) return log('Слишком рано для нового голосования', 'bad', p);
  if (G.vote) return;
  G.vote = { endsAt: now() + CFG.voteTime, by: p.name, votes: {} };
  for (const q of G.players.values()) q.vote = null;
  log(`${p.name} (Сыщик) созывает народное собрание! Голосуйте (клавиша V).`, 'warn');
  broadcast({ type: 'voteOpen', by: p.name, ends: CFG.voteTime, clues: p.clues.map((c) => `${c.label}: ${c.hint}`),
    candidates: living().map((q) => ({ id: q.id, name: q.name })) });
}
function finishVote() {
  const v = G.vote; G.vote = null; G.lastVote = gtime();
  const tally = {};
  for (const [, t] of Object.entries(v.votes)) tally[t] = (tally[t] || 0) + 1;
  const skip = tally.skip || 0;
  delete tally.skip;
  const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);
  let text;
  if (!sorted.length || sorted[0][1] <= skip || (sorted[1] && sorted[1][1] === sorted[0][1])) {
    text = 'Собрание не пришло к единому мнению.';
  } else {
    const acc = G.players.get(Number(sorted[0][0]));
    if (acc && ROLES[acc.role].side === 'bad') {
      text = `${acc.name} разоблачён(а)! Это был(а) ${ROLES[acc.role].name}. Теперь — простой Исследователь.`;
      acc.formerRole = acc.role; acc.role = 'explorer'; acc.revealed = true; acc.masked = false;
      send(acc, { type: 'role', role: 'explorer', revealed: true });
    } else if (acc) {
      text = `${acc.name} оказался(лась) честным поселенцем.`;
    }
  }
  broadcast({ type: 'voteClose', text, tally: Object.entries(tally).map(([id, n]) => ({ name: G.players.get(Number(id))?.name, n })), skip });
  log(text, 'warn');
}

// ---------- Конец игры ----------
function endGame(res) {
  if (G.ended) return;
  G.ended = res; G.phase = 'ended';
  broadcast({ type: 'end', ...res, roles: [...G.players.values()].map((p) => ({ name: p.name, role: ROLES[p.formerRole || p.role].name,
    side: ROLES[p.formerRole || p.role].side, revealed: p.revealed, done: p.done.length, color: p.color })) });
}

// ---------- ИИ зверей ----------
function moveToward(e, tx, tz, speed, dt) {
  const dx = tx - e.x, dz = tz - e.z, d = Math.hypot(dx, dz);
  if (d < 0.05) return d;
  const step = Math.min(d, speed * dt);
  const nx = e.x + (dx / d) * step, nz = e.z + (dz / d) * step;
  const nh = S.terrainHeight(nx, nz);
  if (nh > -0.3 && (nh < CFG.mountainH || e.type === 'monster')) { e.x = nx; e.z = nz; } else e.wp = null;
  e.ry = Math.atan2(dx, dz);
  return d;
}
function nearestPlayer(e, r) {
  let best = null, bd = r;
  for (const p of living()) { const d = dist(e, p); if (d < bd) { bd = d; best = p; } }
  return best;
}
function updateAnimals(dt) {
  const t = now();
  const night = isNight();
  for (const a of G.animals) {
    const def = ANIMALS[a.type];
    a.cd -= dt;
    const fromDen = dist(a, a.den);
    if (a.mode === 'raid' && t > a.raidUntil) a.mode = 'home';
    let tp = null;
    if (a.hurtBy && t - a.hurtAt < 12) { const h = G.players.get(a.hurtBy); if (h && h.alive && !h.ghost && dist(a, h) < 35) tp = h; }
    if (!tp && (a.mode === 'raid' || fromDen < def.leash)) tp = nearestPlayer(a, def.aggro * (night ? 1.5 : 1) * (a.mode === 'raid' ? 0.6 : 1));
    if (tp) {
      const d = moveToward(a, tp.x, tp.z, def.speed, dt);
      if (d < def.reach && a.cd <= 0) { a.cd = def.atkCd; a.atk = t; damagePlayer(tp, def.dmg, a); }
      if (fromDen > def.leash * 1.6 && a.mode !== 'raid') { a.hurtBy = null; a.mode = 'home'; }
      continue;
    }
    if (a.mode === 'raid') {
      let b = G.buildings.find((x) => x.id === a.target && !x.ruined);
      if (!b) {
        const cands = G.buildings.filter((x) => !x.ruined);
        b = cands.sort((p, q) => dist(a, p) - dist(a, q))[0];
        a.target = b ? b.id : null;
        if (!b) { a.mode = 'home'; continue; }
      }
      const d = moveToward(a, b.x, b.z, def.speed * 0.85, dt);
      if (d < BUILDINGS[b.type].r + 1.2 && a.cd <= 0) {
        a.cd = def.atkCd; a.atk = t;
        if (damageBuilding(b, def.bldg)) a.target = null;
      }
      continue;
    }
    // бродим вокруг логова
    if (!a.wp || dist(a, a.wp) < 1) {
      if (Math.random() < dt * 0.4) { const ang = rand(0, 6.28), r = rand(2, 15); a.wp = { x: a.den.x + Math.cos(ang) * r, z: a.den.z + Math.sin(ang) * r }; }
    } else moveToward(a, a.wp.x, a.wp.z, def.speed * 0.35, dt);
  }
}
function updateMonster(dt) {
  const m = G.monster; if (!m) return;
  const def = ANIMALS.monster, t = now();
  m.cd -= dt;
  const owner = G.players.get(m.owner);
  if (t - m.born > CFG.monsterWinTime || m.destroyed >= CFG.monsterWinDestroy) {
    return endGame({ side: 'bad', who: m.owner, text: `Колдун ${owner ? owner.name : ''} призвал чудовище, и оно опустошило остров!` });
  }
  const tp = nearestPlayer(m, def.aggro);
  if (tp) {
    const d = moveToward(m, tp.x, tp.z, def.speed * 1.2, dt);
    if (d < def.reach && m.cd <= 0) { m.cd = def.atkCd; m.atk = t; damagePlayer(tp, def.dmg, m); }
    return;
  }
  const order = ['townhall', 'warehouse', 'shipyard', 'workshop', 'farm'];
  let b = G.buildings.find((x) => x.id === m.target && !x.ruined);
  if (!b) {
    const c = G.buildings.filter((x) => !x.ruined).sort((p, q) => order.indexOf(p.type) - order.indexOf(q.type) || dist(m, p) - dist(m, q));
    b = c[0]; m.target = b ? b.id : null;
  }
  if (!b) { moveToward(m, G.world.camp.x, G.world.camp.z, def.speed, dt); return; }
  const d = moveToward(m, b.x, b.z, def.speed, dt);
  if (d < BUILDINGS[b.type].r + 2 && m.cd <= 0) {
    m.cd = def.atkCd; m.atk = t;
    if (damageBuilding(b, def.bldg) && b.ruined) m.destroyed++;
  }
}

// ---------- Главный цикл ----------
let lastTick = now();
let tickN = 0;
function tick() {
  const t = now(), dt = Math.min(0.2, t - lastTick); lastTick = t;
  tickN++;
  if (G.phase !== 'playing') return;
  const gt = gtime();

  // возрождение и регенерация
  for (const p of G.players.values()) {
    if (!p.alive && !p.ghost && p.respawnAt && t > p.respawnAt) {
      const w = G.world.camp; // возрождение у костра лагеря
      p.alive = true; p.hp = p.maxHp; p.respawnAt = 0;
      p.x = w.x + rand(-3, 3); p.z = w.z - 3 + rand(-2, 2);
      send(p, { type: 'respawn', x: p.x, z: p.z });
    }
    if (p.alive && t - p.lastHit > 10 && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + dt * 0.5);
    if (p.alive && !p.ghost && S.inOasisWater(p.x, p.z)) p.hp = Math.min(p.maxHp, p.hp + dt * CFG.oasisHeal);
  }
  // ресурсы восстанавливаются
  if (tickN % 20 === 0) for (const n of G.nodes.values()) {
    if (n.amount < n.max && t > n.regenAt) { n.amount++; n.regenAt = t + CFG.nodeRegen; broadcast({ type: 'node', id: n.id, amount: n.amount }); }
  }
  // фермы
  for (const b of builtOf('farm')) {
    b.farmT += dt;
    if (b.farmT > CFG.farmTick) { b.farmT = 0; if (b.stock < CFG.farmMax) { b.stock++; b.nextCrop = b.nextCrop === 'lemon' ? 'silk' : 'lemon'; } }
  }
  // корабль
  if (G.ship.state === 'sailing' && t > G.ship.returnAt) {
    G.ship.state = 'docked';
    G.store.denarii += G.ship.cargo; G.voyages++;
    log(`Корабль вернулся из Рима! Выручка: ${G.ship.cargo} денариев. Рейсов: ${G.voyages}.`, 'good');
    G.ship.cargo = 0;
  }
  // набеги
  if (gt > G.nextRaid) {
    G.nextRaid = gt + CFG.raidInterval;
    if (G.buildings.length) {
      const dens = G.world.dens.map((d) => ({ d, list: G.animals.filter((a) => a.den === d && a.mode !== 'raid') })).filter((x) => x.list.length);
      shuffle(dens);
      const groups = dens.slice(0, gt > 1800 ? 2 : 1);
      for (const g of groups) {
        for (const a of g.list) { a.mode = 'raid'; a.raidUntil = t + CFG.raidDuration; a.target = null; }
        log(`Звери идут на поселение: ${ANIMALS[g.d.type].name} × ${g.list.length}!`, 'warn');
      }
    }
  }
  // размножение — только в логовах, где остались звери
  if (gt > G.nextBreed) {
    G.nextBreed = gt + CFG.breedInterval;
    for (const d of G.world.dens) {
      const n = G.animals.filter((a) => a.den === d).length;
      if (n >= 2 && n < d.count) spawnAnimal(d.type, d, 2);
    }
  }
  updateAnimals(dt);
  updateProjectiles(dt);
  updateGulls(dt);
  if (gt > G.nextGull) { G.nextGull = gt + CFG.gullRespawn; if (G.gulls.length < CFG.gullMax) spawnGull(true); }
  updateMonster(dt);
  G.animals = G.animals.filter((a) => a.hp > 0);
  if (G.vote && (t > G.vote.endsAt || living().every((p) => G.vote.votes[p.id] !== undefined))) finishVote();
  if (gt > CFG.gameLength) endGame({ side: 'bad', text: 'Время вышло: поселение так и не было основано. Тёмная сторона побеждает.' });

  if (tickN % 2 === 0) sendState();
}
function sendState() {
  const common = {
    type: 'state', t: gtime(), night: isNight(),
    players: [...G.players.values()].map((p) => ({ id: p.id, x: p.x, z: p.z, ry: p.ry, anim: p.anim, hp: Math.round(p.hp), maxHp: p.maxHp,
      alive: p.alive, ghost: p.ghost, eq: p.eq >= 0 && p.items[p.eq] ? p.items[p.eq].type : null, atk: p.atk || 0, carry: hasItem(p, 'treasure') >= 0,
      lvl: p.level, on: !!p.ws, mask: p.masked, atkType: p.atkType || 'melee' })),
    proj: G.projectiles.map((r) => ({ id: r.id, type: r.type, sx: r.sx, sz: r.sz, dx: r.dx, dz: r.dz, speed: r.speed, max: r.max, born: r.born, x: r.x, z: r.z })),
    gulls: G.gulls.map((g) => ({ id: g.id, x: g.x, z: g.z, ry: g.ry, fly: g.state === 'fly' })),
    animals: G.animals.map((a) => ({ id: a.id, type: a.type, x: a.x, z: a.z, ry: a.ry, hp: a.hp, maxHp: a.maxHp, atk: a.atk })),
    monster: G.monster ? { id: G.monster.id, x: G.monster.x, z: G.monster.z, ry: G.monster.ry, hp: G.monster.hp, maxHp: G.monster.maxHp, atk: G.monster.atk,
      left: Math.max(0, CFG.monsterWinTime - (now() - G.monster.born)), destroyed: G.monster.destroyed } : null,
    buildings: G.buildings.map((b) => ({ id: b.id, type: b.type, x: b.x, z: b.z, ry: b.ry, built: b.built, ruined: b.ruined, hp: Math.round(b.hp), maxHp: b.maxHp, del: b.del, stock: b.stock })),
    store: G.store, ship: { state: G.ship.state, del: G.ship.del, left: G.ship.state === 'sailing' ? Math.round(G.ship.returnAt - now()) : 0 },
    voyages: G.voyages, vote: G.vote ? { left: Math.round(G.vote.endsAt - now()), n: Object.keys(G.vote.votes).length } : null,
  };
  for (const p of G.players.values()) {
    if (!p.ws) continue;
    const me = {
      role: p.role, revealed: p.revealed, hp: p.hp, inv: p.inv, items: p.items, eq: p.eq, xp: p.xp, level: p.level, cap: capOf(p),
      done: p.done, secret: secretOptions(p).map((o) => o.action), secretCd: Math.max(0, Math.round(CFG.secretCd - (now() - p.lastSecret))),
      clues: p.role === 'detective' ? p.clues : undefined, treasure: p.role === 'smuggler' ? p.treasure : null, voted: p.vote, plotFailed: !!p.plotFailed,
    };
    const msg = { ...common, me };
    if (p.role === 'detective' && p.alive) msg.clues = G.clues.map((c) => ({ id: c.id, x: c.x, z: c.z, label: c.label }));
    p.ws.send(JSON.stringify(msg));
  }
}
setInterval(tick, 50);

// ---------- Тестовые команды (только DEV) ----------
function devCommand(p, text) {
  const cmd = text.split(' ')[0];
  if (cmd === '/give') {
    for (const k of Object.keys(G.store)) G.store[k] += k === 'denarii' ? 500 : 100;
    for (const k of S.CARRY_RES) p.inv[k] = 0;
    Object.assign(p.inv, { log: 8, sand: 6, plank: 3, brick: 3 }); // хватит на Склад
    log('[DEV] На склад добавлено по 100 ресурсов и 500 денариев', 'warn');
  } else if (cmd === '/raid') { G.nextRaid = 0; }
  else if (cmd === '/summon') {
    G.monster = { id: nid(), type: 'monster', x: p.x, z: p.z - 30, ry: 0, hp: ANIMALS.monster.hp, maxHp: ANIMALS.monster.hp,
      owner: p.id, born: now(), destroyed: 0, cd: 0, target: null, atk: 0 };
    log('[DEV] Чудовище призвано', 'warn');
  } else if (cmd === '/voyage') { G.voyages++; log('[DEV] +1 рейс', 'warn'); }
  else if (cmd === '/items') { for (const t of ['gladius', 'spear', 'salve', 'tools', 'map', 'mandrake', 'venom', 'gull']) addItem(p, t); }
  else if (cmd === '/tp') {
    const where = text.split(' ')[1] || 'oasis';
    const t = where === 'oasis' ? S.OASES[0] : G.world.pois.find((q) => q.type === where) || G.world.camp;
    p.x = t.x + 6; p.z = t.z + 6;
    send(p, { type: 'respawn', x: p.x, z: p.z });
  }
  else log('[DEV] Команды: /give /raid /summon /voyage /items /tp [oasis|ruins|village|shrine|altar|cove]', 'info', p);
}

// ---------- Сообщения ----------
function handle(p, m) {
  if (m.type === 'chat') {
    const text = String(m.text || '').slice(0, 200);
    if (!text) return;
    if (DEV && G.phase === 'playing' && text.startsWith('/')) return devCommand(p, text);
    const msg = p.masked ? { type: 'chat', name: 'Незнакомец в маске', color: 0x777777, text, ghost: p.ghost } : { type: 'chat', name: p.name, color: p.color, text, ghost: p.ghost };
    for (const q of G.players.values()) if (!p.ghost || q.ghost) send(q, msg);
    return;
  }
  if (G.phase === 'lobby') {
    if (m.type === 'lobby') {
      if (SPECS[m.spec]) p.spec = m.spec;
      if (DEV) p.devRole = ROLES[m.devRole] ? m.devRole : '';
      lobbyState();
    } else if (m.type === 'start') {
      if ([...G.players.values()][0] !== p) return;
      if (G.players.size < MIN_PLAYERS) return log(`Нужно минимум ${MIN_PLAYERS} игрока`, 'bad', p);
      startGame();
    }
    return;
  }
  if (G.phase === 'ended') {
    if (m.type === 'restart' && [...G.players.values()].find((q) => q.ws) === p) { newGame(); broadcast({ type: 'toLobby' }); lobbyState(); }
    return;
  }
  // ---- игра идёт ----
  if (m.type === 'move') {
    if (typeof m.x !== 'number' || typeof m.z !== 'number') return;
    if (!p.alive && !p.ghost) return;
    if (S.islandT(m.x, m.z) > 1.15) return;
    p.x = m.x; p.z = m.z; p.ry = +m.ry || 0; p.anim = m.anim | 0;
    return;
  }
  if (m.type === 'vote') {
    if (!G.vote || !p.alive || p.ghost) return;
    p.vote = m.target; G.vote.votes[p.id] = m.target === 'skip' ? 'skip' : Number(m.target);
    return;
  }
  if (!p.alive || p.ghost) return;
  switch (m.type) {
    case 'attack': playerAttack(p, +m.ry || 0); break;
    case 'gather': {
      const n = G.nodes.get(m.id);
      const cd = p.spec === 'gatherer' ? CFG.gathererGatherCd : CFG.gatherCd;
      if (!n || n.amount <= 0 || dist(p, n) > 4 || now() - p.gatherAt < cd * 0.9) return;
      if (freeCap(p) <= 0) return log('Инвентарь полон — отнесите ресурсы на Склад', 'bad', p);
      p.gatherAt = now();
      const k = Math.min(n.amount, p.role === 'heir' ? 2 : 1, freeCap(p));
      n.amount -= k; p.inv[n.res] += k; n.regenAt = now() + CFG.nodeRegen;
      addXp(p, 2);
      broadcast({ type: 'node', id: n.id, amount: n.amount });
      break;
    }
    case 'pickup': {
      const l = G.loot.get(m.id);
      if (!l || dist(p, l) > 3) return;
      const def = ITEMS[l.item];
      if (def.kind === 'coins') {
        G.store.denarii += def.value;
        log(`${p.name} нашёл(ла) мешочек: +${def.value} денариев в казну поселения`, 'good');
      } else if (def.kind === 'res') {
        const n = l.n || 1;
        if (freeCap(p) < n) return log('Не хватает места для ресурсов — отнесите их на Склад', 'bad', p);
        p.inv[def.res] += n;
        log(`Подобрано: ${def.name} × ${n}`, 'info', p);
      } else {
        if (!addItem(p, l.item)) return log('Нет свободных слотов (выбросьте предмет в инвентаре — I)', 'bad', p);
        log(`Найдено: ${def.name}`, 'info', p);
        if (def.kind === 'token' && p.role === 'detective' && l.from) {
          p.clues.push({ label: def.name, hint: `Выпал(а) из игрока ${l.from} после удара чайкой.`, t: gtime() });
          log(`Новая улика: ${def.name} — выпала из ${l.from}!`, 'warn', p);
        }
      }
      G.loot.delete(l.id);
      broadcast({ type: 'lootGone', id: l.id });
      break;
    }
    case 'clue': {
      if (p.role !== 'detective') return;
      const i = G.clues.findIndex((c) => c.id === m.id);
      if (i < 0 || dist(p, G.clues[i]) > 3) return;
      const c = G.clues.splice(i, 1)[0];
      p.clues.push({ label: c.label, hint: c.hint, t: c.t });
      log(`Улика: «${c.label}». ${c.hint}`, 'warn', p);
      addXp(p, 25);
      break;
    }
    case 'drop': {
      const it = p.items[m.slot];
      if (!it) return;
      removeItemAt(p, m.slot);
      dropLoot(it.type, p.x, p.z);
      break;
    }
    case 'use': {
      const it = p.items[m.slot];
      if (!it) return;
      const def = ITEMS[it.type];
      if (def.kind === 'heal') { p.hp = Math.min(p.maxHp, p.hp + def.heal); removeItemAt(p, m.slot); log(`Использовано: ${def.name}`, 'info', p); }
      else if (def.kind === 'weapon') p.eq = p.eq === m.slot ? -1 : m.slot;
      else if (def.kind === 'gull') {
        if (p.role === 'detective') {
          const ry = typeof m.ry === 'number' ? m.ry : p.ry;
          removeItemAt(p, m.slot); p.ry = ry; p.atk = now(); p.atkType = 'throw';
          spawnProjectile(p, 'gull', ry, 18, 22, 0);
        } else { p.hp = Math.min(p.maxHp, p.hp + def.heal); removeItemAt(p, m.slot); log('Вы съели чайку. +15 здоровья', 'info', p); }
      }
      break;
    }
    case 'swap': {
      const a = m.a | 0, b = m.b | 0;
      if (a < 0 || b < 0 || a >= CFG.slots || b >= CFG.slots || !p.items[a]) return;
      if (b >= p.items.length) { const [it] = p.items.splice(a, 1); p.items.push(it); }
      else [p.items[a], p.items[b]] = [p.items[b], p.items[a]];
      p.eq = -1;
      break;
    }
    case 'mask': {
      if (ROLES[p.role].side !== 'bad' || p.revealed) return;
      p.masked = !p.masked;
      log(p.masked ? 'Вы надели маску: ваше имя скрыто.' : 'Вы сняли маску.', 'info', p);
      break;
    }
    case 'place': placeBuilding(p, m.btype, +m.x, +m.z, +m.ry || 0); break;
    case 'bld': {
      const b = G.buildings.find((x) => x.id === m.id);
      if (!b || !nearBuilding(p, b, 6)) return;
      const from = m.from === 'store' ? 'store' : 'inv';
      if (m.op === 'deliver') deliver(p, b, from);
      else if (m.op === 'repair') repairBuilding(p, b, from);
      else if (!b.built || b.ruined) return log('Постройка не работает', 'bad', p);
      else if (m.op === 'deposit' && b.type === 'warehouse') {
        let n = 0;
        for (const k of S.CARRY_RES) { G.store[k] += p.inv[k]; n += p.inv[k]; p.inv[k] = 0; }
        for (let i = p.items.length - 1; i >= 0; i--) if (p.items[i].type === 'coins') { G.store.denarii += ITEMS.coins.value; removeItemAt(p, i); n++; }
        if (n) { addXp(p, Math.ceil(n / 3)); log(`Сдано на склад: ${n}`, 'info', p); }
      } else if (m.op === 'withdraw' && b.type === 'warehouse') {
        const k = m.res; if (!S.CARRY_RES.includes(k)) return;
        const n = Math.min(5, G.store[k], freeCap(p));
        G.store[k] -= n; p.inv[k] += n;
      } else if (m.op === 'craft' && b.type === 'workshop') {
        const src = m.recipe === 'plank' ? 'log' : 'sand', dst = m.recipe === 'plank' ? 'plank' : 'brick';
        const ratio = p.spec === 'craftsman' ? 1 : 2;
        const pool = from === 'store' ? G.store : p.inv;
        if (from === 'store' && !warehouse()) return;
        const out = Math.min(from === 'store' ? 20 : 10, Math.floor(pool[src] / ratio));
        if (!out) return log(`Не хватает: ${S.RES[src]}`, 'bad', p);
        pool[src] -= out * ratio; pool[dst] += out;
        addXp(p, out);
        log(`Изготовлено: ${S.RES[dst]} × ${out}${from === 'store' ? ' (на складе)' : ''}`, 'info', p);
      } else if (m.op === 'harvest' && b.type === 'farm') {
        const mult = p.spec === 'farmer' ? 1.5 : 1;
        let n = Math.min(b.stock, Math.floor(freeCap(p) / mult));
        if (!n) return log(b.stock ? 'Нет места в инвентаре' : 'Урожай ещё не созрел', 'bad', p);
        b.stock -= n;
        const total = Math.floor(n * mult);
        const lem = Math.ceil(total / 2);
        p.inv.lemon += lem; p.inv.silk += total - lem;
        addXp(p, total);
        log(`Собран урожай: лимоны ${lem}, шёлк ${total - lem}`, 'info', p);
      } else if (b.type === 'shipyard') {
        if (m.op === 'shipBuild' && (G.ship.state === 'none')) {
          if (!Object.keys(G.ship.del).length) for (const k in CFG.shipCost) G.ship.del[k] = 0;
          let tot = 0;
          for (const k in CFG.shipCost) { const n = takeFrom(p, from, k, CFG.shipCost[k] - G.ship.del[k]); G.ship.del[k] += n; tot += n; }
          if (!tot) return log('Нет нужных ресурсов', 'bad', p);
          if (Object.keys(CFG.shipCost).every((k) => G.ship.del[k] >= CFG.shipCost[k])) { G.ship.state = 'docked'; log('Корабль спущен на воду!', 'good'); addXp(p, 30); }
        } else if (m.op === 'shipRepair' && G.ship.state === 'damaged') {
          const n = takeFrom(p, from, 'plank', CFG.shipRepair.plank);
          if (n < CFG.shipRepair.plank) { if (from === 'store') G.store.plank += n; else p.inv.plank += n; return log(`Нужно ${CFG.shipRepair.plank} досок`, 'bad', p); }
          G.ship.state = 'docked'; log('Корабль отремонтирован', 'good');
        } else if (m.op === 'sail' && G.ship.state === 'docked') {
          const goods = G.store.lemon + G.store.silk + G.store.hide;
          if (goods < CFG.minCargo) return log(`Нужно хотя бы ${CFG.minCargo} товаров (лимоны/шёлк/шкуры) на Складе`, 'bad', p);
          G.ship.cargo = G.store.lemon * CFG.prices.lemon + G.store.silk * CFG.prices.silk + G.store.hide * CFG.prices.hide;
          log(`Корабль отплыл в Рим: лимоны ${G.store.lemon}, шёлк ${G.store.silk}, шкуры ${G.store.hide}.`, 'good');
          G.store.lemon = 0; G.store.silk = 0; G.store.hide = 0;
          G.ship.state = 'sailing'; G.ship.returnAt = now() + CFG.voyageTime;
          addXp(p, 20);
        }
      }
      break;
    }
    case 'secret': doSecret(p, m.action); break;
    case 'callVote': callVote(p); break;
  }
}

wss.on('connection', (ws) => {
  let p = null;
  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (!p) {
      if (m.type !== 'join') return;
      const name = String(m.name || 'Гость').trim().slice(0, 16) || 'Гость';
      // переподключение в идущую игру по имени
      const old = [...G.players.values()].find((q) => q.name === name && !q.ws);
      if (old && G.phase !== 'lobby') {
        p = old; p.ws = ws; conns.set(ws, p);
        send(p, { type: 'welcome', id: p.id });
        send(p, { type: 'init', id: p.id, world: G.world, fast: FAST, dev: DEV, role: p.role,
          roster: [...G.players.values()].map((q) => ({ id: q.id, name: q.name, color: q.color, spec: q.spec })) });
        return;
      }
      if (G.phase !== 'lobby') { ws.send(JSON.stringify({ type: 'error', text: 'Игра уже идёт. Подождите следующую сессию.' })); return; }
      if (G.players.size >= MAX_PLAYERS) { ws.send(JSON.stringify({ type: 'error', text: 'Лобби заполнено (8 игроков).' })); return; }
      const used = new Set([...G.players.values()].map((q) => q.color));
      p = { id: pidSeq++, name, ws, spec: 'gatherer', color: COLORS.find((c) => !used.has(c.hex)).hex };
      resetPlayer(p);
      G.players.set(p.id, p); conns.set(ws, p);
      send(p, { type: 'welcome', id: p.id });
      lobbyState();
      return;
    }
    try { handle(p, m); } catch (e) { console.error(e); }
  });
  ws.on('close', () => {
    if (!p) return;
    conns.delete(ws);
    p.ws = null;
    if (G.phase === 'lobby') { G.players.delete(p.id); lobbyState(); }
    else log(`${p.name} отключился(лась)`, 'info');
    if (G.phase !== 'lobby' && ![...G.players.values()].some((q) => q.ws)) { newGame(); }
  });
});

server.listen(PORT, () => console.log(`Insula Deserta: http://localhost:${PORT}  ${DEV ? '[DEV: от 1 игрока, выбор роли]' : ''} ${FAST ? '[FAST: дешёвые постройки]' : ''}`));
