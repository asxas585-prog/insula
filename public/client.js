// Insula Deserta — клиент
import * as THREE from 'three';
import * as S from './shared.js';
import * as MD from './models.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const { CFG, BUILDINGS, ITEMS, ROLES, SECRET, ROLE_TASKS, ANIMALS, SPECS, RES, POI_TYPES } = S;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const setHTML = (el, h) => { if (el._h !== h) { el._h = h; el.innerHTML = h; } };
const hexCss = (h) => '#' + h.toString(16).padStart(6, '0');

// ---------- Сеть ----------
const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
const net = (m) => ws.readyState === 1 && ws.send(JSON.stringify(m));
let myId = null, myName = '', world = null, roster = new Map(), ST = null, myRole = 'explorer', lobbyInfo = null;
let started = false;

ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  switch (m.type) {
    case 'welcome': myId = m.id; $('joinBox').classList.add('hidden'); $('lobbyBox').classList.remove('hidden'); break;
    case 'lobby': renderLobby(m); break;
    case 'error': $('lobbyErr').textContent = m.text; break;
    case 'init': onInit(m); break;
    case 'state': onState(m); break;
    case 'log': addLog(m.text, m.kind); break;
    case 'chat': addLog(`<b style="color:${hexCss(m.color)}">${esc(m.name)}:</b> ${esc(m.text)}`, m.ghost ? 'ghostchat' : 'chat', true); break;
    case 'node': { const n = nodes.get(m.id); if (n) { n.amount = m.amount; n.mesh.visible = m.amount > 0; n.mesh.scale.setScalar(n.s * (0.6 + 0.4 * m.amount / n.max)); } break; }
    case 'lootAdd': addLoot(m.loot); break;
    case 'lootGone': { const l = loot.get(m.id); if (l) { scene.remove(l.mesh); loot.delete(m.id); } break; }
    case 'fx': spawnFx(m); break;
    case 'dead': onDead(m); break;
    case 'respawn': me.x = m.x; me.z = m.z; $('deadOverlay').classList.add('hidden'); break;
    case 'role': myRole = m.role; addLog('Вас разоблачили. Теперь вы — Исследователь и помогаете поселению.', 'bad'); break;
    case 'voteOpen': openVote(m); break;
    case 'voteClose': closeVote(m); break;
    case 'end': onEnd(m); break;
    case 'toLobby': location.reload(); break;
  }
};
ws.onclose = () => addLog('Соединение с сервером потеряно. Обновите страницу.', 'bad');

// ---------- Лобби ----------
const specSel = $('specSel');
for (const [k, v] of Object.entries(SPECS)) specSel.add(new Option(v.name, k));
specSel.value = 'gatherer';
const devRoleSel = $('devRoleSel');
for (const [k, v] of Object.entries(ROLES)) devRoleSel.add(new Option(v.name, k));
const sendLobby = () => net({ type: 'lobby', spec: specSel.value, devRole: devRoleSel.value });
specSel.onchange = () => { $('specDesc').textContent = SPECS[specSel.value].desc; sendLobby(); };
devRoleSel.onchange = sendLobby;
$('specDesc').textContent = SPECS.gatherer.desc;
$('nameInput').value = localStorage.getItem('insulaName') || '';
$('joinBtn').onclick = () => {
  myName = $('nameInput').value.trim() || 'Гость';
  try { localStorage.setItem('insulaName', myName); } catch {}
  net({ type: 'join', name: myName });
};
$('nameInput').onkeydown = (e) => { if (e.key === 'Enter') $('joinBtn').click(); };
$('startBtn').onclick = () => net({ type: 'start' });
function renderLobby(m) {
  lobbyInfo = m;
  $('lobbyCount').textContent = `(${m.players.length}/${m.maxPlayers}, минимум ${m.minPlayers})`;
  $('lobbyList').innerHTML = m.players.map((p) => `<li><span class="swatch" style="background:${hexCss(p.color)}"></span>${esc(p.name)} — ${SPECS[p.spec].name}${p.host ? ' 👑' : ''}${p.id === myId ? ' (вы)' : ''}</li>`).join('');
  const host = m.players[0] && m.players[0].id === myId;
  const need = m.minPlayers - m.players.length;
  $('startBtn').classList.toggle('hidden', !host);
  $('startBtn').disabled = need > 0;
  $('startBtn').textContent = need > 0 ? `Начать экспедицию (ждём ещё ${need} ${need === 1 ? 'игрока' : 'игроков'})` : 'Начать экспедицию';
  $('lobbyWait').classList.remove('hidden');
  $('lobbyWait').innerHTML = host
    ? (need > 0 ? `Для игры нужно минимум ${m.minPlayers} игрока. Отправьте друзьям ссылку на эту страницу: <b>${esc(location.href)}</b>` : 'Все готовы? Нажмите «Начать экспедицию».')
    : `Ожидаем, пока хозяин лобби (${esc(m.players[0].name)} 👑) начнёт игру…` + (need > 0 ? ` Нужно ещё игроков: ${need}.` : '');
  $('devRoleWrap').classList.toggle('hidden', !m.dev);
}

// ---------- Three.js ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.88;
let gfxLow = false;
try { gfxLow = localStorage.getItem('insulaGfx') === 'low'; } catch {}
if (gfxLow) renderer.setPixelRatio(1);
$('game').appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 1400);

// постобработка: мягкое свечение огня, глаз чудовища, бликов
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.28, 0.5, 0.92);
composer.addPass(bloom);
composer.addPass(new OutputPass());
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
});

const hemi = new THREE.HemisphereLight(0xfff1d6, 0xc99a5c, 0.45);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d0, 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -55, right: 55, top: 55, bottom: -55, near: 1, far: 320 });
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);
scene.fog = new THREE.Fog(0xf0d9ae, 110, 520);

// небо с солнечным диском и дымкой у горизонта
const skyUni = {
  top: { value: new THREE.Color(0x4f9fd8) }, bottom: { value: new THREE.Color(0xf6e2b8) },
  sunDir: { value: new THREE.Vector3(0.3, 0.8, 0.4) }, sunCol: { value: new THREE.Color(0xfff2c8) },
};
const skyMat = new THREE.ShaderMaterial({
  uniforms: skyUni, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: 'varying vec3 vp; void main(){ vp = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `uniform vec3 top; uniform vec3 bottom; uniform vec3 sunDir; uniform vec3 sunCol; varying vec3 vp;
    void main(){
      float h = clamp(vp.y*1.5+0.06,0.0,1.0);
      vec3 col = mix(bottom, top, pow(h, 0.8));
      float s = max(dot(normalize(vp), normalize(sunDir)), 0.0);
      col += sunCol * (pow(s, 900.0) * 3.0 + pow(s, 12.0) * 0.25);
      gl_FragColor = vec4(col, 1.0);
    }`,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 16), skyMat);
scene.add(sky);
// отражения окружения: снимаем небо в карту окружения
const pmrem = new THREE.PMREMGenerator(renderer);
const envScene = new THREE.Scene();
envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), skyMat));
let envRT = null;
function updateEnv() {
  if (envRT) envRT.dispose();
  envRT = pmrem.fromScene(envScene, 0.02);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.35;
}
updateEnv();

// процедурные карты нормалей: рябь песка и волны
function makeNormalTex(size, heightFn, strength) {
  const data = new Uint8Array(size * size * 4);
  const hgt = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) hgt[y * size + x] = heightFn(x / size, y / size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const hl = hgt[y * size + ((x - 1 + size) % size)], hr = hgt[y * size + ((x + 1) % size)];
    const hd = hgt[((y - 1 + size) % size) * size + x], hu = hgt[((y + 1) % size) * size + x];
    const v = new THREE.Vector3((hl - hr) * strength, (hd - hu) * strength, 1).normalize();
    const o = (y * size + x) * 4;
    data[o] = (v.x * 0.5 + 0.5) * 255; data[o + 1] = (v.y * 0.5 + 0.5) * 255; data[o + 2] = (v.z * 0.5 + 0.5) * 255; data[o + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, size, size);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}
const TAU = Math.PI * 2;
const tileNoise = (u, v, f) => { // бесшовный шум
  const x = u * f, y = v * f;
  return (S.vnoise(x, y) * (1 - u) * (1 - v) + S.vnoise(x - f, y) * u * (1 - v) + S.vnoise(x, y - f) * (1 - u) * v + S.vnoise(x - f, y - f) * u * v);
};
const sandNormal = makeNormalTex(256, (u, v) => Math.sin((u * 6 + Math.sin(v * TAU * 2) * 0.35 + tileNoise(u, v, 8) * 0.6) * TAU) * 0.6 + tileNoise(u, v, 32) * 0.5, 2.2);
const waterNormal = makeNormalTex(256, (u, v) => Math.sin((u + v) * TAU * 3) * 0.3 + Math.sin((u * 2 - v) * TAU * 2) * 0.3 + tileNoise(u, v, 8) + tileNoise(u, v, 16) * 0.5, 2.5);

// ---------- Мир ----------
const nodes = new Map(), loot = new Map(), players = new Map(), animals = new Map(), buildings = new Map(), clues = new Map();
const gulls = new Map(), projs = new Map();
let water, monsterObj = null, shipObj = null, minimapBase = null, dust = null;
const staticColliders = [];

function buildTerrain() {
  const size = 560, seg = 300;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const wet = new THREE.Color(0xc29a62), beach = new THREE.Color(0xf2dcaa), dune = new THREE.Color(0xe6bf80), deep = new THREE.Color(0xcf9a58),
    sea = new THREE.Color(0xb59563), rock = new THREE.Color(0x9c7d62), rockHi = new THREE.Color(0xc2ab92), grass = new THREE.Color(0x7d9c45);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = S.terrainHeight(x, z);
    pos.setY(i, h);
    const n = S.vnoise(x * 0.15, z * 0.15) * 0.08;
    if (h < -0.5) c.copy(sea);
    else if (h < 0.35) c.copy(wet);
    else if (h < 1.6) c.copy(beach).lerp(dune, (h - 0.35) / 1.25 * 0.5);
    else c.copy(dune).lerp(deep, Math.min(1, (h - 1.6) / 8));
    // скалы гор
    if (h > 6) c.lerp(rock, Math.min(1, (h - 6) / 4));
    if (h > 18) c.lerp(rockHi, Math.min(1, (h - 18) / 10));
    // трава оазисов
    for (const o of S.OASES) {
      const d = Math.hypot(x - o.x, z - o.z);
      if (d < o.r * 1.5 && h > -0.2) c.lerp(grass, (1 - S.smoothstep(o.r * 0.6, o.r * 1.5, d)) * 0.85);
    }
    c.offsetHSL(0, 0, n - 0.04);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  sandNormal.repeat.set(140, 140);
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, normalMap: sandNormal, normalScale: new THREE.Vector2(0.45, 0.45), envMapIntensity: 0.4 }));
  ground.receiveShadow = true;
  scene.add(ground);
  waterNormal.repeat.set(220, 220);
  water = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), new THREE.MeshStandardMaterial({
    color: 0x1aa0bd, transparent: true, opacity: 0.82, roughness: 0.12, metalness: 0.05,
    normalMap: waterNormal, normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 1.1,
  }));
  water.rotation.x = -Math.PI / 2;
  water.receiveShadow = true;
  scene.add(water);
  // пыль в воздухе
  const N = 500, dp = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { dp[i * 3] = (Math.random() - 0.5) * 80; dp[i * 3 + 1] = Math.random() * 14; dp[i * 3 + 2] = (Math.random() - 0.5) * 80; }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xf3dcae, size: 0.05, transparent: true, opacity: 0.35, depthWrite: false }));
  scene.add(dust);
}
const groundY = (x, z) => Math.max(-0.65, S.terrainHeight(x, z));
function place(obj, x, z, ry = 0) { obj.position.set(x, S.terrainHeight(x, z), z); obj.rotation.y = ry; scene.add(obj); return obj; }

function buildWorld(W) {
  buildTerrain();
  for (const p of W.pois) {
    const o = MD.makePOI(p.type);
    place(o, p.x, p.z, p.ry);
    if (p.type === 'cove') o.position.y = Math.max(0, o.position.y);
    if (p.type !== 'cove' || myRole === 'smuggler') { const lbl = MD.makeLabel(POI_TYPES[p.type].name, '#ffe9a8'); lbl.position.set(0, p.type === 'ruins' ? 10 : 7, 0); o.add(lbl); }
    p.obj = o;
  }
  for (const d of W.dens) place(MD.makeDen(), d.x, d.z, 0);
  for (const o of W.oases || []) { const lbl = MD.makeLabel('Оазис', '#c8f0a0'); lbl.position.set(o.x, 6, o.z); scene.add(lbl); }
  for (const n of W.nodes) {
    const m = n.kind === 'palm' ? MD.makePalm(n.s) : n.kind === 'deadtree' ? MD.makeDeadTree(n.s) : MD.makeSandPile(n.s);
    place(m, n.x, n.z, n.ry);
    nodes.set(n.id, { ...n, mesh: m });
    if (n.res === 'log') staticColliders.push({ x: n.x, z: n.z, r: 0.5 });
  }
  for (const l of W.loot) addLoot(l);
  for (const d of W.decor) {
    const m = d.kind === 'rock' ? MD.makeRock(d.s) : d.kind === 'grass' ? MD.makeGrass(d.s) : MD.makeShrub(d.s);
    place(m, d.x, d.z, d.ry);
    if (d.kind === 'rock' && d.s > 1) staticColliders.push({ x: d.x, z: d.z, r: 0.8 * d.s });
  }
  // лагерь высадки
  const boat = MD.makeBoat(); place(boat, W.camp.boat.x, W.camp.boat.z, Math.PI / 2 + 0.3); boat.position.y = Math.max(-0.2, boat.position.y);
  const fire = new THREE.Group();
  for (let i = 0; i < 6; i++) MD.mesh(new THREE.BoxGeometry(0.15, 0.15, 1), MD.M(0x5e3b1f), 0, 0.1, 0, fire).rotation.y = i;
  const flame = MD.mesh(new THREE.ConeGeometry(0.35, 0.9, 6), MD.M(0xff9a2a, { emissive: 0xff6a00, emissiveIntensity: 2 }), 0, 0.5, 0, fire);
  const fl = new THREE.PointLight(0xff8a3a, 3, 18); fl.position.y = 1.5; fire.add(fl);
  place(fire, W.camp.x, W.camp.z - 2);
  campFlame = flame;
  for (let i = 0; i < 3; i++) {
    const tent = new THREE.Group();
    MD.mesh(new THREE.ConeGeometry(1.6, 2.2, 4), MD.M(0xe8dcc0), 0, 1.1, 0, tent).rotation.y = Math.PI / 4;
    place(tent, W.camp.x + (i - 1) * 7, W.camp.z - 9 + Math.abs(i - 1) * 2, 0);
  }
  makeMinimapBase(W);
}
let campFlame = null;

function addLoot(l) {
  if (loot.has(l.id)) return;
  const m = MD.makeLootMesh(l.item);
  place(m, l.x, l.z);
  loot.set(l.id, { ...l, mesh: m });
}

// ---------- Динамические объекты ----------
function getPlayerObj(id) {
  let o = players.get(id);
  if (!o) {
    const r = roster.get(id) || { name: '?', color: 0x999999 };
    const mesh = MD.makePlayer(r.color, r.spec);
    scene.add(mesh);
    const label = MD.makeLabel(r.name); label.position.y = 3.0; mesh.add(label);
    const maskLabel = MD.makeLabel('???', '#bbbbbb'); maskLabel.position.y = 3.0; maskLabel.visible = false; mesh.add(maskLabel);
    o = { mesh, label, maskLabel, x: 0, z: 0, ry: 0, tx: 0, tz: 0, try: 0, anim: 0, atkT: 0, lastAtk: 0, atkType: 'melee', mask: false };
    players.set(id, o);
  }
  return o;
}
function hpBar() {
  const g = new THREE.Group();
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.18), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55, depthTest: false }));
  const fg = new THREE.Mesh(new THREE.PlaneGeometry(1.56, 0.13), new THREE.MeshBasicMaterial({ color: 0xdd3333, depthTest: false }));
  fg.position.z = 0.001; bg.renderOrder = 9; fg.renderOrder = 10;
  g.add(bg, fg); g.userData.fg = fg;
  return g;
}
function setHp(bar, frac) { const fg = bar.userData.fg; fg.scale.x = Math.max(0.001, frac); fg.position.x = -(1 - frac) * 0.78; bar.visible = frac < 0.999; }

function syncAnimals(list) {
  const seen = new Set();
  for (const a of list) {
    seen.add(a.id);
    let o = animals.get(a.id);
    if (!o) {
      const mesh = MD.makeAnimal(a.type); scene.add(mesh);
      const bar = hpBar(); bar.position.y = a.type === 'lion' ? 2.6 : 1.8; mesh.add(bar);
      o = { mesh, bar, x: a.x, z: a.z, ry: a.ry, lastAtk: 0, atkT: 0, type: a.type };
      animals.set(a.id, o);
    }
    o.tx = a.x; o.tz = a.z; o.try = a.ry;
    if (a.atk !== o.lastAtk) { o.lastAtk = a.atk; o.atkT = 1; }
    setHp(o.bar, a.hp / a.maxHp);
  }
  for (const [id, o] of animals) if (!seen.has(id)) { spawnPuff(o.mesh.position, 0x8a6a3a); scene.remove(o.mesh); animals.delete(id); }
}
function syncMonster(m) {
  if (!m) { if (monsterObj) { spawnPuff(monsterObj.mesh.position, 0x3b2a1c, 40); scene.remove(monsterObj.mesh); monsterObj = null; } $('monsterBar').classList.add('hidden'); return; }
  if (!monsterObj) { const mesh = MD.makeMonster(); scene.add(mesh); monsterObj = { mesh, x: m.x, z: m.z, ry: m.ry, lastAtk: 0, atkT: 0 }; }
  monsterObj.tx = m.x; monsterObj.tz = m.z; monsterObj.try = m.ry;
  if (m.atk !== monsterObj.lastAtk) { monsterObj.lastAtk = m.atk; monsterObj.atkT = 1; }
  $('monsterBar').classList.remove('hidden');
  $('monsterFill').style.width = (100 * m.hp / m.maxHp) + '%';
  $('monsterInfo').textContent = `Разрушено построек: ${m.destroyed}/${CFG.monsterWinDestroy} · до опустошения острова: ${fmtTime(m.left)}`;
}
function syncBuildings(list) {
  const seen = new Set();
  for (const b of list) {
    seen.add(b.id);
    const key = `${b.built}|${b.ruined}`;
    let o = buildings.get(b.id);
    if (!o || o.key !== key) {
      if (o) scene.remove(o.group);
      const group = new THREE.Group();
      const def = BUILDINGS[b.type];
      if (b.built) group.add(MD.makeBuilding(b.type));
      else group.add(MD.makeScaffold(b.type, def.r));
      if (b.ruined) { group.children[0].scale.y = 0.45; group.add(MD.makeRuinedOverlay(def.r)); }
      const bar = hpBar(); bar.position.y = b.type === 'townhall' ? 11 : 7; bar.scale.setScalar(2); group.add(bar);
      const lbl = MD.makeLabel(def.name + (b.built ? '' : ' (стройка)')); lbl.position.y = b.type === 'townhall' ? 12 : 8; group.add(lbl);
      place(group, b.x, b.z, b.ry);
      group.position.y = S.terrainHeight(b.x, b.z) - 0.1;
      if (o && b.built && !o.data.built) spawnPuff(group.position, 0xf0e0c0, 30);
      o = { group, bar, key, data: b };
      buildings.set(b.id, o);
    }
    o.data = b;
    setHp(o.bar, b.hp / b.maxHp);
  }
  for (const [id, o] of buildings) if (!seen.has(id)) { scene.remove(o.group); buildings.delete(id); }
}
function syncShip(ship) {
  const sy = [...buildings.values()].find((o) => o.data.type === 'shipyard' && o.data.built);
  const visible = sy && ['docked', 'damaged'].includes(ship.state);
  if (!visible) { if (shipObj) shipObj.visible = false; return; }
  if (!shipObj) { shipObj = MD.makeShip(); scene.add(shipObj); }
  shipObj.visible = true;
  const b = sy.data;
  const ox = Math.sin(b.ry) * 13, oz = Math.cos(b.ry) * 13;
  shipObj.position.set(b.x + ox, 0, b.z + oz);
  shipObj.rotation.y = b.ry;
  shipObj.rotation.z = ship.state === 'damaged' ? 0.25 : 0;
}
function syncClues(list) {
  const seen = new Set();
  for (const c of list || []) {
    seen.add(c.id);
    if (!clues.has(c.id)) { const m = MD.makeClueMesh(); place(m, c.x, c.z); clues.set(c.id, { ...c, mesh: m }); }
  }
  for (const [id, c] of clues) if (!seen.has(id)) { scene.remove(c.mesh); clues.delete(id); }
}

function syncGulls(list) {
  const seen = new Set();
  for (const g of list || []) {
    seen.add(g.id);
    let o = gulls.get(g.id);
    if (!o) { const mesh = MD.makeGull(1.3); scene.add(mesh); o = { mesh, x: g.x, z: g.z, ry: g.ry, h: g.fly ? 8 : 0 }; gulls.set(g.id, o); }
    o.tx = g.x; o.tz = g.z; o.try = g.ry; o.fly = g.fly;
  }
  for (const [id, o] of gulls) if (!seen.has(id)) { spawnPuff(o.mesh.position, 0xffffff, 8); scene.remove(o.mesh); gulls.delete(id); }
}
// снаряды летят быстро, поэтому клиент сам считает их полёт по стартовым данным
function syncProjs(list, serverT) {
  const seen = new Set();
  for (const r of list || []) {
    seen.add(r.id);
    if (!projs.has(r.id)) {
      const mesh = r.type === 'spear' ? MD.makeSpearProjectile() : MD.makeGull(1.4);
      mesh.rotation.order = 'YXZ';
      scene.add(mesh);
      projs.set(r.id, { ...r, mesh, t0: performance.now() / 1000 - Math.max(0, serverT - r.born) });
    }
  }
  for (const [id, o] of projs) if (!seen.has(id)) { scene.remove(o.mesh); projs.delete(id); }
}
function updateProjs(t) {
  for (const o of projs.values()) {
    const d = Math.min(o.max, (performance.now() / 1000 - o.t0) * o.speed);
    const x = o.sx + o.dx * d, z = o.sz + o.dz * d;
    const f = d / o.max;
    const y = Math.max(groundY(x, z) + 0.3, groundY(o.sx, o.sz) + 1.8 + Math.sin(f * Math.PI) * (o.type === 'spear' ? 3 : 2) - f * 1.2);
    o.mesh.position.set(x, y, z);
    o.mesh.rotation.set(0, Math.atan2(o.dx, o.dz), 0);
    if (o.type === 'spear') o.mesh.rotation.x = -Math.cos(f * Math.PI) * 0.35;
    else MD.animateGull(o.mesh, t * 1.5, true);
  }
}

// ---------- Эффекты ----------
const fxList = [];
function spawnPuff(pos, color, n = 12) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.25), new THREE.MeshBasicMaterial({ color, transparent: true }));
    m.position.copy(pos); m.position.y += 1;
    scene.add(m);
    fxList.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 6, Math.random() * 5 + 1, (Math.random() - 0.5) * 6), life: 0.8 });
  }
}
function spawnFx(m) {
  const p = new THREE.Vector3(m.x, S.terrainHeight(m.x, m.z), m.z);
  if (m.fx === 'hit') spawnPuff(p, 0xcc2222, 6);
  else if (m.fx === 'summon') { spawnPuff(p, 0x5a1a0a, 60); shake = 1.5; }
}
let shake = 0;

// ---------- Инициализация игры ----------
const me = { x: 0, z: 0, ry: 0, alive: true, ghost: false, atkT: 0 };
let camYaw = 0, camPitch = 0.35, camDist = 10;
let journalIntro = false;
function onInit(m) {
  myId = m.id; world = m.world; myRole = m.role;
  if (m.fast) S.applyFast();
  roster = new Map(m.roster.map((r) => [r.id, r]));
  buildWorld(world);
  const mine = roster.get(myId);
  me.x = world.camp.x; me.z = world.camp.z;
  $('lobby').classList.add('hidden');
  $('hud').classList.remove('hidden');
  $('meName').textContent = mine.name;
  $('meSpec').textContent = SPECS[mine.spec].name;
  started = true;
  showRoleIntro();
}
function showRoleIntro() {
  const r = ROLES[myRole];
  journalIntro = true;
  openModal('journal');
  renderJournal();
}

// ---------- Состояние ----------
function onState(s) {
  ST = s;
  myRole = s.me.role;
  for (const p of s.players) {
    if (p.id === myId) {
      if (!p.alive && me.alive && !p.ghost) {}
      me.alive = p.alive; me.ghost = p.ghost; me.hp = p.hp; me.maxHp = p.maxHp; me.carry = p.carry; me.mask = p.mask;
      const o = getPlayerObj(p.id);
      o.mesh.userData.mask.visible = p.mask;
      MD.setWeapon(o.mesh, p.carry ? 'treasure' : p.eq);
      o.mesh.visible = p.alive || p.ghost;
      setGhostLook(o, p.ghost);
      continue;
    }
    const o = getPlayerObj(p.id);
    o.tx = p.x; o.tz = p.z; o.try = p.ry; o.anim = p.anim;
    if (p.atk !== o.lastAtk) { o.lastAtk = p.atk; if (o.lastAtk) { o.atkT = 1; o.atkType = p.atkType; } }
    o.mask = p.mask;
    o.mesh.userData.mask.visible = p.mask;
    o.label.visible = !p.mask; o.maskLabel.visible = p.mask;
    // призраков видят только призраки
    o.mesh.visible = p.alive ? true : (p.ghost && me.ghost);
    setGhostLook(o, p.ghost);
    MD.setWeapon(o.mesh, p.carry ? 'treasure' : p.eq);
  }
  syncAnimals(s.animals);
  syncMonster(s.monster);
  syncBuildings(s.buildings);
  syncShip(s.ship);
  syncClues(s.clues);
  syncGulls(s.gulls);
  syncProjs(s.proj, s.t);
  updateHUD();
  if (!$('invBox').classList.contains('hidden')) renderInventory();
  if (!$('panel').classList.contains('hidden')) renderPanel();
  if (!$('journal').classList.contains('hidden')) renderJournal();
  if (!$('buildMenu').classList.contains('hidden')) renderBuildMenu();
  if (!$('voteBox').classList.contains('hidden')) renderVote();
}
function setGhostLook(o, ghost) {
  if (o.ghostLook === ghost) return;
  o.ghostLook = ghost;
  o.mesh.traverse((c) => { if (c.isMesh && !c.isSprite) { c.material = c.material.clone(); c.material.transparent = ghost; c.material.opacity = ghost ? 0.35 : 1; } });
}

// ---------- HUD ----------
function fmtTime(sec) { sec = Math.max(0, Math.floor(sec)); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; }
function updateHUD() {
  const s = ST, m = s.me;
  $('hpFill').style.width = (100 * Math.max(0, m.hp) / me.maxHp) + '%';
  $('hpText').textContent = `${Math.max(0, Math.round(m.hp))} / ${me.maxHp}`;
  $('meLvl').textContent = m.level;
  const lo = 60 * (m.level - 1) ** 2, hi = 60 * m.level ** 2;
  $('xpFill').style.width = (100 * (m.xp - lo) / (hi - lo)) + '%';
  const r = ROLES[myRole];
  $('roleLine').innerHTML = `Скрытая роль: <b class="${r.side}">${r.name}</b>${m.revealed ? ' (разоблачён)' : ''} <span class="muted">· J — журнал</span>`;
  // цели
  const st = (type) => {
    const list = s.buildings.filter((b) => b.type === type);
    if (!list.length) return `<span class="obj">○ ${BUILDINGS[type].name}</span>`;
    const b = list.find((x) => x.built && !x.ruined);
    if (b) return `<span class="obj done">✓ ${BUILDINGS[type].name}</span>`;
    if (list.some((x) => x.ruined)) return `<span class="obj ruin">✗ ${BUILDINGS[type].name}</span>`;
    return `<span class="obj site">◐ ${BUILDINGS[type].name}</span>`;
  };
    $('objectives').innerHTML =
    `<div>${s.night ? '🌙 Ночь' : '☀ День'} · ${fmtTime(s.t)} / ${fmtTime(CFG.gameLength)} · Денарии: ${s.store.denarii} · Рейсов: ${s.voyages}/${BUILDINGS.townhall.voyages}` +
    (s.ship.state === 'sailing' ? ` · ⛵ вернётся через ${s.ship.left}с` : '') + (s.vote ? ` · <b style="color:#ffd166">ГОЛОСОВАНИЕ ${s.vote.left}с (V)</b>` : '') + `</div>` +
    `<div>${['warehouse', 'workshop', 'farm', 'shipyard', 'townhall'].map(st).join('')}</div>`;
  // ресурсы
  const tot = S.CARRY_RES.reduce((a, k) => a + m.inv[k], 0);
  $('resBar').innerHTML = S.CARRY_RES.filter((k) => m.inv[k] || ['log', 'sand', 'plank', 'brick'].includes(k)).map((k) => `<span>${RES[k]}: <b>${m.inv[k]}</b></span>`).join('') + `<span class="muted">(${tot}/${m.cap})</span>`;
  // предметы
  let html = '';
  for (let i = 0; i < CFG.hotbar; i++) {
    const it = m.items[i];
    const def = it && ITEMS[it.type];
    html += `<div class="slot ${m.eq === i ? 'eq' : ''} ${selSlot === i ? 'sel' : ''}"><span class="k">${i + 1}</span>${def ? `<span class="ico" style="background:${hexCss(def.color)}"></span>${def.name}` : ''}</div>`;
  }
  setHTML($('hotbar'), html);
  // тайные действия
  if (m.secret && m.secret.length) $('secretPrompt').innerHTML = m.secret.map((a) => `[F] удерживать — ${SECRET[a].name}`).join('<br>');
  else if (ROLE_TASKS[myRole] && m.secretCd > 0 && !m.revealed) $('secretPrompt').innerHTML = `<span class="muted">Тайное действие доступно через ${m.secretCd}с</span>`;
  else $('secretPrompt').innerHTML = '';
  let extra = '';
  if (ROLES[myRole].side === 'bad' && !m.revealed) extra += me.mask ? '<div style="color:#bbb">🎭 Вы в маске (X — снять)</div>' : '<div class="muted">X — надеть маску</div>';
  if (S.inOasisWater(me.x, me.z) && me.alive) extra += '<div style="color:var(--good)">Вода оазиса восстанавливает силы</div>';
  if (myRole === 'detective' && m.items.some((it) => it.type === 'gull')) extra += '<div class="muted">Чайка: нажмите её номер, чтобы бросить вперёд</div>';
  setHTML($('statusExtra'), extra);
  drawMinimap();
}

const logEl = $('log');
function addLog(text, kind = 'info', html = false) {
  const d = document.createElement('div');
  d.className = kind;
  if (html) d.innerHTML = text; else d.textContent = text;
  logEl.prepend(d);
  while (logEl.children.length > 14) logEl.lastChild.remove();
  setTimeout(() => { d.style.transition = 'opacity 1s'; d.style.opacity = '0.35'; }, 15000);
}

// ---------- Миникарта ----------
function makeMinimapBase(W) {
  const N = 256;
  const c = document.createElement('canvas'); c.width = N; c.height = N;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(N, N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = (i / N - 0.5) * 480, z = (j / N - 0.5) * 480;
    const h = S.terrainHeight(x, z);
    let col;
    if (h < -0.4) col = h < -5 ? [22, 84, 128] : [40, 140, 170];
    else if (h > 9) { const k = Math.min(1, (h - 9) / 20); col = [140 + k * 50, 115 + k * 50, 95 + k * 50]; }
    else if (S.OASES.some((o) => Math.hypot(x - o.x, z - o.z) < o.r * 1.2)) col = [120, 160, 70];
    else if (h < 1) col = [236, 214, 160];
    else { const k = Math.min(1, h / 12); col = [228 - k * 30, 190 - k * 40, 125 - k * 40]; }
    const o = (j * N + i) * 4;
    img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  minimapBase = c;
}
function drawMap(canvas, big) {
  if (!minimapBase || !ST) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const span = big ? 480 : 160;
  const cx = big ? 0 : me.x, cz = big ? 0 : me.z;
  const k = W / span;
  const toS = (x, z) => [(x - cx) * k + W / 2, (z - cz) * k + W / 2];
  ctx.save();
  ctx.fillStyle = '#1d5f8a'; ctx.fillRect(0, 0, W, W);
  if (!big) { ctx.beginPath(); ctx.arc(W / 2, W / 2, W / 2, 0, 7); ctx.clip(); }
  const s0 = toS(-240, -240);
  ctx.drawImage(minimapBase, s0[0], s0[1], 480 * k, 480 * k);
  ctx.font = big ? '13px Georgia' : '10px Georgia';
  ctx.textAlign = 'center';
  for (const p of world.pois) {
    if (p.type === 'cove' && myRole !== 'smuggler') continue;
    const [x, y] = toS(p.x, p.z);
    ctx.fillStyle = p.type === 'altar' ? '#5a1010' : p.type === 'shrine' ? '#2e7d4a' : '#6b5536';
    ctx.beginPath(); ctx.arc(x, y, big ? 7 : 4, 0, 7); ctx.fill();
    if (big) { ctx.fillStyle = '#fff'; ctx.fillText(POI_TYPES[p.type].name, x, y - 10); }
  }
  for (const b of ST.buildings) {
    const [x, y] = toS(b.x, b.z);
    ctx.fillStyle = b.ruined ? '#555' : b.built ? '#f3efe4' : '#e8a33a';
    const r = BUILDINGS[b.type].r * k * (big ? 1.6 : 1.3) + 2;
    ctx.fillRect(x - r / 2, y - r / 2, r, r);
    ctx.strokeStyle = '#8f3b2a'; ctx.strokeRect(x - r / 2, y - r / 2, r, r);
  }
  const [cpx, cpy] = toS(world.camp.x, world.camp.z);
  ctx.fillStyle = '#ff9a2a'; ctx.beginPath(); ctx.arc(cpx, cpy, 3, 0, 7); ctx.fill();
  if (ST.me.treasure) {
    const [x, y] = toS(ST.me.treasure.x, ST.me.treasure.z);
    ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x - 6, y - 6); ctx.lineTo(x + 6, y + 6); ctx.moveTo(x + 6, y - 6); ctx.lineTo(x - 6, y + 6); ctx.stroke();
  }
  if (big) for (const o of world.oases || []) { const [x, y] = toS(o.x, o.z); ctx.fillStyle = '#d8f5b0'; ctx.fillText('Оазис', x, y - 10); }
  for (const c of clues.values()) { const [x, y] = toS(c.x, c.z); ctx.fillStyle = '#66ccff'; ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill(); }
  for (const a of ST.animals) {
    if (!big && Math.hypot(a.x - me.x, a.z - me.z) > 60) continue;
    if (big && Math.hypot(a.x - me.x, a.z - me.z) > 60) continue;
    const [x, y] = toS(a.x, a.z); ctx.fillStyle = '#c0392b'; ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
  }
  if (ST.monster) { const [x, y] = toS(ST.monster.x, ST.monster.z); ctx.fillStyle = '#ff2200'; ctx.beginPath(); ctx.arc(x, y, 7, 0, 7); ctx.fill(); }
  for (const p of ST.players) {
    if (p.id === myId || !p.alive) continue;
    const r = roster.get(p.id); const [x, y] = toS(p.x, p.z);
    ctx.fillStyle = p.mask ? '#555' : hexCss(r.color); ctx.strokeStyle = '#000';
    ctx.beginPath(); ctx.arc(x, y, big ? 5 : 3.5, 0, 7); ctx.fill(); ctx.stroke();
    if (big) { ctx.fillStyle = '#fff'; ctx.fillText(p.mask ? '???' : r.name, x, y + 16); }
  }
  // я
  const [mx, my] = toS(me.x, me.z);
  ctx.translate(mx, my); ctx.rotate(-me.ry + Math.PI);
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}
function drawMinimap() {
  drawMap($('minimap'), false);
  if (!$('bigmapWrap').classList.contains('hidden')) drawMap($('bigmap'), true);
}

// ---------- Модальные окна ----------
const MODALS = ['panel', 'buildMenu', 'journal', 'help', 'voteBox', 'bigmapWrap', 'invBox'];
function openModal(id) {
  for (const mId of MODALS) if (mId !== id) $(mId).classList.add('hidden');
  $(id).classList.remove('hidden');
  if (document.pointerLockElement) document.exitPointerLock();
}
const closeModals = () => { for (const mId of MODALS) $(mId).classList.add('hidden'); panelBid = null; journalIntro = false; };
const anyModal = () => MODALS.some((m) => !$(m).classList.contains('hidden'));

// --- Панель постройки ---
let panelBid = null;
function openPanel(bid) { panelBid = bid; openModal('panel'); renderPanel(); }
function costList(cost, del) {
  return Object.keys(cost).map((k) => {
    const have = del ? del[k] || 0 : 0;
    return `<div>${RES[k]}: ${have} / ${cost[k]}<div class="progress"><div style="width:${100 * have / cost[k]}%"></div></div></div>`;
  }).join('');
}
const B = (op, label, extra = {}, disabled = false) =>
  `<button class="btn" data-op="${op}" ${Object.entries(extra).map(([k, v]) => `data-${k}="${v}"`).join(' ')} ${disabled ? 'disabled' : ''}>${label}</button>`;
function renderPanel() {
  const o = buildings.get(panelBid);
  if (!o || !ST) return closeModals();
  const b = o.data, def = BUILDINGS[b.type], s = ST, hasWh = s.buildings.some((x) => x.type === 'warehouse' && x.built);
  let h = `<span class="close" data-op="close">×</span><h2>${def.name}</h2><div class="muted">${def.desc}</div>`;
  h += `<div class="muted">Прочность: ${b.hp} / ${b.maxHp}</div>`;
  if (!b.built) {
    h += `<h3>Стройка — нужно внести:</h3>${costList(def.cost, b.del)}`;
    h += B('deliver', 'Внести из инвентаря', { from: 'inv' }) + B('deliver', 'Внести со склада', { from: 'store' }, !hasWh);
  } else {
    if (b.hp < b.maxHp) {
      h += `<h3>${b.ruined ? '⚠ Постройка разрушена и не работает' : 'Повреждения'}</h3><div class="muted">1 доска = ${CFG.hpPerPlank} прочности</div>`;
      h += B('repair', 'Чинить досками из инвентаря', { from: 'inv' }) + B('repair', 'Чинить досками со склада', { from: 'store' }, !hasWh);
    }
    if (!b.ruined) h += panelBody(b, s);
  }
  setHTML($('panel'), h);
}
function panelBody(b, s) {
  let h = '';
  const st = s.store;
  if (b.type === 'warehouse') {
    h += '<h3>Запасы поселения</h3><table>' + Object.keys(RES).map((k) => `<tr><td>${RES[k]}</td><td>${st[k]}</td><td>${k !== 'denarii' ? B('withdraw', 'Взять 5', { res: k }, !st[k]) : ''}</td></tr>`).join('') + '</table>';
    h += B('deposit', 'Сдать всё из инвентаря (и денарии)');
    if (myRole === 'detective') {
      const n = (s.me.clues || []).length;
      h += `<h3>Народное собрание</h3><div class="muted">Собрано улик: ${n} (нужно ${CFG.cluesForVote})</div>` + `<button class="btn" data-op="callVote" ${n < CFG.cluesForVote || s.vote ? 'disabled' : ''}>Созвать голосование</button>`;
    }
  } else if (b.type === 'workshop') {
    const ratio = roster.get(myId).spec === 'craftsman' ? 1 : 2;
    h += `<h3>Производство (${ratio} сырья → 1 изделие)</h3>`;
    h += `<div>Доски: ${B('craft', 'Из брёвен в инвентаре', { recipe: 'plank', from: 'inv' })}${B('craft', 'Из брёвен на складе', { recipe: 'plank', from: 'store' })}</div>`;
    h += `<div>Кирпичи: ${B('craft', 'Из песка в инвентаре', { recipe: 'brick', from: 'inv' })}${B('craft', 'Из песка на складе', { recipe: 'brick', from: 'store' })}</div>`;
    h += `<div class="muted">На складе: брёвна ${st.log}, песок ${st.sand}, доски ${st.plank}, кирпичи ${st.brick}</div>`;
  } else if (b.type === 'farm') {
    h += `<h3>Урожай</h3><div>Созрело: ${b.stock} / ${CFG.farmMax} (лимоны и шёлк)</div>` + B('harvest', 'Собрать урожай', {}, !b.stock);
    h += '<div class="muted">Отнесите урожай на Склад — оттуда его заберёт корабль.</div>';
  } else if (b.type === 'shipyard') {
    const sh = s.ship;
    h += '<h3>Корабль</h3>';
    if (sh.state === 'none') {
      h += costList(CFG.shipCost, sh.del) + B('shipBuild', 'Строить из инвентаря', { from: 'inv' }) + B('shipBuild', 'Строить со склада', { from: 'store' });
    } else if (sh.state === 'docked') {
      const val = st.lemon * CFG.prices.lemon + st.silk * CFG.prices.silk + st.hide * CFG.prices.hide;
      h += `<div>Корабль у причала. На складе: лимоны ${st.lemon} (по ${CFG.prices.lemon}), шёлк ${st.silk} (по ${CFG.prices.silk}), шкуры ${st.hide} (по ${CFG.prices.hide}).</div><div>Ожидаемая выручка: <b>${val}</b> денариев.</div>`;
      h += B('sail', 'Отправить рейс в Рим', {}, st.lemon + st.silk + st.hide < CFG.minCargo);
    } else if (sh.state === 'damaged') {
      h += `<div style="color:var(--bad)">Корабль повреждён! Нужно ${CFG.shipRepair.plank} досок.</div>` + B('shipRepair', 'Чинить из инвентаря', { from: 'inv' }) + B('shipRepair', 'Чинить со склада', { from: 'store' });
    } else if (sh.state === 'sailing') h += `<div>Корабль в пути. Вернётся через ${sh.left} с.</div>`;
  }
  return h;
}
$('panel').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-op]');
  if (!btn) return;
  const op = btn.dataset.op;
  if (op === 'close') return closeModals();
  if (op === 'callVote') return net({ type: 'callVote' });
  net({ type: 'bld', id: panelBid, op, from: btn.dataset.from, res: btn.dataset.res, recipe: btn.dataset.recipe });
});

// --- Меню строительства ---
function buildReason(type) {
  const def = BUILDINGS[type], s = ST;
  if (s.buildings.filter((b) => b.type === type).length >= def.max) return 'Лимит построек';
  for (const r of def.req) if (!s.buildings.some((b) => b.type === r && b.built)) return `Нужно: ${BUILDINGS[r].name}`;
  if (def.voyages && s.voyages < def.voyages) return `Нужно рейсов: ${def.voyages}`;
  return null;
}
function renderBuildMenu() {
  let h = '<span class="close" data-type="close">×</span><h2>Строительство</h2>';
  for (const [k, def] of Object.entries(BUILDINGS)) {
    const why = buildReason(k);
    h += `<div class="bitem ${why ? 'off' : ''}" data-type="${why ? '' : k}"><b>${def.name}</b> — ${Object.entries(def.cost).map(([r, n]) => `${RES[r]} ${n}`).join(', ')}<div class="muted">${def.desc}</div>${why ? `<div class="why">${why}</div>` : ''}</div>`;
  }
  h += '<div class="muted">Стройка закладывается бесплатно, затем в неё вносят ресурсы (E у стройки).</div>';
  setHTML($('buildMenu'), h);
}
$('buildMenu').addEventListener('click', (e) => {
  const it = e.target.closest('[data-type]');
  if (!it || !it.dataset.type) return;
  if (it.dataset.type === 'close') return closeModals();
  startPlacing(it.dataset.type);
});
let placing = null;
function startPlacing(type) {
  closeModals();
  const g = BUILDINGS[type];
  const obj = MD.makeBuilding(type);
  obj.traverse((c) => { if (c.isMesh) { c.material = c.material.clone(); c.material.transparent = true; c.material.opacity = 0.5; c.castShadow = false; } });
  scene.add(obj);
  placing = { type, obj, ry: camYaw + Math.PI, ok: false, err: '' };
  renderer.domElement.requestPointerLock();
  addLog(`Выберите место для «${g.name}»: ЛКМ — заложить, R — повернуть, ПКМ/Esc — отмена`, 'info');
}
function clientPlaceCheck(type, x, z) {
  const def = BUILDINGS[type];
  if (S.terrainHeight(x, z) < 0.2) return 'Слишком близко к воде';
  if (S.terrainHeight(x, z) > 6.5) return 'Слишком высоко — горы';
  if (def.shore && !S.isShore(x, z)) return 'Нужно строить у самого берега';
  for (const b of ST.buildings) if (Math.hypot(b.x - x, b.z - z) < BUILDINGS[b.type].r + def.r + 1) return 'Мешает другая постройка';
  for (const p of world.pois) if (Math.hypot(p.x - x, p.z - z) < 16 + def.r) return 'Слишком близко к руинам';
  const d = def.r * 0.7;
  const hs = [S.terrainHeight(x + d, z), S.terrainHeight(x - d, z), S.terrainHeight(x, z + d), S.terrainHeight(x, z - d)];
  if (Math.max(...hs) - Math.min(...hs) > 3.5) return 'Слишком неровно';
  return null;
}
function updatePlacing() {
  if (!placing) return;
  const def = BUILDINGS[placing.type];
  const d = def.r + 3;
  const x = me.x + Math.sin(camYaw + Math.PI) * d, z = me.z + Math.cos(camYaw + Math.PI) * d;
  placing.x = x; placing.z = z;
  placing.obj.position.set(x, S.terrainHeight(x, z), z);
  placing.obj.rotation.y = placing.ry;
  const err = clientPlaceCheck(placing.type, x, z);
  placing.ok = !err; placing.err = err;
  placing.obj.traverse((c) => { if (c.isMesh) c.material.emissive?.setHex(err ? 0x880000 : 0x006600); });
  $('prompt').innerHTML = err ? `<span style="color:var(--bad)">${err}</span>` : `ЛКМ — заложить «${def.name}» · R — повернуть`;
}
function stopPlacing() { if (placing) { scene.remove(placing.obj); placing = null; } }

// --- Журнал ---
function renderJournal() {
  const intro = journalIntro;
  const r = ROLES[myRole];
  const m = ST ? ST.me : { done: [], clues: [] };
  const spec = SPECS[roster.get(myId).spec];
  let h = `<span class="close" data-x>×</span><h2>${intro ? 'Ваша скрытая роль' : 'Журнал'}</h2>`;
  h += `<div style="font-size:22px;color:${r.side === 'bad' ? 'var(--bad)' : 'var(--good)'}">${r.name}</div><p>${r.desc}</p>`;
  h += `<div class="muted">Открытая специализация: <b>${spec.name}</b> — ${spec.desc}</div>`;
  if (ROLE_TASKS[myRole] && !(m.revealed)) {
    h += '<h3>Тайные задания (F — удерживать на месте)</h3>';
    for (const a of ROLE_TASKS[myRole]) {
      const d = m.done && m.done.includes(a);
      h += `<div class="task ${d ? 'done' : ''}">${d ? '✓' : '○'} <b>${SECRET[a].name}</b> — <span class="muted">${SECRET[a].hint}</span></div>`;
    }
    h += '<div class="muted">Каждое действие оставляет улику. Не попадитесь Сыщику! Мешать строительству тоже можно.</div>';
    if (m.plotFailed) h += '<div style="color:var(--bad)">Ваш замысел провален.</div>';
  }
  if (myRole === 'detective') {
    h += `<h3>Улики (${(m.clues || []).length})</h3>`;
    h += (m.clues || []).map((c) => `<div class="clue"><b>${c.label}</b> <span class="muted">(${fmtTime(c.t)})</span><br>${c.hint}</div>`).join('') || '<div class="muted">Улики светятся голубым лучом — их видите только вы.</div>';
  }
  h += '<h3>Общая цель</h3><div class="muted">Склад (берег) → Мастерская → Ферма + Верфь → корабль и рейсы в Рим → Ратуша.</div>';
  if (intro) h += '<p><button class="btn primary" data-x>Понятно, в путь!</button></p>';
  setHTML($('journal'), h);
}
$('journal').addEventListener('click', (e) => { if (e.target.closest('[data-x]')) closeModals(); });

// --- Голосование ---
let voteData = null;
function openVote(m) { voteData = m; openModal('voteBox'); renderVote(); }
function renderVote() {
  if (!voteData) return;
  const voted = ST && ST.me.voted;
  let h = `<span class="close" data-x>×</span><h2>Народное собрание</h2><div>Созвал(а): ${esc(voteData.by)} · осталось ${ST && ST.vote ? ST.vote.left : 0}с</div>`;
  h += '<h3>Улики Сыщика</h3>' + voteData.clues.map((c) => `<div class="clue">${esc(c)}</div>`).join('');
  h += '<h3>Кто предатель?</h3>';
  if (!me.alive || me.ghost) h += '<div class="muted">Мёртвые не голосуют.</div>';
  else {
    for (const c of voteData.candidates) h += `<button class="btn vbtn ${String(voted) === String(c.id) ? 'chosen' : ''}" data-v="${c.id}">${esc(c.name)}${c.id === myId ? ' (вы)' : ''}</button>`;
    h += `<button class="btn vbtn ${voted === 'skip' ? 'chosen' : ''}" data-v="skip">Воздержаться</button>`;
  }
  setHTML($('voteBox'), h);
}
$('voteBox').addEventListener('click', (e) => {
  if (e.target.closest('[data-x]')) return closeModals();
  const b = e.target.closest('[data-v]');
  if (b) net({ type: 'vote', target: b.dataset.v });
});
function closeVote(m) {
  voteData = null;
  if (!$('voteBox').classList.contains('hidden')) closeModals();
}

// --- Смерть / конец ---
function onDead(m) {
  $('deadOverlay').classList.remove('hidden');
  if (m.permanent) {
    $('deadText').innerHTML = 'Вы убиты другим поселенцем.<br><span class="muted">Теперь вы призрак: можете летать и общаться с другими призраками.</span>';
    setTimeout(() => $('deadOverlay').classList.add('hidden'), 5000);
  } else {
    let t = m.t;
    const why = m.monster ? 'Вас раздавило чудовище' : 'Вас растерзали звери';
    $('deadText').textContent = `${why}. Возрождение через ${t}…`;
    const iv = setInterval(() => { t--; if (t <= 0 || $('deadOverlay').classList.contains('hidden')) return clearInterval(iv); $('deadText').textContent = `${why}. Возрождение через ${t}…`; }, 1000);
  }
}
function onEnd(m) {
  started = false;
  if (document.pointerLockElement) document.exitPointerLock();
  closeModals();
  const mine = m.roles.find((r) => r.name === roster.get(myId).name) || { side: 'good', revealed: false };
  const iWon = m.side === 'good' ? mine.side === 'good' : (m.who ? m.who === myId : mine.side === 'bad' && !mine.revealed);
  let h = `<h1 class="${m.side}">${m.side === 'good' ? 'Победа поселенцев!' : 'Победа тёмной стороны'}</h1><p style="text-align:center">${esc(m.text)}</p>`;
  h += `<p style="text-align:center;font-size:20px">${iWon ? '🏆 Вы победили!' : 'Вы проиграли.'}</p>`;
  h += '<table>' + m.roles.map((r) => `<tr><td><span class="swatch" style="background:${hexCss(r.color)}"></span> ${esc(r.name)}</td><td class="${r.side}">${r.role}</td><td class="muted">${r.revealed ? 'разоблачён' : ''} ${r.side === 'bad' ? `заданий: ${r.done}/3` : ''}</td></tr>`).join('') + '</table>';
  h += '<p style="text-align:center"><button class="btn primary" id="restartBtn">Новая экспедиция</button></p><div class="muted" style="text-align:center">Начать новую игру может первый подключённый игрок.</div>';
  $('endCard').innerHTML = h;
  $('endScreen').classList.remove('hidden');
  $('restartBtn').onclick = () => net({ type: 'restart' });
}

// ---------- Ввод ----------
const keys = {};
let selSlot = 0;
let chatting = false;
let mouseDown = false;
renderer.domElement.addEventListener('click', () => { if (started && !anyModal()) renderer.domElement.requestPointerLock(); });
document.addEventListener('pointerlockchange', () => { $('lockHint').classList.toggle('hidden', !!document.pointerLockElement); });
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== renderer.domElement) return;
  camYaw -= e.movementX * 0.0028;
  camPitch = Math.min(1.2, Math.max(-0.25, camPitch + e.movementY * 0.0028));
});
document.addEventListener('wheel', (e) => { camDist = Math.min(18, Math.max(4, camDist + Math.sign(e.deltaY))); });
document.addEventListener('mousedown', (e) => {
  if (!started || document.pointerLockElement !== renderer.domElement) return;
  if (placing) {
    if (e.button === 0 && placing.ok) { net({ type: 'place', btype: placing.type, x: placing.x, z: placing.z, ry: placing.ry }); stopPlacing(); }
    else if (e.button === 0) addLog(placing.err, 'bad');
    else if (e.button === 2) stopPlacing();
    return;
  }
  if (e.button === 0) { mouseDown = true; attack(); }
});
document.addEventListener('mouseup', () => (mouseDown = false));
document.addEventListener('contextmenu', (e) => e.preventDefault());
function attack() {
  if (!me.alive || me.ghost) return;
  me.ry = camYaw + Math.PI;
  const it = ST && ST.me.eq >= 0 ? ST.me.items[ST.me.eq] : null;
  const wpn = it && ITEMS[it.type].kind === 'weapon' ? ITEMS[it.type] : S.FIST;
  const tnow = performance.now() / 1000;
  if (tnow - (me.lastAtk || 0) < wpn.cd) return;
  me.lastAtk = tnow;
  me.atkT = 1; me.atkType = wpn.thrown ? 'throw' : 'melee';
  net({ type: 'attack', ry: me.ry });
}

function useSlot(i) {
  const it = ST.me.items[i];
  if (!it) return;
  selSlot = i;
  if (it.type === 'gull' && myRole === 'detective') {
    me.ry = camYaw + Math.PI; me.atkT = 1; me.atkType = 'throw';
    net({ type: 'use', slot: i, ry: me.ry });
  } else net({ type: 'use', slot: i });
}

// --- Инвентарь ---
let invSel = 0;
function renderInventory() {
  if (!ST) return;
  const m = ST.me;
  const tot = S.CARRY_RES.reduce((a, k) => a + m.inv[k], 0);
  let h = '<span class="close" data-x>×</span><h2>Инвентарь</h2>';
  h += `<div class="muted">Здоровье ${Math.round(me.hp)}/${me.maxHp} · уровень ${m.level} · опыт ${m.xp}</div>`;
  h += `<h3>Ресурсы (${tot}/${m.cap})</h3><div class="resgrid">` + S.CARRY_RES.map((k) => `<div class="rescell"><b>${m.inv[k]}</b><span>${RES[k]}</span></div>`).join('') + '</div>';
  h += `<h3>Предметы (${m.items.length}/${CFG.slots}) — 1–${CFG.hotbar} на панели быстрого доступа</h3><div class="invgrid">`;
  for (let i = 0; i < CFG.slots; i++) {
    const it = m.items[i], def = it && ITEMS[it.type];
    h += `<div class="islot ${i < CFG.hotbar ? 'hb' : ''} ${invSel === i ? 'sel' : ''} ${m.eq === i ? 'eq' : ''}" data-slot="${i}">${i < CFG.hotbar ? `<span class="k">${i + 1}</span>` : ''}${def ? `<span class="ico" style="background:${hexCss(def.color)}"></span><span class="nm">${def.name}</span>` : ''}</div>`;
  }
  h += '</div>';
  const it = m.items[invSel], def = it && ITEMS[it.type];
  if (def) {
    const canUse = def.kind === 'heal' || def.kind === 'weapon' || def.kind === 'gull';
    const useLabel = def.kind === 'weapon' ? (m.eq === invSel ? 'Убрать из рук' : 'Взять в руку') : def.kind === 'gull' ? (myRole === 'detective' ? 'Бросить' : 'Съесть') : 'Использовать';
    h += `<div class="idesc"><b>${def.name}</b><div class="muted">${def.desc || ''}</div>`;
    h += (canUse ? `<button class="btn" data-act="use">${useLabel}</button>` : '') + `<button class="btn" data-act="drop">Выбросить</button>`;
    if (invSel >= CFG.hotbar) h += `<button class="btn" data-act="tohb">На панель</button>`;
    h += '</div>';
  } else h += '<div class="muted idesc">Выберите предмет, чтобы увидеть описание.</div>';
  h += '<div class="muted">Денарии сразу уходят в казну поселения. Ресурсы сдавайте на Склад.</div>';
  setHTML($('invBox'), h);
}
$('invBox').addEventListener('click', (e) => {
  if (e.target.closest('[data-x]')) return closeModals();
  const sl = e.target.closest('[data-slot]');
  if (sl) { invSel = Number(sl.dataset.slot); renderInventory(); return; }
  const act = e.target.closest('[data-act]');
  if (!act || !ST) return;
  if (act.dataset.act === 'use') useSlot(invSel);
  else if (act.dataset.act === 'drop') net({ type: 'drop', slot: invSel });
  else if (act.dataset.act === 'tohb') {
    // на панель: меняем местами с первым пустым или последним слотом панели
    const items = ST.me.items;
    let target = CFG.hotbar - 1;
    for (let i = 0; i < CFG.hotbar; i++) if (!items[i]) { target = i; break; }
    net({ type: 'swap', a: invSel, b: target });
    invSel = target;
  }
});

const chatInput = $('chatInput');
chatInput.addEventListener('keydown', (e) => {
  e.stopPropagation();
  if (e.key === 'Enter') { const t = chatInput.value.trim(); if (t) net({ type: 'chat', text: t }); chatInput.value = ''; closeChat(); }
  else if (e.key === 'Escape') closeChat();
});
function openChat() { chatting = true; $('chatWrap').classList.remove('hidden'); chatInput.focus(); if (document.pointerLockElement) document.exitPointerLock(); }
function closeChat() { chatting = false; $('chatWrap').classList.add('hidden'); chatInput.blur(); }

document.addEventListener('keydown', (e) => {
  if (!started || chatting) return;
  if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
  const k = e.code;
  if (k === 'Tab') e.preventDefault();
  if (keys[k]) return;
  keys[k] = true;
  if (k === 'Enter') return openChat();
  if (k === 'Escape') { stopPlacing(); closeModals(); return; }
  if (k === 'KeyE') onInteractPress();
  if (k === 'KeyB') { if (!$('buildMenu').classList.contains('hidden')) closeModals(); else { stopPlacing(); openModal('buildMenu'); renderBuildMenu(); } }
  if (k === 'KeyJ') { if (!$('journal').classList.contains('hidden')) closeModals(); else { openModal('journal'); renderJournal(); } }
  if (k === 'KeyH' || k === 'F1') { e.preventDefault(); if (!$('help').classList.contains('hidden')) closeModals(); else openModal('help'); }
  if (k === 'KeyM') { if (!$('bigmapWrap').classList.contains('hidden')) closeModals(); else { openModal('bigmapWrap'); drawMinimap(); } }
  if (k === 'KeyV') { if (voteData) { openModal('voteBox'); renderVote(); } else addLog('Сейчас нет голосования', 'info'); }
  if (k === 'KeyR' && placing) placing.ry += Math.PI / 4;
  if (k.startsWith('Digit')) {
    const i = Number(k.slice(5)) - 1;
    if (i >= 0 && i < CFG.hotbar && ST && ST.me.items[i]) useSlot(i);
  }
  if (k === 'KeyX') net({ type: 'mask' });
  if (k === 'KeyP') {
    gfxLow = !gfxLow;
    try { localStorage.setItem('insulaGfx', gfxLow ? 'low' : 'high'); } catch {}
    renderer.setPixelRatio(gfxLow ? 1 : Math.min(2, devicePixelRatio)); composer.setPixelRatio(renderer.getPixelRatio());
    addLog(gfxLow ? 'Графика: экономная (без свечения, ниже разрешение)' : 'Графика: высокая', 'info');
  }
  if (k === 'KeyI' || k === 'Tab') { if (!$('invBox').classList.contains('hidden')) closeModals(); else { openModal('invBox'); renderInventory(); } }
  if (k === 'KeyQ' && ST) { const i = ST.me.items.findIndex((it) => ITEMS[it.type].kind === 'heal'); if (i >= 0) net({ type: 'use', slot: i }); }
  if (k === 'KeyG' && ST && ST.me.items[selSlot]) net({ type: 'drop', slot: selSlot });
});
document.addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

// ---------- Взаимодействие ----------
let focus = null;
let hold = null; // {kind:'gather'|'secret', t, ...}
function findFocus() {
  if (!ST || !me.alive || me.ghost) return null;
  let best = null, bd = Infinity;
  const consider = (obj, d) => { if (d < bd) { bd = d; best = obj; } };
  for (const l of loot.values()) { const d = Math.hypot(l.x - me.x, l.z - me.z); if (d < 2.6) consider({ kind: 'loot', id: l.id, label: `[E] Подобрать: ${ITEMS[l.item].name}${l.n > 1 ? ' × ' + l.n : ''}` }, d - 1); }
  for (const c of clues.values()) { const d = Math.hypot(c.x - me.x, c.z - me.z); if (d < 2.6) consider({ kind: 'clue', id: c.id, label: `[E] Осмотреть улику: ${c.label}` }, d - 1.5); }
  for (const o of buildings.values()) {
    const b = o.data, r = BUILDINGS[b.type].r;
    const d = Math.hypot(b.x - me.x, b.z - me.z);
    if (d < r + 3) consider({ kind: 'bld', id: b.id, label: `[E] ${BUILDINGS[b.type].name}${b.built ? (b.ruined ? ' (разрушено)' : '') : ' — стройка'}` }, d - r);
  }
  for (const n of nodes.values()) {
    if (n.amount <= 0) continue;
    const d = Math.hypot(n.x - me.x, n.z - me.z);
    if (d < 3.6) consider({ kind: 'node', id: n.id, label: `[E] удерживать — добывать: ${RES[n.res]} (${n.amount})` }, d);
  }
  return best;
}
function onInteractPress() {
  if (!focus || anyModal()) return;
  if (focus.kind === 'loot') net({ type: 'pickup', id: focus.id });
  else if (focus.kind === 'clue') net({ type: 'clue', id: focus.id });
  else if (focus.kind === 'bld') openPanel(focus.id);
}
function updateHold(dt) {
  // добыча
  if (keys.KeyE && focus && focus.kind === 'node' && !anyModal()) {
    if (!hold || hold.kind !== 'gather' || hold.id !== focus.id) hold = { kind: 'gather', id: focus.id, t: 0 };
    const cd = roster.get(myId).spec === 'gatherer' ? CFG.gathererGatherCd : CFG.gatherCd;
    hold.t += dt;
    showHold(hold.t / cd, 'Добыча…');
    if (hold.t >= cd) { hold.t = 0; net({ type: 'gather', id: focus.id }); me.atkT = 1; }
    return;
  }
  // тайное действие
  const sec = ST && ST.me.secret && ST.me.secret[0];
  if (keys.KeyF && sec && !anyModal()) {
    if (!hold || hold.kind !== 'secret' || hold.action !== sec) hold = { kind: 'secret', action: sec, t: 0 };
    hold.t += dt;
    showHold(hold.t / CFG.secretHold, SECRET[sec].name);
    if (hold.t >= CFG.secretHold) { net({ type: 'secret', action: sec }); hold = null; keys.KeyF = false; }
    return;
  }
  hold = null;
  $('holdBar').classList.add('hidden');
}
function showHold(f, text) {
  $('holdBar').classList.remove('hidden');
  $('holdFill').style.width = Math.min(100, f * 100) + '%';
  $('holdText').textContent = text;
}

// ---------- Движение ----------
function collide(x, z) {
  if (me.ghost) return { x, z };
  for (const o of buildings.values()) {
    const b = o.data;
    if (b.type === 'farm') continue;
    const r = BUILDINGS[b.type].r * (b.type === 'shipyard' ? 0.45 : 0.72);
    const dx = x - b.x, dz = z - b.z, d = Math.hypot(dx, dz);
    if (d < r && d > 0.001) { x = b.x + dx / d * r; z = b.z + dz / d * r; }
  }
  for (const c of staticColliders) {
    const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz);
    if (d < c.r + 0.4 && d > 0.001) { x = c.x + dx / d * (c.r + 0.4); z = c.z + dz / d * (c.r + 0.4); }
  }
  return { x, z };
}
let sendT = 0, moving = false, running = false;
function updateMe(dt) {
  const canMove = (me.alive || me.ghost) && !chatting;
  let ix = 0, iz = 0;
  if (canMove) {
    if (keys.KeyW) iz -= 1; if (keys.KeyS) iz += 1;
    if (keys.KeyA) ix -= 1; if (keys.KeyD) ix += 1;
  }
  moving = ix !== 0 || iz !== 0;
  running = moving && (keys.ShiftLeft || keys.ShiftRight);
  if (moving) {
    const len = Math.hypot(ix, iz); ix /= len; iz /= len;
    // движение относительно камеры
    const fx = Math.sin(camYaw + Math.PI), fz = Math.cos(camYaw + Math.PI);
    const rx = -fz, rz = fx;
    const dx = fx * -iz + rx * ix, dz = fz * -iz + rz * ix;
    let sp = (running ? 10 : 6) * (me.carry ? 0.6 : 1) * (me.ghost ? 1.6 : 1);
    const h = S.terrainHeight(me.x, me.z);
    if (h < 0 && !me.ghost) sp *= 0.6;
    let nx = me.x + dx * sp * dt, nz = me.z + dz * sp * dt;
    if (!me.ghost && S.terrainHeight(nx, nz) < -0.75) { nx = me.x; nz = me.z; }
    // горы непроходимы: пробуем скользить вдоль склона
    if (!me.ghost && S.terrainHeight(nx, nz) > CFG.mountainH && S.terrainHeight(nx, nz) > S.terrainHeight(me.x, me.z)) {
      if (S.terrainHeight(nx, me.z) <= CFG.mountainH) nz = me.z;
      else if (S.terrainHeight(me.x, nz) <= CFG.mountainH) nx = me.x;
      else { nx = me.x; nz = me.z; }
    }
    if (S.islandT(nx, nz) > 1.12) { nx = me.x; nz = me.z; }
    const c = collide(nx, nz);
    me.x = c.x; me.z = c.z;
    const target = Math.atan2(dx, dz);
    let d = target - me.ry; d = Math.atan2(Math.sin(d), Math.cos(d));
    me.ry += d * Math.min(1, dt * 12);
  }
  if (mouseDown && me.alive) attack();
  sendT += dt;
  if (sendT > 0.066) { sendT = 0; net({ type: 'move', x: me.x, z: me.z, ry: me.ry, anim: moving ? (running ? 2 : 1) : 0 }); }
}

// ---------- Цикл рендера ----------
const clock = new THREE.Clock();
const tmpV = new THREE.Vector3();
function lerpAngle(a, b, t) { let d = b - a; d = Math.atan2(Math.sin(d), Math.cos(d)); return a + d * t; }
function updateDayNight() {
  if (!ST) return;
  const f = S.dayFrac(ST.t);
  const dayEnd = 1 - CFG.nightFrac;
  let sunH; // 0..1 яркость
  if (f < dayEnd) sunH = Math.sin((f / dayEnd) * Math.PI) * 0.8 + 0.2; else sunH = 0;
  const night = 1 - Math.min(1, sunH * 3);
  const ang = (f / dayEnd) * Math.PI;
  sun.position.set(me.x + Math.cos(ang) * 120, 30 + Math.sin(Math.min(ang, Math.PI)) * 120, me.z + 60);
  sun.target.position.set(me.x, 0, me.z);
  sun.intensity = 0.12 + 2.0 * sunH;
  sun.color.setHSL(0.1, 0.7, 0.5 + 0.35 * sunH);
  hemi.intensity = 0.2 + 0.4 * sunH;
  hemi.color.setHSL(0.1 + night * 0.5, 0.5, 0.55 + 0.2 * sunH);
  const dayTop = new THREE.Color(0x5aa6dc), nightTop = new THREE.Color(0x0b1430);
  const dayBot = new THREE.Color(0xf6e2b8), nightBot = new THREE.Color(0x26304a);
  skyUni.top.value.copy(dayTop).lerp(nightTop, night);
  skyUni.bottom.value.copy(dayBot).lerp(nightBot, night);
  scene.fog.color.copy(skyUni.bottom.value);
  skyUni.sunDir.value.set(Math.cos(ang), Math.max(-0.2, Math.sin(Math.min(ang, Math.PI))), 0.5).normalize();
  skyUni.sunCol.value.setRGB(1, 0.9, 0.7).multiplyScalar(sunH > 0 ? 1 : 0);
  water.material.envMapIntensity = 0.3 + 0.8 * sunH;
  // карта отражений обновляется раз в несколько секунд
  const nowS = performance.now();
  if (nowS - lastEnvUpdate > 4000) { lastEnvUpdate = nowS; updateEnv(); }
}
let lastEnvUpdate = 0;
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;
  if (started && world) {
    updateMe(dt);
    focus = findFocus();
    if (!placing) $('prompt').innerHTML = focus ? esc(focus.label) : '';
    updatePlacing();
    updateHold(dt);
    // закрыть панель, если отошли
    if (panelBid && buildings.get(panelBid)) { const b = buildings.get(panelBid).data; if (Math.hypot(b.x - me.x, b.z - me.z) > BUILDINGS[b.type].r + 7) closeModals(); }

    // я
    const mo = players.get(myId);
    if (mo) {
      mo.mesh.position.set(me.x, groundY(me.x, me.z) + (me.ghost ? 0.6 + Math.sin(t * 2) * 0.2 : 0), me.z);
      mo.mesh.rotation.y = me.ry;
      me.atkT = Math.max(0, me.atkT - dt * 3);
      MD.animatePlayer(mo.mesh, t, moving, running, me.atkT, me.atkType);
      mo.label.visible = false;
    }
    // другие игроки
    for (const [id, o] of players) {
      if (id === myId) continue;
      const k = Math.min(1, dt * 10);
      o.x += (o.tx - o.x) * k; o.z += (o.tz - o.z) * k; o.ry = lerpAngle(o.ry, o.try, k);
      if (Math.hypot(o.tx - o.x, o.tz - o.z) > 20) { o.x = o.tx; o.z = o.tz; }
      o.mesh.position.set(o.x, groundY(o.x, o.z), o.z);
      o.mesh.rotation.y = o.ry;
      o.atkT = Math.max(0, o.atkT - dt * 3);
      MD.animatePlayer(o.mesh, t + id, o.anim > 0, o.anim === 2, o.atkT, o.atkType);
    }
    for (const o of animals.values()) {
      const k = Math.min(1, dt * 8);
      const mv = Math.hypot(o.tx - o.x, o.tz - o.z) > 0.05;
      o.x += (o.tx - o.x) * k; o.z += (o.tz - o.z) * k; o.ry = lerpAngle(o.ry, o.try, k);
      o.mesh.position.set(o.x, groundY(o.x, o.z), o.z); o.mesh.rotation.y = o.ry;
      o.atkT = Math.max(0, o.atkT - dt * 3);
      MD.animateAnimal(o.mesh, t, mv, o.atkT);
      o.bar.quaternion.copy(camera.quaternion);
    }
    if (monsterObj) {
      const o = monsterObj, k = Math.min(1, dt * 6);
      const mv = Math.hypot(o.tx - o.x, o.tz - o.z) > 0.05;
      o.x += (o.tx - o.x) * k; o.z += (o.tz - o.z) * k; o.ry = lerpAngle(o.ry, o.try, k);
      o.mesh.position.set(o.x, groundY(o.x, o.z), o.z); o.mesh.rotation.y = o.ry;
      o.atkT = Math.max(0, o.atkT - dt * 2);
      MD.animateAnimal(o.mesh, t, mv, o.atkT);
      if (mv && Math.hypot(o.x - me.x, o.z - me.z) < 40) shake = Math.max(shake, 0.15);
    }
    for (const o of buildings.values()) o.bar.quaternion.copy(camera.quaternion);
    for (const l of loot.values()) { l.mesh.children[0].rotation.y = t * 1.5; l.mesh.userData.ring.material.opacity = 0.35 + Math.sin(t * 3) * 0.25; }
    for (const c of clues.values()) c.mesh.rotation.y = t;
    if (campFlame) campFlame.scale.y = 1 + Math.sin(t * 12) * 0.15;
    if (water) { water.position.y = Math.sin(t * 0.6) * 0.06; waterNormal.offset.set(t * 0.004, t * 0.0025); }
    if (dust) {
      dust.position.set(me.x, groundY(me.x, me.z), me.z);
      const a = dust.geometry.attributes.position;
      for (let i = 0; i < a.count; i++) {
        let x = a.getX(i) + dt * 1.6, y = a.getY(i) + Math.sin(t + i) * dt * 0.2;
        if (x > 40) x -= 80;
        a.setX(i, x); a.setY(i, y);
      }
      a.needsUpdate = true;
    }
    for (const o of gulls.values()) {
      const k = Math.min(1, dt * 6);
      o.x += (o.tx - o.x) * k; o.z += (o.tz - o.z) * k; o.ry = lerpAngle(o.ry, o.try, k);
      o.h += ((o.fly ? 7 : 0) - o.h) * Math.min(1, dt * 2);
      o.mesh.position.set(o.x, groundY(o.x, o.z) + o.h, o.z); o.mesh.rotation.y = o.ry;
      MD.animateGull(o.mesh, t + o.x, o.h > 0.5);
    }
    updateProjs(t);
    for (let i = fxList.length - 1; i >= 0; i--) {
      const f = fxList[i];
      f.life -= dt; f.v.y -= 12 * dt;
      f.m.position.addScaledVector(f.v, dt);
      f.m.material.opacity = Math.max(0, f.life / 0.8);
      if (f.life <= 0) { scene.remove(f.m); fxList.splice(i, 1); }
    }
    updateDayNight();

    // камера
    const head = tmpV.set(me.x, groundY(me.x, me.z) + 2.2, me.z);
    const cd = camDist;
    let cx = head.x + Math.sin(camYaw) * Math.cos(camPitch) * cd;
    let cz = head.z + Math.cos(camYaw) * Math.cos(camPitch) * cd;
    let cy = head.y + Math.sin(camPitch) * cd;
    cy = Math.max(cy, groundY(cx, cz) + 0.6);
    if (shake > 0) { cx += (Math.random() - 0.5) * shake; cy += (Math.random() - 0.5) * shake; shake = Math.max(0, shake - dt * 1.5); }
    camera.position.set(cx, cy, cz);
    camera.lookAt(head);
  } else {
    // вращающийся вид в лобби
    camera.position.set(Math.sin(t * 0.05) * 260, 120, Math.cos(t * 0.05) * 260);
    camera.lookAt(0, 0, 0);
  }
  if (gfxLow) renderer.render(scene, camera); else composer.render();
}
animate();
