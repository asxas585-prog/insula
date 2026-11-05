// Общие данные и функции для сервера и клиента.
// Все числа баланса собраны здесь, чтобы их было удобно крутить.

export const CFG = {
  gameLength: 120 * 60,      // сек. Если Ратуша не построена — побеждает тёмная сторона
  dayLength: 8 * 60,         // полный цикл день/ночь
  nightFrac: 0.28,
  invCap: 20,                // вместимость для ресурсов
  heirCapBonus: 10,
  gathererCapBonus: 10,
  slots: 10,                 // слоты для предметов (первые 6 — на панели)
  hotbar: 6,
  gatherCd: 1.2,
  gathererGatherCd: 0.75,
  secretCd: 60,              // пауза между тайными действиями
  secretHold: 3,             // сколько держать F
  voteTime: 40,
  voteCd: 120,
  cluesForVote: 2,
  raidFirst: 300,
  raidInterval: 200,
  raidDuration: 110,
  breedInterval: 150,
  farmTick: 20,
  farmMax: 20,
  voyageTime: 90,
  minCargo: 5,
  prices: { lemon: 6, silk: 12, hide: 9 },
  shipCost: { plank: 20, log: 10 },
  shipRepair: { plank: 10 },
  respawnTime: 15,
  monsterWinTime: 300,
  monsterWinDestroy: 3,
  hpPerPlank: 25,
  nodeRegen: 30,
  mountainH: 9,              // выше этой высоты не забраться
  oasisHeal: 3,              // лечение в воде оазиса, ед/с
  gullMax: 14,
  gullRespawn: 35,
};

export const RES = {
  log: 'Брёвна', sand: 'Песок', plank: 'Доски', brick: 'Кирпичи',
  lemon: 'Лимоны', silk: 'Шёлк', hide: 'Шкуры', denarii: 'Денарии',
};
export const CARRY_RES = ['log', 'sand', 'plank', 'brick', 'lemon', 'silk', 'hide'];

export const ITEMS = {
  gladius:    { name: 'Гладиус', kind: 'weapon', dmg: 22, range: 2.9, cd: 0.55, color: 0xc9d0d6, desc: 'Короткий римский меч. Быстрые удары.' },
  spear:      { name: 'Копьё', kind: 'weapon', thrown: true, dmg: 28, range: 26, speed: 30, cd: 0.9, color: 0x9a7a4a, desc: 'Бросается (ЛКМ). Летит далеко, потом его нужно подобрать. Им ловят чаек.' },
  axe:        { name: 'Топор', kind: 'weapon', dmg: 30, range: 2.6, cd: 0.85, color: 0x777777, desc: 'Тяжёлый, медленный, сильный удар.' },
  bandage:    { name: 'Повязка', kind: 'heal', heal: 30, color: 0xf2efe6, desc: 'Лечит 30 здоровья.' },
  salve:      { name: 'Целебная мазь', kind: 'heal', heal: 70, color: 0x5fc46a, desc: 'Лечит 70 здоровья.' },
  coins:      { name: 'Мешочек денариев', kind: 'coins', value: 40, color: 0xf2c84b, desc: 'Сразу уходит в казну поселения.' },
  hide:       { name: 'Шкура', kind: 'res', res: 'hide', color: 0x9b6b3d, desc: 'Товар на продажу в Рим.' },
  gull:       { name: 'Чайка', kind: 'gull', heal: 15, color: 0xf4f4f4, desc: 'Сыщик может бросить её в игрока: из тёмной роли выпадет её предмет. Остальные могут её съесть (+15).' },
  map:        { name: 'Карта сокровищ', kind: 'quest', color: 0xd9c08f, desc: 'Старая карта с непонятными знаками.' },
  tools:      { name: 'Инструменты диверсанта', kind: 'quest', color: 0x4a4a52, desc: 'Ломик, фитиль и отмычки.' },
  mandrake:   { name: 'Корень мандрагоры', kind: 'ingredient', color: 0x8b5a2b, desc: 'Колдовской ингредиент.' },
  venom:      { name: 'Змеиный яд', kind: 'ingredient', color: 0x7cff4a, desc: 'Колдовской ингредиент.' },
  bones:      { name: 'Древние кости', kind: 'ingredient', color: 0xe8e2cc, desc: 'Колдовской ингредиент.' },
  darkpotion: { name: 'Тёмное зелье', kind: 'quest', color: 0x7a2bd1, desc: 'Нужно для тёмного ритуала.' },
  treasure:   { name: 'Сокровище', kind: 'treasure', color: 0xffd34d, desc: 'Тяжёлый сундук. Замедляет.' },
  lockpick:   { name: 'Отмычка импостера', kind: 'token', color: 0x333344, desc: 'Улика: выпала из импостера.' },
  amulet:     { name: 'Колдовской амулет', kind: 'token', color: 0x9b30ff, desc: 'Улика: выпал из колдуна.' },
  compass:    { name: 'Компас контрабандиста', kind: 'token', color: 0xc08a2a, desc: 'Улика: выпал из контрабандиста.' },
};
export const ROLE_TOKEN = { impostor: 'lockpick', warlock: 'amulet', smuggler: 'compass' };
export const FIST = { dmg: 8, range: 2.2, cd: 0.45 };

export const SPECS = {
  farmer:    { name: 'Фермер', desc: 'Собирает на фермах в 1.5 раза больше урожая.' },
  craftsman: { name: 'Ремесленник', desc: 'В мастерской делает 1 доску/кирпич из 1 единицы сырья (а не из 2).' },
  warrior:   { name: 'Воин', desc: '+40% урона, +30 здоровья.' },
  gatherer:  { name: 'Собиратель', desc: 'Быстрее добывает брёвна и песок, +10 к вместимости.' },
};

export const ROLES = {
  explorer:  { name: 'Исследователь', side: 'good', desc: 'Стройте поселение, торгуйте с Римом, ищите предателей и голосуйте.' },
  detective: { name: 'Сыщик', side: 'good', desc: 'Только вы видите улики. Соберите 2+ улики и созовите голосование у Склада.' },
  heir:      { name: 'Сын императора', side: 'good', desc: 'Двойной опыт и добыча. Если вас убьёт другой игрок — победит тёмная сторона. Не выдавайте себя!' },
  impostor:  { name: 'Импостер', side: 'bad', desc: 'Найдите Инструменты диверсанта и совершите 3 диверсии: сломать постройку, украсть припасы со склада, сорвать торговлю на верфи.' },
  warlock:   { name: 'Колдун', side: 'bad', desc: 'Соберите 2 ингредиента, сварите зелье в Святилище, проведите ритуал в Развалинах храма и призовите чудовище у Древнего алтаря.' },
  smuggler:  { name: 'Контрабандист', side: 'bad', desc: 'Найдите Карту сокровищ, расшифруйте её, выкопайте клад и тайно вывезите его из Скрытой бухты.' },
};

export const SECRET = {
  sabotage: { role: 'impostor', name: 'Диверсия', clue: 'Следы диверсии', hint: 'Подойдите к любой постройке с Инструментами диверсанта.' },
  steal:    { role: 'impostor', name: 'Кража припасов', clue: 'Взломанный ящик', hint: 'Склад, на котором лежит 5+ товаров (доски, кирпичи, лимоны, шёлк).' },
  wreck:    { role: 'impostor', name: 'Срыв торговли', clue: 'Перерезанный канат', hint: 'Верфь с кораблём у причала.' },
  brew:     { role: 'warlock', name: 'Варка зелья', clue: 'Осадок тёмного зелья', hint: '2 ингредиента + Старое святилище.' },
  ritual:   { role: 'warlock', name: 'Тёмный ритуал', clue: 'Ритуальный круг', hint: 'Тёмное зелье + Развалины храма.' },
  summon:   { role: 'warlock', name: 'Призыв чудовища', clue: 'Кровавая печать', hint: 'После ритуала — Древний алтарь. Чудовище должно разрушить 3 постройки или продержаться 5 минут.' },
  decipher: { role: 'smuggler', name: 'Расшифровка карты', clue: 'Обрывок карты', hint: 'Нужна Карта сокровищ (в любом месте).' },
  dig:      { role: 'smuggler', name: 'Раскопки клада', clue: 'Свежая яма', hint: 'Место клада отмечено на вашей карте (M).' },
  smuggle:  { role: 'smuggler', name: 'Вывоз сокровища', clue: 'Следы лодки', hint: 'Сокровище + Скрытая бухта.' },
};
export const ROLE_TASKS = {
  impostor: ['sabotage', 'steal', 'wreck'],
  warlock: ['brew', 'ritual', 'summon'],
  smuggler: ['decipher', 'dig', 'smuggle'],
};

export const BUILDINGS = {
  warehouse: { name: 'Склад', cost: { log: 15, sand: 10 }, hp: 500, r: 5.5, shore: true, max: 1, req: [],
    desc: 'Хранилище ресурсов, место голосований. Только на берегу.' },
  workshop:  { name: 'Мастерская', cost: { log: 20, sand: 10 }, hp: 350, r: 4.5, max: 2, req: ['warehouse'],
    desc: 'Брёвна → доски, песок → кирпичи.' },
  farm:      { name: 'Ферма', cost: { log: 10, plank: 10, brick: 5 }, hp: 250, r: 6, max: 3, req: ['workshop'],
    desc: 'Выращивает лимоны и шёлк на продажу.' },
  shipyard:  { name: 'Верфь', cost: { plank: 25, brick: 10 }, hp: 400, r: 6.5, shore: true, max: 1, req: ['workshop'],
    desc: 'Строит корабль для торговли с Римом. Только на берегу.' },
  townhall:  { name: 'Ратуша', cost: { plank: 80, brick: 80, denarii: 500 }, hp: 1200, r: 8, max: 1,
    req: ['warehouse', 'workshop', 'farm', 'shipyard'], voyages: 2,
    desc: 'Главное здание. Её завершение — победа поселенцев. Нужно 2+ торговых рейса.' },
};

export const ANIMALS = {
  jackal: { name: 'Шакал', hp: 28, dmg: 4, speed: 5.2, aggro: 10, reach: 1.6, atkCd: 1.2, bldg: 4, xp: 15, leash: 35, hides: 1 },
  boar:   { name: 'Кабан', hp: 55, dmg: 8, speed: 4.3, aggro: 7, reach: 1.9, atkCd: 1.5, bldg: 8, xp: 25, leash: 30, hides: 2 },
  lion:   { name: 'Лев', hp: 110, dmg: 14, speed: 4.9, aggro: 13, reach: 2.3, atkCd: 1.7, bldg: 12, xp: 55, leash: 45, hides: 3 },
  monster:{ name: 'Чудовище из песков', hp: 1400, dmg: 28, speed: 3.3, aggro: 14, reach: 4.2, atkCd: 1.7, bldg: 45, xp: 400, leash: 999, hides: 0 },
};

export const POI_TYPES = {
  ruins:   { name: 'Развалины храма' },
  village: { name: 'Брошенная деревня' },
  shrine:  { name: 'Старое святилище' },
  altar:   { name: 'Древний алтарь' },
  cove:    { name: 'Скрытая бухта' },
  oasis:   { name: 'Оазис' },
};

export const COLORS = [
  { hex: 0xc0392b, name: 'красного' }, { hex: 0x2e5fb8, name: 'синего' },
  { hex: 0x2f8f4e, name: 'зелёного' }, { hex: 0xe0b52a, name: 'жёлтого' },
  { hex: 0x7d3c98, name: 'фиолетового' }, { hex: 0xe67e22, name: 'оранжевого' },
  { hex: 0xeeeeee, name: 'белого' }, { hex: 0x2b2b2b, name: 'чёрного' },
];

// Быстрый режим для тестирования: всё дешевле и быстрее
export function applyFast() {
  for (const b of Object.values(BUILDINGS)) {
    for (const k in b.cost) b.cost[k] = Math.max(1, Math.ceil(b.cost[k] / 4));
    if (b.voyages) b.voyages = 1;
  }
  for (const k in CFG.shipCost) CFG.shipCost[k] = Math.ceil(CFG.shipCost[k] / 4);
  CFG.secretCd = 10; CFG.raidFirst = 90; CFG.raidInterval = 120; CFG.voyageTime = 20;
  CFG.farmTick = 6; CFG.voteCd = 30; CFG.monsterWinTime = 180; CFG.minCargo = 2;
}

// Доля суток 0..1; игра стартует утром
export function dayFrac(t) { return ((t + CFG.dayLength * 0.12) % CFG.dayLength) / CFG.dayLength; }

// ---------- Случайность и шум ----------
export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash2(i, j) {
  let h = Math.imul(i, 374761393) + Math.imul(j, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const sstep = (t) => t * t * (3 - 2 * t);
export function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = sstep(x - xi), zf = sstep(z - zi);
  const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
  return a + (b - a) * xf + (c - a) * zf + (a - b - c + d) * xf * zf;
}
export function fbm(x, z) {
  let s = 0, amp = 0.5, f = 1;
  for (let i = 0; i < 4; i++) { s += vnoise(x * f, z * f) * amp; amp *= 0.5; f *= 2.03; }
  return s / 0.9375;
}
export function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// ---------- Рельеф острова ----------
// Неровный остров с природной гаванью в центре (пролив на юг), горами и оазисами.
export const ISLAND_R = 200;
export const HARBOR = { x: 0, z: 45, r: 40, end: { x: 14, z: 330 }, w: 16 };
export const CAMP = { x: 0, z: HARBOR.z - HARBOR.r - 11 };
export const MOUNTAINS = [
  { x: -105, z: -55, r: 50, h: 32 },
  { x: -55, z: -118, r: 30, h: 22 },
  { x: 92, z: -82, r: 42, h: 30 },
  { x: 128, z: 18, r: 28, h: 20 },
  { x: -128, z: 62, r: 26, h: 18 },
];
export const OASES = [
  { x: -68, z: 100, r: 16 },
  { x: 78, z: 95, r: 15 },
  { x: 8, z: -112, r: 16 },
];

export function edgeRadius(a) {
  return ISLAND_R * (0.86 + 0.09 * Math.sin(2 * a + 0.7) + 0.07 * Math.sin(3 * a + 1.3) + 0.04 * Math.sin(5 * a + 0.4) + 0.025 * Math.sin(9 * a + 2.1) + 0.015 * Math.sin(14 * a));
}
export function islandT(x, z) {
  return Math.hypot(x, z) / edgeRadius(Math.atan2(z, x));
}
function segDist(px, pz, a, b) {
  const vx = b.x - a.x, vz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((px - a.x) * vx + (pz - a.z) * vz) / (vx * vx + vz * vz)));
  return Math.hypot(px - a.x - vx * t, pz - a.z - vz * t);
}
// расстояние до кромки гавани (отрицательное — внутри воды)
export function harborSD(x, z) {
  const c = Math.hypot(x - HARBOR.x, z - HARBOR.z) - HARBOR.r;
  const ch = segDist(x, z, HARBOR, HARBOR.end) - HARBOR.w;
  return Math.min(c, ch) + (vnoise(x * 0.07 + 3, z * 0.07) - 0.5) * 7;
}
export function terrainHeight(x, z) {
  const t = islandT(x, z);
  let h;
  if (t > 1) h = -1.2 - Math.min(14, (t - 1) * 30);
  else {
    const land = 1 - smoothstep(0.5, 1.0, t);
    const dunes = fbm(x * 0.017 + 10, z * 0.017 - 4);
    const ridges = Math.pow(Math.abs(Math.sin(x * 0.04 + z * 0.012 + fbm(x * 0.01, z * 0.01) * 6)), 2);
    h = land * (2.5 + dunes * 8 + ridges * 2.0 * land) + (1 - t) * 2.0 - 1.2;
  }
  // горы
  for (const m of MOUNTAINS) {
    const d = Math.hypot(x - m.x, z - m.z);
    if (d < m.r) {
      const k = 1 - d / m.r;
      const n = fbm(x * 0.06 + m.x, z * 0.06 + m.z);
      h += m.h * (k * k * (3 - 2 * k)) * (0.6 + 0.8 * n);
    }
  }
  // оазисы: ровная низина с прудом
  for (const o of OASES) {
    const d = Math.hypot(x - o.x, z - o.z);
    if (d < o.r * 1.7) {
      const w = 1 - smoothstep(o.r * 0.8, o.r * 1.7, d);
      h = h * (1 - w) + 0.7 * w;
      const pw = 1 - smoothstep(o.r * 0.25, o.r * 0.45, d);
      h = h * (1 - pw) - 0.5 * pw;
    }
  }
  // площадка лагеря
  const dc = Math.hypot(x - CAMP.x, z - CAMP.z);
  if (dc < 40) { const w = 1 - smoothstep(18, 40, dc); h = h * (1 - w) + 1.0 * w; }
  // гавань
  h = Math.min(h, Math.max(-9, -1.2 + 0.45 * harborSD(x, z)));
  return h;
}
export const isBlocked = (x, z) => terrainHeight(x, z) > CFG.mountainH;
export const inOasisWater = (x, z) => OASES.some((o) => Math.hypot(x - o.x, z - o.z) < o.r * 0.5);

export function isShore(x, z) {
  const h = terrainHeight(x, z);
  if (h < -0.4 || h > 2.2) return false;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    if (terrainHeight(x + Math.cos(a) * 13, z + Math.sin(a) * 13) < -0.6) return true;
  }
  return false;
}

// Точка на внешнем берегу по углу
function shorePoint(a, targetH = 0.5) {
  const er = edgeRadius(a);
  for (let r = er; r > er * 0.4; r -= 0.5) {
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (terrainHeight(x, z) >= targetH) return { x, z };
  }
  return { x: Math.cos(a) * er * 0.8, z: Math.sin(a) * er * 0.8 };
}
const nearMountain = (x, z, pad = 8) => MOUNTAINS.some((m) => Math.hypot(x - m.x, z - m.z) < m.r + pad);

// ---------- Генерация мира ----------
export function generateWorld(seed) {
  const rnd = makeRng(seed);
  const R = (a, b) => a + rnd() * (b - a);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  let nextId = 1;
  const id = () => nextId++;
  const W = { seed, nodes: [], pois: [], loot: [], dens: [], decor: [], camp: null, treasureSpots: [], gullSpots: [], oases: OASES };

  // Лагерь — на северном берегу гавани, лодка в воде
  W.camp = { x: CAMP.x, z: CAMP.z, boat: { x: HARBOR.x - 3, z: HARBOR.z - HARBOR.r + 7 } };

  const occupied = [{ x: W.camp.x, z: W.camp.z, r: 30 }];
  for (const o of OASES) occupied.push({ x: o.x, z: o.z, r: o.r * 1.3 });
  const free = (x, z, r) => occupied.every((o) => Math.hypot(o.x - x, o.z - z) > o.r + r);
  function randLand(tMin, tMax, r, tries = 400, check) {
    for (let i = 0; i < tries; i++) {
      const a = R(0, Math.PI * 2), t = Math.sqrt(R(tMin * tMin, tMax * tMax));
      const er = edgeRadius(a);
      const x = Math.cos(a) * er * t, z = Math.sin(a) * er * t;
      const h = terrainHeight(x, z);
      if (h < 0.4 || h > 6) continue;
      if (!free(x, z, r)) continue;
      if (check && !check(x, z)) continue;
      return { x, z };
    }
    return null;
  }

  // Точки интереса
  const poiList = ['ruins', 'ruins', 'village', 'village', 'shrine', 'shrine', 'altar'];
  for (const type of poiList) {
    const p = randLand(0.15, 0.82, 22, 800, (x, z) => Math.hypot(x - W.camp.x, z - W.camp.z) > 70 && !nearMountain(x, z, 12));
    if (!p) continue;
    W.pois.push({ id: id(), type, x: p.x, z: p.z, ry: R(0, 6.28) });
    occupied.push({ x: p.x, z: p.z, r: 22 });
  }
  // Скрытая бухта — на внешнем северном берегу, подальше от гор
  {
    let best = null;
    for (let i = 0; i < 60; i++) {
      const a = -Math.PI / 2 + R(-1.3, 1.3);
      const sp = shorePoint(a, 0.6);
      if (nearMountain(sp.x, sp.z, 6)) continue;
      best = { ...sp, a }; break;
    }
    if (!best) { const a = -Math.PI / 2; best = { ...shorePoint(a, 0.6), a }; }
    W.pois.push({ id: id(), type: 'cove', x: best.x, z: best.z, ry: best.a + Math.PI / 2 });
    occupied.push({ x: best.x, z: best.z, r: 14 });
  }

  // Добыча в точках интереса
  const guaranteed = ['tools', 'tools', 'tools', 'map', 'map', 'map', 'mandrake', 'mandrake', 'venom', 'venom', 'bones', 'bones',
    'gladius', 'gladius', 'spear', 'spear', 'spear', 'axe', 'salve', 'salve', 'salve', 'bandage', 'bandage', 'bandage', 'bandage',
    'coins', 'coins', 'coins', 'coins', 'coins', 'coins'];
  const pref = {
    ruins: ['gladius', 'coins', 'map', 'tools', 'bones', 'spear'],
    village: ['bandage', 'salve', 'coins', 'tools', 'axe', 'spear'],
    shrine: ['mandrake', 'venom', 'salve', 'map', 'bones', 'bandage'],
    altar: ['bones', 'venom', 'mandrake', 'coins'],
    cove: ['coins', 'spear', 'map', 'bandage'],
  };
  const slots = [];
  for (const p of W.pois) {
    const n = p.type === 'cove' ? 3 : p.type === 'altar' ? 3 : 5;
    for (let i = 0; i < n; i++) {
      const a = R(0, 6.28), d = R(3, p.type === 'village' ? 13 : 9);
      slots.push({ poi: p, x: p.x + Math.cos(a) * d, z: p.z + Math.sin(a) * d });
    }
  }
  for (let i = slots.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [slots[i], slots[j]] = [slots[j], slots[i]]; }
  let gi = 0;
  for (const s of slots) {
    const type = gi < guaranteed.length ? guaranteed[gi++] : pick(pref[s.poi.type]);
    W.loot.push({ id: id(), item: type, x: s.x, z: s.z });
  }
  // копьё у лагеря — чтобы было чем ловить чаек
  W.loot.push({ id: id(), item: 'spear', x: W.camp.x + 4, z: W.camp.z - 3 });
  // в оазисах — немного лечения
  for (const o of OASES) W.loot.push({ id: id(), item: pick(['bandage', 'salve']), x: o.x + o.r * 0.7, z: o.z + R(-3, 3) });

  // Логова зверей
  const denTypes = ['jackal', 'jackal', 'jackal', 'boar', 'boar', 'lion', 'jackal'];
  for (const type of denTypes) {
    const p = randLand(0.3, 0.88, 15, 800, (x, z) => Math.hypot(x - W.camp.x, z - W.camp.z) > 85);
    if (!p) continue;
    const count = type === 'lion' ? 2 : type === 'boar' ? 3 : 4;
    W.dens.push({ id: id(), type, x: p.x, z: p.z, count });
    occupied.push({ x: p.x, z: p.z, r: 12 });
  }

  // Ресурсы
  for (let i = 0; i < 70; i++) {
    const p = randLand(0.05, 0.9, 3, 200);
    if (!p) continue;
    const kind = islandT(p.x, p.z) > 0.65 && rnd() < 0.7 ? 'palm' : 'deadtree';
    W.nodes.push({ id: id(), res: 'log', kind, x: p.x, z: p.z, amount: 8, max: 8, ry: R(0, 6.28), s: R(0.85, 1.25) });
    occupied.push({ x: p.x, z: p.z, r: 2 });
  }
  // пальмы в оазисах
  for (const o of OASES) {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + R(-0.2, 0.2), d = o.r * R(0.6, 1.1);
      W.nodes.push({ id: id(), res: 'log', kind: 'palm', x: o.x + Math.cos(a) * d, z: o.z + Math.sin(a) * d, amount: 8, max: 8, ry: R(0, 6.28), s: R(1.0, 1.4) });
    }
    for (let i = 0; i < 45; i++) {
      const a = R(0, 6.28), d = o.r * Math.sqrt(R(0.2, 1.6));
      W.decor.push({ kind: 'grass', x: o.x + Math.cos(a) * d, z: o.z + Math.sin(a) * d, ry: R(0, 6.28), s: R(0.7, 1.4) });
    }
  }
  for (let i = 0; i < 60; i++) {
    const p = randLand(0.45, 0.95, 3, 200);
    if (!p) continue;
    W.nodes.push({ id: id(), res: 'sand', kind: 'sandpile', x: p.x, z: p.z, amount: 10, max: 10, ry: R(0, 6.28), s: R(0.9, 1.3) });
    occupied.push({ x: p.x, z: p.z, r: 2 });
  }
  // Ресурсы у лагеря
  for (let i = 0; i < 8; i++) {
    const a = R(Math.PI, Math.PI * 2), d = R(14, 28);
    const x = W.camp.x + Math.cos(a) * d, z = W.camp.z + Math.sin(a) * d;
    if (terrainHeight(x, z) < 0.3) continue;
    const isLog = i % 2 === 0;
    W.nodes.push({ id: id(), res: isLog ? 'log' : 'sand', kind: isLog ? 'palm' : 'sandpile', x, z, amount: isLog ? 8 : 10, max: isLog ? 8 : 10, ry: R(0, 6.28), s: 1 });
  }

  // Места клада
  for (let i = 0; i < 8; i++) {
    const p = randLand(0.3, 0.85, 6, 300, (x, z) => Math.hypot(x - W.camp.x, z - W.camp.z) > 60);
    if (p) W.treasureSpots.push(p);
  }

  // Места для чаек: внешний берег и берег гавани
  for (let i = 0; i < 40 && W.gullSpots.length < 18; i++) {
    const sp = shorePoint(R(0, Math.PI * 2), 0.15);
    if (!nearMountain(sp.x, sp.z, 0)) W.gullSpots.push(sp);
  }
  for (let i = 0; i < 60 && W.gullSpots.length < 28; i++) {
    const a = R(0, Math.PI * 2);
    for (let r = HARBOR.r - 5; r < HARBOR.r + 20; r += 0.5) {
      const x = HARBOR.x + Math.cos(a) * r, z = HARBOR.z + Math.sin(a) * r;
      const h = terrainHeight(x, z);
      if (h > 0.15 && h < 1.5) { if (Math.hypot(x - W.camp.x, z - W.camp.z) > 12) W.gullSpots.push({ x, z }); break; }
    }
  }

  // Декор
  for (let i = 0; i < 180; i++) {
    const p = randLand(0.0, 0.97, 1, 50);
    if (!p) continue;
    W.decor.push({ kind: rnd() < 0.45 ? 'rock' : 'shrub', x: p.x, z: p.z, ry: R(0, 6.28), s: R(0.5, 1.6) });
  }
  // валуны у подножия гор
  for (const m of MOUNTAINS) for (let i = 0; i < 10; i++) {
    const a = R(0, 6.28), d = m.r * R(0.85, 1.15);
    const x = m.x + Math.cos(a) * d, z = m.z + Math.sin(a) * d;
    if (terrainHeight(x, z) > 0.3) W.decor.push({ kind: 'rock', x, z, ry: R(0, 6.28), s: R(1.4, 2.6) });
  }
  return W;
}
