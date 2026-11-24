// vehicles.js — Neon Harbor's modelled traffic: two-box bodies with glazed
// greenhouses, rimmed wheels that steer and spin, light clusters, mirrors
// and shut-lines. One arcade Vehicle step drives everything — the AI
// traffic, the police (police.js) and the player (player.js) — so a stolen
// car feels the same whoever holds the wheel.
import * as THREE from 'three';
import { AVENUES, STREETS, WORLD, collideCircle } from './world.js';
import { glowTexture, rng } from './textures.js';
import { makePerson } from './people.js';

export const VEHICLE_TYPES = {
  sedan:      { name: 'SEDAN',        top: 37, accel: 15, len: 4.4 },
  hatch:      { name: 'HATCHBACK',    top: 34, accel: 16, len: 3.9 },
  van:        { name: 'CARGO VAN',    top: 30, accel: 12, len: 5.0 },
  pickup:     { name: 'PICKUP',       top: 35, accel: 15, len: 5.0 },
  taxi:       { name: 'HARBOR TAXI',  top: 37, accel: 15, len: 4.4 },
  convertible:{ name: 'CONVERTIBLE',  top: 42, accel: 18, len: 4.3 },
  scooter:    { name: 'SCOOTER',      top: 25, accel: 14, len: 2.0 },
  vanta:      { name: 'VANTA GT',     top: 58, accel: 25, len: 4.6 },
  police:     { name: 'NHPD INTERCEPTOR', top: 47, accel: 19, len: 4.5 },
  policeSuper:{ name: 'INTERCEPTOR GT',   top: 56, accel: 23, len: 4.6 },
};
const PAINTS = [0xe2483d, 0x4a7ab5, 0xf2f4f8, 0x24262a, 0xffd23e, 0x2e8f6e, 0xff8a5c, 0xb46bff, 0x8a8d90, 0x7a2e3f, 0x2b3a4a, 0xe8e3d8];
const glassMat = new THREE.MeshStandardMaterial({ color: 0x1d2833, roughness: 0.22, metalness: 0.65 });
const tyreMat = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.95 });
const rimMat = new THREE.MeshStandardMaterial({ color: 0xc8ccd2, roughness: 0.3, metalness: 0.8 });
const chromeMat = new THREE.MeshStandardMaterial({ color: 0xd8dde2, roughness: 0.25, metalness: 0.85 });
const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2c8 });
const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 14);
const rimGeo = new THREE.CylinderGeometry(0.19, 0.19, 0.25, 8);

function paint(color) { return new THREE.MeshStandardMaterial({ color, roughness: 0.38, metalness: 0.55 }); }
function box(parent, w, h, d, material, x, y, z, cast = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z); m.castShadow = cast; parent.add(m); return m;
}
function wheel(parent, x, z, big = false) {
  const g = new THREE.Group();
  const tyre = new THREE.Mesh(wheelGeo, tyreMat); tyre.rotation.x = Math.PI / 2; tyre.castShadow = true; g.add(tyre);
  const rim = new THREE.Mesh(rimGeo, rimMat); rim.rotation.x = Math.PI / 2; g.add(rim);
  if (big) g.scale.setScalar(1.22);
  g.position.set(x, 0.34 * (big ? 1.22 : 1), z);
  parent.add(g); return g;
}

// Builds the mesh for one vehicle type. Returns {group, wheels, lightbar}.
export function makeVehicleMesh(type, r, colorOverride = null) {
  const g = new THREE.Group();
  const spec = VEHICLE_TYPES[type];
  const L = spec.len, W = type === 'van' || type === 'pickup' ? 2.0 : 1.86;
  const color = colorOverride ?? (type === 'taxi' ? 0xffc21c : type === 'vanta' ? 0xdd9500 : type === 'police' || type === 'policeSuper' ? 0xf2f4f8 : PAINTS[Math.floor(r() * PAINTS.length)]);
  const body = paint(color);
  const wheels = {};
  if (type === 'scooter') {
    box(g, 0.34, 0.5, 1.5, body, 0, 0.5, 0.1);
    box(g, 0.3, 0.34, 0.5, glassMat, 0, 0.86, 0.62);
    const wf = wheel(g, 0, 0.85); wf.scale.setScalar(0.72); wf.position.y = 0.24;
    const wb = wheel(g, 0, -0.8); wb.scale.setScalar(0.72); wb.position.y = 0.24;
    wheels.fl = wheels.fr = wf; wheels.rl = wheels.rr = wb;
    const rider = makePerson(r, { hat: 1, capColor: 0xe2483d });
    rider.group.position.set(0, 0.62, -0.1); rider.group.scale.setScalar(0.96);
    rider.legL.hip.rotation.x = rider.legR.hip.rotation.x = -0.9;
    rider.armL.sh.rotation.x = rider.armR.sh.rotation.x = -0.7;
    g.add(rider.group);
    return { group: g, wheels, lightbar: null };
  }
  if (type === 'vanta' || type === 'policeSuper') {
    // the wedge: low nose, haunched rear, full-width light bars, rear wing
    const nose = box(g, W, 0.34, 1.5, body, 0, 0.52, L / 2 - 0.7); nose.rotation.x = 0.1;
    box(g, W + 0.08, 0.5, L - 1.3, body, 0, 0.55, -0.5);
    box(g, W - 0.24, 0.34, 1.9, glassMat, 0, 0.9, -0.35);
    box(g, W - 0.3, 0.07, 1.7, body, 0, 1.08, -0.4);
    for (const s of [-1, 1]) { // side intakes and mirrors
      box(g, 0.06, 0.3, 0.8, tyreMat, s * (W / 2 + 0.02), 0.62, -0.7);
      box(g, 0.16, 0.06, 0.1, body, s * (W / 2 + 0.1), 0.98, 0.42);
    }
    const wing = box(g, W + 0.1, 0.06, 0.42, tyreMat, 0, 1.12, -L / 2 + 0.3);
    box(g, 0.08, 0.24, 0.08, tyreMat, -0.6, 0.96, -L / 2 + 0.3); box(g, 0.08, 0.24, 0.08, tyreMat, 0.6, 0.96, -L / 2 + 0.3);
    void wing;
    const fl = box(g, W - 0.2, 0.09, 0.06, lightMat, 0, 0.6, L / 2 + 0.01); fl.castShadow = false;
    const tl = box(g, W - 0.16, 0.08, 0.06, tailMat, 0, 0.78, -L / 2 - 0.01); tl.castShadow = false;
    wheels.fl = wheel(g, -W / 2, L / 2 - 0.95); wheels.fr = wheel(g, W / 2, L / 2 - 0.95);
    wheels.rl = wheel(g, -W / 2 - 0.03, -L / 2 + 0.95, true); wheels.rr = wheel(g, W / 2 + 0.03, -L / 2 + 0.95, true);
  } else {
    const hoodY = type === 'van' ? 1.06 : 0.78;
    box(g, W, 0.55, L, body, 0, 0.62, 0);                                  // lower body
    box(g, W - 0.06, 0.16, L - 0.5, chromeMat, 0, 0.38, 0);                // chrome skirt line
    if (type === 'van') {
      box(g, W - 0.04, 1.06, L - 1.1, body, 0, 1.36, -0.4);
      box(g, W - 0.5, 0.5, 0.08, glassMat, 0, 1.1, L / 2 - 0.55);
    } else if (type === 'pickup') {
      box(g, W - 0.16, 0.62, 1.6, glassMat, 0, 1.16, 0.55);
      box(g, W - 0.2, 0.08, 1.5, body, 0, 1.5, 0.55);
      box(g, W - 0.1, 0.42, L / 2 - 0.3, tyreMat, 0, 0.86, -L / 2 + L / 4 + 0.1);
    } else if (type === 'convertible') {
      box(g, W - 0.16, 0.5, 1.7, glassMat, 0, 1.08, 0.62);
      box(g, W - 0.3, 0.3, 1.3, new THREE.MeshStandardMaterial({ color: 0x8a2e2e, roughness: 0.9 }), 0, 0.98, -0.55);
    } else {
      box(g, W - 0.16, 0.6, L * 0.48, glassMat, 0, hoodY + 0.32, -0.12);   // greenhouse
      box(g, W - 0.24, 0.08, L * 0.42, body, 0, hoodY + 0.66, -0.12);      // roof
      for (const s of [-1, 1]) for (const e of [-1, 1])                    // pillars
        box(g, 0.07, 0.56, 0.07, body, s * (W / 2 - 0.14), hoodY + 0.32, -0.12 + e * L * 0.21);
    }
    for (const s of [-1, 1]) { // mirrors, door shut-lines, handles
      box(g, 0.15, 0.06, 0.09, body, s * (W / 2 + 0.09), 1.04, L * 0.18);
      box(g, 0.02, 0.5, 0.02, tyreMat, s * (W / 2 + 0.005), 0.66, 0.28, false);
      box(g, 0.02, 0.5, 0.02, tyreMat, s * (W / 2 + 0.005), 0.66, -0.6, false);
    }
    box(g, W - 0.1, 0.18, 0.14, tyreMat, 0, 0.3, L / 2 + 0.03);            // bumpers
    box(g, W - 0.1, 0.18, 0.14, tyreMat, 0, 0.3, -L / 2 - 0.03);
    for (const s of [-1, 1]) {
      const h = box(g, 0.34, 0.11, 0.05, lightMat, s * (W / 2 - 0.3), 0.68, L / 2 + 0.06, false);
      const t = box(g, 0.34, 0.1, 0.05, tailMat, s * (W / 2 - 0.3), 0.7, -L / 2 - 0.06, false);
      void h; void t;
    }
    if (type === 'taxi') {
      box(g, 0.7, 0.2, 0.3, lightMat, 0, 1.62, -0.12, false);
      box(g, W + 0.02, 0.3, L * 0.5, tyreMat, 0, 0.52, 0, false);
    }
    wheels.fl = wheel(g, -W / 2, L / 2 - 0.95); wheels.fr = wheel(g, W / 2, L / 2 - 0.95);
    wheels.rl = wheel(g, -W / 2, -L / 2 + 0.95); wheels.rr = wheel(g, W / 2, -L / 2 + 0.95);
  }
  let lightbar = null;
  if (type === 'police' || type === 'policeSuper') {
    box(g, W + 0.02, 0.42, L * 0.44, tyreMat, 0, 0.6, 0, false);           // black door band
    box(g, 0.5, 0.3, 0.1, chromeMat, 0, 0.42, L / 2 + 0.12);               // push bar hint
    lightbar = new THREE.Group();
    const base = box(lightbar, 1.15, 0.09, 0.34, tyreMat, 0, 0, 0);
    void base;
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.13, 0.3), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    red.position.set(-0.29, 0.1, 0); lightbar.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.13, 0.3), new THREE.MeshBasicMaterial({ color: 0x2266ff }));
    blue.position.set(0.29, 0.1, 0); lightbar.add(blue);
    const glowR = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('#ff2222'), color: 0xff2222, transparent: true, opacity: 0, depthWrite: false }));
    glowR.position.set(-0.29, 0.12, 0); glowR.scale.set(2.2, 1.1, 1); lightbar.add(glowR);
    const glowB = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('#2266ff'), color: 0x2266ff, transparent: true, opacity: 0, depthWrite: false }));
    glowB.position.set(0.29, 0.12, 0); glowB.scale.set(2.2, 1.1, 1); lightbar.add(glowB);
    lightbar.position.set(0, type === 'policeSuper' ? 1.2 : 1.52, -0.12);
    g.add(lightbar);
    lightbar.userData = { red, blue, glowR, glowB };
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { group: g, wheels, lightbar };
}

let vehicleSeq = 0;
export class Vehicle {
  constructor(scene, type, x, z, heading = 0) {
    this.id = ++vehicleSeq;
    this.type = type;
    this.spec = VEHICLE_TYPES[type];
    const r = rng(7000 + this.id * 131);
    const built = makeVehicleMesh(type, r);
    this.group = built.group; this.wheels = built.wheels; this.lightbar = built.lightbar;
    this.group.position.set(x, 0, z);
    this.heading = heading;
    this.speed = 0; this.steer = 0; this.health = 100;
    this.driver = null;             // null parked | 'ai' | 'player' | 'police'
    this.wheelSpin = 0;
    scene.add(this.group);
  }
  get pos() { return this.group.position; }
  get forward() { return { x: Math.sin(this.heading), z: Math.cos(this.heading) }; }
  // Arcade step shared by every driver. throttle -1..1, steer -1..1.
  step(dt, throttle, steer) {
    const top = this.spec.top * (0.45 + 0.55 * (this.health / 100));
    if (throttle > 0) this.speed += this.spec.accel * throttle * dt * (1 - Math.max(0, this.speed) / (top * 1.15));
    else if (throttle < 0) this.speed += (this.speed > 0.5 ? -26 : this.spec.accel * 0.6 * throttle) * dt;
    this.speed -= this.speed * 0.55 * dt;
    if (Math.abs(this.speed) < 0.04 && throttle === 0) this.speed = 0;
    this.speed = Math.max(-9, Math.min(top, this.speed));
    this.steer += (steer - this.steer) * Math.min(1, dt * 7);
    const steerAuthority = Math.min(1, Math.abs(this.speed) / 6) * Math.sign(this.speed || 1);
    this.heading += this.steer * 1.65 * steerAuthority * dt * (Math.abs(this.speed) > 0.1 ? 1 : 0) * (this.speed < 0 ? -1 : 1);
    const f = this.forward;
    this.pos.x += f.x * this.speed * dt;
    this.pos.z += f.z * this.speed * dt;
    const before = { x: this.pos.x, z: this.pos.z };
    collideCircle(this.pos, 1.55);
    if (Math.hypot(this.pos.x - before.x, this.pos.z - before.z) > 0.02 && Math.abs(this.speed) > 6) {
      this.health = Math.max(18, this.health - Math.abs(this.speed) * 0.55);
      this.speed *= -0.25;
    }
    this.pos.z = Math.min(this.pos.z, WORLD.waterZ + 2);
    this.group.rotation.y = this.heading;
    this.wheelSpin += this.speed * dt / 0.34;
    for (const k of ['fl', 'fr', 'rl', 'rr']) {
      const w = this.wheels[k]; if (!w) continue;
      w.rotation.y = (k === 'fl' || k === 'fr') ? this.steer * 0.45 : 0;
      w.children.forEach(c => { c.rotation.y = this.wheelSpin; });
    }
    if (this.lightbar) {
      const on = this.driver === 'police';
      const ph = Math.floor(performance.now() / 280) % 2 === 0;
      const u = this.lightbar.userData;
      u.red.material.color.setHex(on && ph ? 0xff2222 : 0x661111);
      u.blue.material.color.setHex(on && !ph ? 0x2266ff : 0x112266);
      u.glowR.material.opacity = on && ph ? 0.75 : 0;
      u.glowB.material.opacity = on && !ph ? 0.75 : 0;
    }
  }
}

// Lane helpers: right-hand traffic on the avenue/street grid.
function lanePoint(kind, line, along, dirSign) {
  // returns the world point `along` metres down the lane
  if (kind === 'z') return { x: line + (dirSign > 0 ? -3 : 3), z: along };
  return { x: along, z: line + (dirSign > 0 ? 3 : -3) };
}
export class TrafficSystem {
  constructor(scene, people) {
    this.scene = scene; this.people = people;
    this.r = rng(4242);
    this.vehicles = [];
    const types = ['sedan', 'hatch', 'van', 'pickup', 'taxi', 'convertible', 'sedan', 'hatch', 'taxi', 'sedan', 'pickup', 'van', 'convertible', 'sedan', 'hatch', 'scooter', 'sedan', 'taxi', 'van', 'hatch', 'pickup', 'sedan', 'convertible', 'scooter', 'sedan', 'hatch'];
    for (let i = 0; i < types.length; i++) {
      const kind = this.r() < 0.5 ? 'z' : 'x';
      const line = kind === 'z' ? AVENUES[Math.floor(this.r() * AVENUES.length)] : STREETS[Math.floor(this.r() * STREETS.length)];
      const dirSign = this.r() < 0.5 ? 1 : -1;
      const along = -150 + this.r() * 280;
      const p = lanePoint(kind, line, along, dirSign);
      const v = new Vehicle(scene, types[i], p.x, p.z, kind === 'z' ? (dirSign > 0 ? Math.PI : 0) : (dirSign > 0 ? Math.PI / 2 : -Math.PI / 2));
      v.driver = 'ai';
      v.ai = { kind, line, dirSign, cruise: 8.5 + this.r() * 4.5 };
      this.vehicles.push(v);
    }
    // parked cars along curbs and in the diner forecourt
    this.parked = [];
    const parkTypes = ['sedan', 'hatch', 'pickup', 'van', 'convertible', 'sedan', 'taxi', 'hatch', 'sedan', 'pickup'];
    for (let i = 0; i < parkTypes.length; i++) {
      const a = AVENUES[i % AVENUES.length];
      const x = a + (i % 2 ? 8.6 : -8.6), z = -140 + i * 26;
      const v = new Vehicle(scene, parkTypes[i], x, z, i % 2 ? 0 : Math.PI);
      this.parked.push(v); this.vehicles.push(v);
    }
    for (let i = 0; i < 3; i++) {
      const v = new Vehicle(scene, ['sedan', 'hatch', 'convertible'][i], 66 + i * 7, 101, Math.PI);
      this.parked.push(v); this.vehicles.push(v);
    }
    // the hero: a VANTA GT waiting by the diner, keys in, nobody watching
    this.hero = new Vehicle(scene, 'vanta', 80, 102, Math.PI * 0.96);
    this.parked.push(this.hero); this.vehicles.push(this.hero);
    this.pulloutTimer = 24;
  }
  activateParked(v) {
    // a pedestrian climbs in and the car pulls out into traffic
    let nearest = null, nd = 1e9;
    if (this.people) for (const ped of this.people.peds) {
      if (ped.role !== 'walker') continue;
      const d = Math.hypot(ped.x - v.pos.x, ped.z - v.pos.z);
      if (d < nd) { nd = d; nearest = ped; }
    }
    if (nearest && nd < 42) { nearest.P.group.visible = false; nearest.state = 'gone'; nearest.role = 'gone'; }
    const kind = Math.abs(v.pos.x - Math.round(v.pos.x / 60) * 60) < 14 ? 'z' : 'x';
    const line = kind === 'z' ? AVENUES.reduce((b, a) => Math.abs(a - v.pos.x) < Math.abs(b - v.pos.x) ? a : b, AVENUES[0])
                             : STREETS.reduce((b, s) => Math.abs(s - v.pos.z) < Math.abs(b - v.pos.z) ? s : b, STREETS[0]);
    v.driver = 'ai';
    v.ai = { kind, line, dirSign: this.r() < 0.5 ? 1 : -1, cruise: 8.5 + this.r() * 4 };
    this.parked = this.parked.filter(p => p !== v);
  }
  update(dt, playerPos, playerVehicle) {
    this.pulloutTimer -= dt;
    if (this.pulloutTimer <= 0) {
      this.pulloutTimer = 26 + this.r() * 22;
      const candidates = this.parked.filter(v => v !== this.hero && v.driver === null);
      if (candidates.length > 4) this.activateParked(candidates[Math.floor(this.r() * candidates.length)]);
    }
    for (const v of this.vehicles) {
      if (v.driver !== 'ai') continue;
      const ai = v.ai, f = v.forward;
      const along = ai.kind === 'z' ? v.pos.z : v.pos.x;
      const ahead = lanePoint(ai.kind, ai.line, along + ai.dirSign * 26, ai.dirSign);
      // choose a turn at the next intersection sometimes
      const crossLines = ai.kind === 'z' ? STREETS : AVENUES;
      let nextCross = null, nd = 1e9;
      for (const c of crossLines) { const d = (c - along) * ai.dirSign; if (d > 4 && d < nd) { nd = d; nextCross = c; } }
      let tx = ahead.x, tz = ahead.z;
      if (nextCross !== null && nd < 15 && this.r() < 0.012) {
        ai.kind = ai.kind === 'z' ? 'x' : 'z';
        ai.line = nextCross;
        ai.dirSign = this.r() < 0.5 ? 1 : -1;
        const p = lanePoint(ai.kind, ai.line, (ai.kind === 'z' ? v.pos.z : v.pos.x) + ai.dirSign * 20, ai.dirSign);
        tx = p.x; tz = p.z;
      }
      // gap-keeping: slow for the car ahead or the player on foot
      let target = ai.cruise;
      for (const o of this.vehicles) {
        if (o === v) continue;
        const dx = o.pos.x - v.pos.x, dz = o.pos.z - v.pos.z;
        const fwd = dx * f.x + dz * f.z, lat = Math.abs(dx * f.z - dz * f.x);
        if (fwd > 0 && fwd < 10 && lat < 2.1) target = Math.min(target, Math.max(0, (fwd - 5.5) * 1.4));
      }
      if (playerPos && !playerVehicle) {
        const dx = playerPos.x - v.pos.x, dz = playerPos.z - v.pos.z;
        const fwd = dx * f.x + dz * f.z, lat = Math.abs(dx * f.z - dz * f.x);
        if (fwd > 0 && fwd < 7 && lat < 1.8) target = 0;
      }
      const desired = Math.atan2(tx - v.pos.x, tz - v.pos.z);
      let diff = desired - v.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const steer = Math.max(-1, Math.min(1, diff * 1.6));
      const throttle = v.speed < target ? 0.75 : (v.speed > target + 1.5 ? -0.7 : 0);
      v.step(dt, throttle, steer);
    }
    // gentle car-to-car separation so traffic never overlaps
    for (let i = 0; i < this.vehicles.length; i++) for (let j = i + 1; j < this.vehicles.length; j++) {
      const a = this.vehicles[i], b = this.vehicles[j];
      if (a.driver === null && b.driver === null) continue;
      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d2 = dx * dx + dz * dz;
      if (d2 < 9.6 && d2 > 0.001) {
        const d = Math.sqrt(d2), push = (3.1 - d) / 2, ux = dx / d, uz = dz / d;
        if (a.driver !== null) { a.pos.x -= ux * push; a.pos.z -= uz * push; }
        if (b.driver !== null) { b.pos.x += ux * push; b.pos.z += uz * push; }
      }
    }
  }
}
