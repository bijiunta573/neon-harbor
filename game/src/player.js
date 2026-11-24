// player.js — Rio, the player's avatar: third-person walking with a real
// walk cycle, jumping, sprinting, entering and driving any vehicle in the
// city, and hitscan combat for the four weapon slots.
import * as THREE from 'three';
import { makePerson } from './people.js';
import { collideCircle, WORLD } from './world.js';
import { rng } from './textures.js';

export const WEAPONS = [
  { name: 'FISTS', damage: 12, rate: 0.42, range: 2.4, ammo: Infinity, spread: 0 },
  { name: 'PISTOL', damage: 26, rate: 0.34, range: 90, ammo: 60, spread: 0.012 },
  { name: 'SMG', damage: 17, rate: 0.105, range: 75, ammo: 160, spread: 0.03 },
  { name: 'RIFLE', damage: 44, rate: 0.24, range: 130, ammo: 48, spread: 0.006 },
];
export class Player {
  constructor(scene) {
    const r = rng(777);
    this.P = makePerson(r, { top: 0x14b8a6, bottom: 0x2b3a4a, shoes: 0xf2f4f8, hat: 1, capColor: 0x14161c, skin: 0xc68863, hair: 0x1c1512 });
    this.group = this.P.group;
    this.group.position.set(76, 0, 112);
    scene.add(this.group);
    this.heading = Math.PI;             // facing the diner forecourt
    this.health = 100;
    this.vy = 0; this.grounded = true;
    this.phase = 0;
    this.vehicle = null;
    this.weapons = WEAPONS.map(w => ({ ...w }));
    this.weaponIdx = 1;
    this.fireCooldown = 0;
    this.dead = false;
    this.muzzle = null;
  }
  get pos() { return this.group.position; }
  get speed2d() { return this._speed2d || 0; }
  placeAt(x, z, heading) {
    this.pos.set(x, 0, z);
    if (heading !== undefined) this.heading = heading;
    this.exitVehicleSilent();
  }
  exitVehicleSilent() {
    if (this.vehicle) { this.vehicle.driver = null; this.vehicle = null; }
    this.group.visible = true;
  }
  nearestVehicle(vehicles, maxDist = 4.2) {
    let best = null, bd = maxDist;
    for (const v of vehicles) {
      if (v.driver === 'police' || v.driver === 'ai') continue;
      const d = Math.hypot(v.pos.x - this.pos.x, v.pos.z - this.pos.z);
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  }
  enterVehicle(v) {
    this.vehicle = v;
    v.driver = 'player';
    this.group.visible = false;
  }
  exitVehicle() {
    const v = this.vehicle;
    if (!v) return;
    const side = { x: Math.cos(v.heading), z: -Math.sin(v.heading) };
    this.pos.set(v.pos.x + side.x * 2.2, 0, v.pos.z + side.z * 2.2);
    this.heading = v.heading;
    v.driver = null; this.vehicle = null;
    this.group.visible = true;
  }
  // On-foot update. input: {x: strafe -1..1, z: forward -1..1 (camera-relative
  // already applied by caller via moveDir), sprint, jump}
  updateOnFoot(dt, moveX, moveZ, sprint, jump) {
    const mag = Math.hypot(moveX, moveZ);
    const speed = (sprint ? 6.4 : 3.6);
    if (mag > 0.05) {
      const nx = moveX / (mag || 1), nz = moveZ / (mag || 1);
      this.pos.x += nx * speed * Math.min(1, mag) * dt;
      this.pos.z += nz * speed * Math.min(1, mag) * dt;
      this.heading = Math.atan2(nx, nz);
      this._speed2d = speed * Math.min(1, mag);
    } else this._speed2d = 0;
    collideCircle(this.pos, 0.42);
    if (jump && this.grounded) { this.vy = 4.6; this.grounded = false; }
    if (!this.grounded) {
      this.vy -= 13.5 * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y <= 0) { this.pos.y = 0; this.vy = 0; this.grounded = true; }
    }
    this.group.rotation.y = this.heading;
    // walk cycle on the shared humanoid rig
    const P = this.P, moving = this._speed2d > 0.2;
    if (moving) {
      this.phase += dt * (sprint ? 11.5 : 8.4);
      const s = Math.sin(this.phase), amp = sprint ? 0.68 : 0.5;
      P.armL.sh.rotation.x = s * amp * 0.85; P.armR.sh.rotation.x = -s * amp * 0.85;
      P.legL.hip.rotation.x = -s * amp; P.legR.hip.rotation.x = s * amp;
      P.legL.shin.rotation.x = Math.max(0, -s) * 0.7; P.legR.shin.rotation.x = Math.max(0, s) * 0.7;
      P.hips.position.y = 0.96 + Math.abs(Math.cos(this.phase)) * 0.05;
    } else {
      for (const k of ['armL', 'armR']) P[k].sh.rotation.x *= 0.8;
      P.legL.hip.rotation.x *= 0.8; P.legR.hip.rotation.x *= 0.8;
      P.legL.shin.rotation.x *= 0.8; P.legR.shin.rotation.x *= 0.8;
      P.hips.position.y = 0.96 + Math.sin(performance.now() / 480) * 0.008;
    }
    if (this.weaponIdx > 0) { // gun arm stays up while a firearm is out
      P.armR.sh.rotation.x = -1.25; P.armR.fore.rotation.x = -0.15;
    } else P.armR.fore.rotation.x = -0.12;
    this.pos.z = Math.min(this.pos.z, WORLD.waterZ + 24);
  }
  damage(amount) {
    if (this.dead) return;
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) this.dead = true;
  }
  heal(amount) { this.health = Math.min(100, this.health + amount); }
  // Hitscan shot from the camera. targets: [{point:Vector3-ish, radius, kind, ref}]
  // Returns the hit target or null. Handles ammo, cooldown, tracer + flash.
  shoot(scene, origin, dir, targets, audio) {
    const w = this.weapons[this.weaponIdx];
    if (this.fireCooldown > 0) return null;
    if (w.ammo <= 0) { this.fireCooldown = 0.3; return 'dry'; }
    this.fireCooldown = w.rate;
    if (w.ammo !== Infinity) w.ammo--;
    if (audio) audio.gunshot(this.weaponIdx);
    const d = dir.clone();
    if (w.spread) {
      d.x += (Math.random() - 0.5) * w.spread * 2;
      d.y += (Math.random() - 0.5) * w.spread * 2;
      d.z += (Math.random() - 0.5) * w.spread * 2;
      d.normalize();
    }
    let best = null, bestT = w.range;
    for (const t of targets) {
      const ox = t.point.x - origin.x, oy = t.point.y - origin.y, oz = t.point.z - origin.z;
      const along = ox * d.x + oy * d.y + oz * d.z;
      if (along < 0 || along > bestT) continue;
      const px = origin.x + d.x * along - t.point.x, py = origin.y + d.y * along - t.point.y, pz = origin.z + d.z * along - t.point.z;
      const perp = Math.hypot(px, py, pz);
      if (perp < t.radius) { best = t; bestT = along; }
    }
    // tracer: a brief bright line from the muzzle to the hit (or full range)
    const end = origin.clone().add(d.clone().multiplyScalar(best ? bestT : Math.min(w.range, 60)));
    const muzzlePos = this.vehicle ? this.vehicle.pos.clone().setY(1.2) : this.pos.clone().setY(1.35);
    const geo = new THREE.BufferGeometry().setFromPoints([muzzlePos, end]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 }));
    scene.add(line);
    setTimeout(() => { scene.remove(line); geo.dispose(); line.material.dispose(); }, 45);
    if (best) best.damage = w.damage;
    return best;
  }
  updateCooldown(dt) { this.fireCooldown = Math.max(0, this.fireCooldown - dt); }
}
