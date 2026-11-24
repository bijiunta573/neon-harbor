// main.js — Neon Harbor boots here: renderer, golden-hour grade, the game
// state, input (keyboard + mouse + touch), the third-person camera, the
// wanted/busted/wasted rules, combat resolution, crew abilities, saves,
// and the staging hooks the screenshot session uses.
import * as THREE from 'three';
import { buildWorld, followSun, updateWorld, setShadowQuality, PLACES } from './world.js';
import { PeopleSystem } from './people.js';
import { TrafficSystem } from './vehicles.js';
import { PoliceSystem } from './police.js';
import { Player } from './player.js';
import { Missions } from './missions.js';
import { AudioEngine, STATIONS } from './audio.js';
import { HUD, loadSaves, writeSave } from './hud.js';

const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game-canvas'), antialias: true, powerPreference: 'high-performance' });
const isTouchDevice = matchMedia('(pointer: coarse)').matches;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouchDevice ? 1.6 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.21;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 3200);
camera.position.set(30, 24, 190);

buildWorld(scene);
const people = new PeopleSystem(scene);
const traffic = new TrafficSystem(scene);
const police = new PoliceSystem(scene);
const player = new Player(scene);
const audio = new AudioEngine();

const G = {
  mode: 'title',
  cash: 350, respect: 10, wanted: 0,
  clockMinutes: 17 * 60 + 24,
  cleanTime: 0, bustProgress: 0, hurtFlash: 0, ghost: 0,
  stationName: STATIONS[0],
  crew: [
    { name: 'DARIO', cd: 0, max: 45 },
    { name: 'PINA', cd: 0, max: 50 },
    { name: 'TOMAS', cd: 0, max: 60 },
  ],
  player, police,
  playerPos() { return player.vehicle ? player.vehicle.pos : player.pos; },
};
const missions = new Missions(scene, {
  say: (who, line, dur) => hud.say(who, line, dur),
  banner: (t, s) => hud.banner(t, s),
  setWanted: (n) => { G.wanted = Math.max(G.wanted, n); G.cleanTime = 0; },
  addCash: (n) => { G.cash += n; },
  addRespect: (n) => { G.respect += n; },
  hurtPlayer: (n) => { player.damage(n); G.hurtFlash = 1; },
  audio,
});
G.missions = missions;

const hud = new HUD({
  onNew: () => startGame(true),
  onLoad: (save) => startGame(false, save),
  onSave: () => { saveGame(); hud.banner('GAME SAVED', 'Progress written to a save slot'); },
  onResume: () => setMode('play'),
  onQuit: () => setMode('title'),
  onRespawn: () => respawn(),
  onVolume: (v) => audio.setVolume(v),
  onQuality: (q) => setShadowQuality(q === 'high'),
  onSensitivity: (v) => { settings.sens = v; },
});
const settings = { sens: 0.0026 };
if (isTouchDevice) setShadowQuality(false);

// ------------------------------------------------------------ saves
function saveGame() {
  const saves = loadSaves();
  let idx = saves.findIndex(s => !s);
  if (idx < 0) idx = saves.map((s, i) => [s.when, i]).sort((a, b) => a[0] - b[0])[0][1];
  const p = G.playerPos();
  writeSave(idx, {
    cash: G.cash, respect: G.respect,
    missionIdx: missions.missionIdx, stageIdx: missions.stageIdx,
    shells: missions.shells.map(s => s.got),
    ammo: player.weapons.map(w => (w.ammo === Infinity ? -1 : w.ammo)),
    x: p.x, z: p.z,
  });
  hud.refreshContinue();
}
function applySave(s) {
  G.cash = s.cash; G.respect = s.respect;
  missions.missionIdx = s.missionIdx; missions.stageIdx = s.stageIdx;
  missions.introPlayed = s.stageIdx > 0;
  s.shells.forEach((got, i) => { if (missions.shells[i]) { missions.shells[i].got = got; missions.shells[i].group.visible = !got; } });
  missions.shellsGot = s.shells.filter(Boolean).length;
  s.ammo.forEach((a, i) => { if (player.weapons[i] && a >= 0) player.weapons[i].ammo = a; });
  player.placeAt(s.x, s.z);
}

// ------------------------------------------------------------ modes
function setMode(mode) {
  G.mode = mode;
  hud.showPause(mode === 'pause');
  hud.showMap(mode === 'map');
  if (mode === 'title') { hud.showMenu(); hud.hideOver(); }
  else hud.hideMenu();
  if (mode === 'play') lockPointer();
}
function startGame(fresh, save) {
  if (fresh) {
    G.cash = 350; G.respect = 10; G.wanted = 0;
    missions.missionIdx = 0; missions.stageIdx = 0; missions.done = false; missions.introPlayed = false;
    player.placeAt(76, 112, Math.PI);
  } else if (save) applySave(save);
  player.health = 100; player.dead = false;
  hud.hideOver();
  setMode('play');
  hud.banner('NEON HARBOR', 'Marisol is waiting at the Seaside Diner');
}
function respawn() {
  G.wanted = 0; G.bustProgress = 0;
  player.exitVehicleSilent();
  player.health = 100; player.dead = false;
  player.placeAt(PLACES.hotel.x + 6, PLACES.hotel.z + 20, 0);
  hud.hideOver();
  setMode('play');
}
function gameOver(kind) {
  setMode('over');
  document.exitPointerLock && document.exitPointerLock();
  if (kind === 'BUSTED') {
    const fine = Math.round(G.cash * 0.12);
    G.cash -= fine;
    hud.showOver('BUSTED', `The NHPD impounded your ride and fined you $${fine}. You walk out of the precinct at dawn.`);
  } else {
    const bill = Math.round(G.cash * 0.08);
    G.cash -= bill;
    hud.showOver('WASTED', `Harbor Clinic patched you up — $${bill} on Marisol's tab. The harbor keeps turning.`);
  }
  hud.showPause(false);
  document.getElementById('over').style.display = 'flex';
}

// ------------------------------------------------------------ input
const keys = {};
let camYaw = Math.PI, camPitch = 0.24, mouseDown = false;
addEventListener('keydown', (e) => {
  keys[e.code] = true;
  audio.start();
  if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
  if (G.mode === 'play') {
    if (e.code === 'KeyE') interact();
    if (e.code === 'KeyM') setMode('map');
    if (e.code === 'KeyR') { G.stationName = audio.cycleStation(); }
    if (e.code === 'KeyQ') useCrew(0);
    if (e.code === 'KeyX') useCrew(1);
    if (e.code === 'KeyC') useCrew(2);
    if (e.code.startsWith('Digit')) { const n = parseInt(e.code.slice(5)); if (n >= 1 && n <= 4) player.weaponIdx = n - 1; }
    if (e.code === 'Escape') setMode('pause');
  } else if (G.mode === 'map' && (e.code === 'KeyM' || e.code === 'Escape')) setMode('play');
  else if (G.mode === 'pause' && e.code === 'Escape') setMode('play');
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
function lockPointer() {
  if (isTouchDevice || document.pointerLockElement === renderer.domElement) return;
  try {
    const p = renderer.domElement.requestPointerLock && renderer.domElement.requestPointerLock();
    if (p && p.catch) p.catch(() => { /* no user gesture (staging) — ignore */ });
  } catch { /* pointer lock unavailable in this context */ }
}
renderer.domElement.addEventListener('click', () => { if (G.mode === 'play') lockPointer(); });
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && G.mode === 'play' && !isTouchDevice && !staging) setMode('pause');
});
addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== renderer.domElement || G.mode !== 'play') return;
  camYaw -= e.movementX * settings.sens;
  camPitch = Math.max(-0.12, Math.min(0.95, camPitch + e.movementY * settings.sens));
});
addEventListener('mousedown', (e) => { if (e.button === 0) mouseDown = true; });
addEventListener('mouseup', (e) => { if (e.button === 0) mouseDown = false; });

// touch controls
const touch = { active: false, joyX: 0, joyZ: 0, fire: false };
if (isTouchDevice || 'ontouchstart' in window) {
  const joy = document.getElementById('joy-base'), stick = document.getElementById('joy-stick');
  let joyId = null, lookId = null, lookLX = 0, lookLY = 0;
  const startTouch = () => { document.body.classList.add('touch'); audio.start(); };
  addEventListener('touchstart', startTouch, { passive: true });
  joy.addEventListener('touchstart', (e) => { joyId = e.changedTouches[0].identifier; }, { passive: true });
  addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === joyId) {
        const r = joy.getBoundingClientRect();
        let dx = (t.clientX - (r.left + r.width / 2)) / (r.width / 2);
        let dy = (t.clientY - (r.top + r.height / 2)) / (r.height / 2);
        const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
        touch.joyX = dx; touch.joyZ = dy; touch.active = true;
        stick.style.left = (50 + dx * 30) + '%'; stick.style.top = (50 + dy * 30) + '%';
      } else if (t.identifier === lookId && G.mode === 'play') {
        camYaw -= (t.clientX - lookLX) * 0.005;
        camPitch = Math.max(-0.12, Math.min(0.95, camPitch + (t.clientY - lookLY) * 0.005));
        lookLX = t.clientX; lookLY = t.clientY;
      }
    }
  }, { passive: true });
  addEventListener('touchend', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === joyId) { joyId = null; touch.joyX = touch.joyZ = 0; touch.active = false; stick.style.left = '50%'; stick.style.top = '50%'; }
      if (t.identifier === lookId) lookId = null;
    }
  });
  renderer.domElement.addEventListener('touchstart', (e) => {
    for (const t of e.changedTouches) if (t.clientX > innerWidth / 2) { lookId = t.identifier; lookLX = t.clientX; lookLY = t.clientY; }
  }, { passive: true });
  const bindBtn = (id, down, up) => {
    const el = document.getElementById(id);
    el.addEventListener('touchstart', (e) => { e.preventDefault(); down(); }, { passive: false });
    if (up) el.addEventListener('touchend', (e) => { e.preventDefault(); up(); }, { passive: false });
  };
  bindBtn('btn-fire', () => { touch.fire = true; }, () => { touch.fire = false; });
  bindBtn('btn-act', () => interact());
  bindBtn('btn-jump', () => { keys['Space'] = true; }, () => { keys['Space'] = false; });
  bindBtn('btn-pause-t', () => { if (G.mode === 'play') setMode('pause'); });
}

// ------------------------------------------------------------ actions
function commitCrime(n) {
  if (G.ghost > 0 || G.mode !== 'play') return;
  G.wanted = Math.min(5, G.wanted + n);
  G.cleanTime = 0;
}
function interact() {
  if (player.vehicle) { player.exitVehicle(); audio.engine(0, false); return; }
  const v = player.nearestVehicle([...traffic.vehicles, ...traffic.parked], 4.4);
  if (v) {
    if (traffic.parked.includes(v)) traffic.parked = traffic.parked.filter(p => p !== v);
    player.enterVehicle(v);
    camYaw = v.heading;
    if (v === traffic.hero) {
      if (missions.missionIdx === 1 && missions.stageIdx === 1) { commitCrime(3); hud.say({ name: 'NHPD DISPATCH', color: '#7ab8ff' }, 'All units — the VANTA GT just rolled off the diner forecourt.', 4.5); }
      else if (police.nearestDist(player.pos) < 34) commitCrime(1);
    } else if (police.nearestDist(player.pos) < 26) commitCrime(1);
  }
}
function useCrew(i) {
  const c = G.crew[i];
  if (c.cd > 0 || G.mode !== 'play') return;
  c.cd = c.max;
  audio.objective();
  if (i === 0) {
    if (player.vehicle) player.vehicle.health = Math.min(100, player.vehicle.health + 45);
    G.wanted = Math.max(0, G.wanted - 1);
    hud.say({ name: 'DARIO — MECHANIC', color: '#ffd23e' }, 'Plates swapped, panels straight. You are a ghost with a dent-free car.', 4);
  } else if (i === 1) {
    police.stunT = 6;
    hud.say({ name: 'PINA — GHOST DRIVER', color: '#ff9ecf' }, 'Decoy rolling on Harbor Ave. Their radios are chasing ME now. Go!', 4);
  } else {
    G.ghost = 12;
    hud.say({ name: 'TOMAS — LOOKOUT', color: '#9fe870' }, 'Cameras looped, patrols looking the other way. Twelve seconds of dark.', 4);
  }
}
function buildTargets() {
  const targets = [];
  for (const ped of people.peds) {
    if (ped.state === 'down' || ped.state === 'gone') continue;
    const p = ped.P.group.position;
    targets.push({ point: { x: p.x, y: 1.15, z: p.z }, radius: 0.62, kind: 'ped', ref: ped });
  }
  for (const u of police.units) targets.push({ point: { x: u.vehicle.pos.x, y: 1.0, z: u.vehicle.pos.z }, radius: 2.1, kind: 'cop', ref: u.vehicle });
  for (const v of traffic.vehicles) if (v.driver === 'ai') targets.push({ point: { x: v.pos.x, y: 1.0, z: v.pos.z }, radius: 2.1, kind: 'car', ref: v });
  for (const h of missions.hostiles) if (h.alive) { const p = h.P.group.position; targets.push({ point: { x: p.x, y: 1.15, z: p.z }, radius: 0.62, kind: 'hostile', ref: h }); }
  return targets;
}
function tryShoot() {
  if (player.weaponIdx === 0) return;   // fists don't shoot
  const origin = camera.position.clone();
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const hit = player.shoot(scene, origin, dir, buildTargets(), audio);
  if (hit === 'dry') { hud.banner('OUT OF AMMO', 'That slot is empty — Marisol restocks between missions'); return; }
  if (hit) {
    const dmg = hit.damage;
    if (hit.kind === 'ped') {
      const ped = hit.ref;
      ped.hp = (ped.hp === undefined ? 45 : ped.hp) - dmg;
      people.triggerFlee(ped.P.group.position.x, ped.P.group.position.z, 16);
      if (ped.hp <= 0) { ped.state = 'down'; ped.P.group.rotation.x = -Math.PI / 2; ped.P.group.position.y = 0.2; commitCrime(2); G.respect += 1; }
      else commitCrime(1);
    } else if (hit.kind === 'hostile') {
      hit.ref.hp -= dmg;
      if (G.wanted === 0) commitCrime(1);
    } else if (hit.kind === 'cop') {
      hit.ref.health = Math.max(10, hit.ref.health - dmg * 0.8);
      commitCrime(1);
    } else if (hit.kind === 'car') {
      hit.ref.health = Math.max(10, hit.ref.health - dmg * 0.7);
      commitCrime(1);
    }
  } else if (police.nearestDist(G.playerPos()) < 55) commitCrime(1);
}

// ------------------------------------------------------------ camera
function updateCamera(dt) {
  if (G.mode === 'title' || G.mode === 'over') {
    const t = performance.now() / 1000;
    const a = Math.sin(t * 0.05) * 0.35;
    camera.position.set(Math.sin(a) * 55, 21 + Math.sin(t * 0.11) * 2, 196);
    camera.lookAt(0, 12, 30);
    return;
  }
  const target = G.playerPos();
  const driving = !!player.vehicle;
  if (driving && (keys['KeyW'] || keys['KeyS'] || Math.abs(player.vehicle.speed) > 3)) {
    let diff = player.vehicle.heading - camYaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    camYaw += diff * Math.min(1, dt * 2.4);
  }
  const dist = driving ? 10.5 : 7.2;
  const look = new THREE.Vector3(Math.sin(camYaw) * Math.cos(camPitch), Math.sin(camPitch), Math.cos(camYaw) * Math.cos(camPitch));
  const desired = new THREE.Vector3(target.x, 0, target.z).addScaledVector(look, -dist);
  desired.y = (driving ? 1.2 : 1.7) + Math.sin(camPitch) * dist + 1.4;
  desired.y = Math.max(desired.y, 1.1);
  camera.position.lerp(desired, Math.min(1, dt * (driving ? 5.5 : 8)));
  camera.lookAt(target.x + look.x * 6, (driving ? 1.4 : 1.6), target.z + look.z * 6);
}

// ------------------------------------------------------------ loop
const clockT = new THREE.Clock();
let staging = false;
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clockT.getDelta());
  const t = clockT.elapsedTime;
  const playing = G.mode === 'play';
  if (G.mode !== 'pause') {
    G.clockMinutes += dt * 0.8;
    updateWorld(dt, t);
    people.update(dt, t, G.playerPos());
    traffic.update(dt, t, G.playerPos());
    police.playerVehicleRef = player.vehicle;
    const pp = G.playerPos();
    police.update(dt, t, pp, player.vehicle ? player.vehicle.heading : player.heading, playing ? G.wanted : 0);
    followSun(pp.x, pp.z);
  }
  if (playing) {
    player.updateCooldown(dt);
    for (const c of G.crew) c.cd = Math.max(0, c.cd - dt);
    G.ghost = Math.max(0, G.ghost - dt);
    G.hurtFlash = Math.max(0, G.hurtFlash - dt * 1.6);
    if (player.vehicle) {
      const v = player.vehicle;
      const throttle = (keys['KeyW'] || touch.joyZ < -0.25 ? 1 : 0) + (keys['KeyS'] || touch.joyZ > 0.6 ? -0.62 : 0);
      const steerIn = (keys['KeyA'] ? 1 : 0) + (keys['KeyD'] ? -1 : 0) + (touch.active ? -touch.joyX : 0);
      v.step(dt, throttle, Math.max(-1, Math.min(1, steerIn)), keys['Space']);
      if (keys['Space']) v.speed *= Math.pow(0.24, dt);   // handbrake bite
      audio.engine(v.speed / v.spec.top, true);
      // running someone down is a serious crime
      if (Math.abs(v.speed) > 4) {
        for (const ped of people.peds) {
          if (ped.state === 'down' || ped.state === 'gone') continue;
          const p = ped.P.group.position;
          if (Math.hypot(p.x - v.pos.x, p.z - v.pos.z) < 1.7) {
            ped.state = 'down'; ped.P.group.rotation.x = -Math.PI / 2; ped.P.group.position.y = 0.2;
            people.triggerFlee(v.pos.x, v.pos.z, 18);
            commitCrime(2);
          }
        }
      }
    } else {
      audio.engine(0, false);
      const fwd = (keys['KeyW'] ? 1 : 0) + (keys['KeyS'] ? -1 : 0) + (touch.active ? -touch.joyZ : 0);
      const strafe = (keys['KeyD'] ? 1 : 0) + (keys['KeyA'] ? -1 : 0) + (touch.active ? touch.joyX : 0);
      const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
      const rx = -Math.cos(camYaw), rz = Math.sin(camYaw);
      player.updateOnFoot(dt, fx * fwd + rx * strafe, fz * fwd + rz * strafe, !!(keys['ShiftLeft'] || keys['ShiftRight']), !!keys['Space']);
      if ((mouseDown && document.pointerLockElement === renderer.domElement) || touch.fire) tryShoot();
      // traffic and patrol cars can knock Rio down
      const allCars = [...traffic.vehicles, ...police.units.map(u => u.vehicle)];
      for (const v of allCars) {
        if (Math.abs(v.speed) > 4 && Math.hypot(v.pos.x - player.pos.x, v.pos.z - player.pos.z) < 2.1) {
          player.damage(11); G.hurtFlash = 1;
          player.pos.x += (player.pos.x - v.pos.x) * 0.14; player.pos.z += (player.pos.z - v.pos.z) * 0.14;
        }
      }
    }
    missions.update(dt, t, { playerPos: G.playerPos(), playerVehicle: player.vehicle, heroVehicle: traffic.hero, wanted: G.wanted, mode: G.mode });
    // wanted decay: stay unseen and the stars bleed away
    if (G.wanted > 0) {
      if (police.nearestDist(G.playerPos()) > 55) G.cleanTime += dt; else G.cleanTime = 0;
      if (G.cleanTime > 16) { G.wanted--; G.cleanTime = 0; if (G.wanted === 0) hud.banner('HEAT LOST', 'The NHPD lost your trail'); }
    }
    // bust meter: cornered and slow with a unit on top of you
    const pSpeed = player.vehicle ? Math.abs(player.vehicle.speed) : player.speed2d;
    if (G.wanted > 0 && police.nearestDist(G.playerPos()) < 7.5 && pSpeed < 1.3) G.bustProgress += dt / 2.6;
    else G.bustProgress = Math.max(0, G.bustProgress - dt * 0.8);
    if (G.bustProgress >= 1) gameOver('BUSTED');
    if (player.dead) gameOver('WASTED');
    // prompts
    if (!player.vehicle) {
      const v = player.nearestVehicle([...traffic.vehicles, ...traffic.parked], 4.4);
      hud.setPrompt(v ? `E — ENTER ${v.spec.name}` : null);
    } else hud.setPrompt(null);
    // audio beds
    const nd = police.nearestDist(G.playerPos());
    audio.siren(G.wanted > 0 && nd < 90, Math.max(0, 1 - nd / 90));
    audio.update(dt, t);
  }
  updateCamera(dt);
  if (G.mode !== 'title') hud.update(dt, G);
  renderer.render(scene, camera);
}
hud.showMenu();
animate();

// ------------------------------------------------------------ staging hooks
// Used by the screenshot session: ?shot=cover|cafe|map|title
const params = new URLSearchParams(location.search);
function stageCover() {
  staging = true;
  startGame(true);
  hud.els.banner.style.display = 'none'; hud.bannerTimer = 0;
  missions.missionIdx = 0; missions.stageIdx = 2; missions.introPlayed = true;
  G.cash = 2450; G.respect = 65;
  const hero = traffic.hero;
  hero.pos.set(3.2, 0, 34); hero.heading = Math.PI; hero.speed = 16;
  player.enterVehicle(hero);
  G.wanted = 4; G.cleanTime = 0;
  police.playerVehicleRef = hero;
  for (let i = 0; i < 3; i++) police.spawnUnit(hero.pos, 4);
  const spots = [[-3.5, 52, Math.PI], [5.5, 58, Math.PI], [-6, 14, Math.PI]];
  police.units.forEach((u, i) => { const s = spots[i % spots.length]; u.vehicle.pos.set(s[0], 0, s[1]); u.vehicle.heading = s[2]; u.vehicle.speed = 13; });
  police.ensureHeli();
  // street life around the chase: parked cars at the curbs ahead, two
  // drivers rolling the avenue, pedestrians crowding both sidewalks
  const curbSpots = [[-8.6, -4, 0], [8.6, -18, Math.PI], [-8.6, -38, 0], [8.6, -58, Math.PI]];
  traffic.parked.slice(0, 4).forEach((v, i) => { const s = curbSpots[i]; v.pos.set(s[0], 0, s[1]); v.heading = s[2]; v.group.rotation.y = s[2]; });
  const rollers = [[-3, -22, Math.PI, 9], [3, -70, 0, 10]];
  traffic.vehicles.slice(0, 2).forEach((v, i) => { const s = rollers[i]; v.pos.set(s[0], 0, s[1]); v.heading = s[2]; v.speed = s[3]; });
  let placed = 0;
  for (const ped of people.peds) {
    if (ped.role !== 'walker' || placed >= 10) continue;
    const side = placed % 2 ? 8.4 : -8.4;
    ped.P.group.position.set(side, 0, 44 - placed * 5.5);
    ped.P.group.rotation.y = placed % 2 ? Math.PI : 0;
    placed++;
  }
  camYaw = Math.PI - 0.55; camPitch = 0.15;
  camera.position.set(hero.pos.x - 4.5, 4.4, hero.pos.z + 13);
  hud.say({ name: 'NHPD DISPATCH', color: '#7ab8ff' }, 'All units — gold VANTA GT northbound on Harbor Ave. AIR-1 is overhead.', 30);
  document.exitPointerLock && document.exitPointerLock();
}
function stageCafe() {
  staging = true;
  startGame(true);
  hud.els.banner.style.display = 'none'; hud.bannerTimer = 0;
  missions.missionIdx = 0; missions.stageIdx = 0; missions.introPlayed = true;
  player.placeAt(19.5, 103, 2.25);
  camYaw = 2.25; camPitch = 0.18;
  camera.position.set(13.5, 3.4, 109);
  hud.say({ name: 'MARISOL VEGA — FIXER', color: '#ffd23e' }, 'Sit a minute, Rio. Coffee first — then I tell you about the package at my pier.', 30);
  document.exitPointerLock && document.exitPointerLock();
}
function stageMap() {
  staging = true;
  startGame(true);
  G.cash = 2450; G.respect = 65; G.wanted = 3;
  missions.missionIdx = 1; missions.stageIdx = 2; missions.introPlayed = true;
  for (let i = 0; i < 3; i++) police.spawnUnit(player.pos, 3);
  const dots = [[-34, 18], [42, -28], [6, 58]];
  police.units.forEach((u, i) => { const s = dots[i % dots.length]; u.vehicle.pos.set(s[0], 0, s[1]); u.vehicle.speed = 0; });
  setMode('map');
  document.getElementById('menu').style.display = 'none';
  document.exitPointerLock && document.exitPointerLock();
}
function stageTitle() {
  staging = true;
  G.mode = 'title';
  hud.showMenu();
}
const shot = params.get('shot');
if (shot === 'cover') setTimeout(stageCover, 350);
else if (shot === 'cafe') setTimeout(stageCafe, 350);
else if (shot === 'map') setTimeout(stageMap, 350);
else if (shot === 'title') setTimeout(stageTitle, 350);
window.__NH = { G, player, police, traffic, people, missions, scene, camera, stageCover, stageCafe, stageMap, stageTitle };
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
