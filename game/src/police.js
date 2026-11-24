// police.js — the Neon Harbor PD. Sedan interceptors at low heat, the
// Interceptor GT supercar from three stars, and AIR-1 'GULL' circling with
// its spotlight from four. Units hunt with roles — pursuit, ramming,
// flanking — and the dispatch panel (hud.js) reads their live distances.
import * as THREE from 'three';
import { Vehicle } from './vehicles.js';
import { AVENUES, STREETS } from './world.js';
import { glowTexture, rng } from './textures.js';

const ROLES = ['PURSUIT', 'RAMMING', 'FLANKING', 'PURSUIT', 'RAMMING'];
export class PoliceSystem {
  constructor(scene) {
    this.scene = scene;
    this.r = rng(9001);
    this.units = [];
    this.seq = 0;
    this.spawnCooldown = 0;
    this.stunT = 0;               // Pina's scramble: units hold position
    this.heli = null;
    this.heliAngle = 0;
  }
  desiredCount(wanted) { return [0, 1, 2, 3, 4, 5][wanted] || 0; }
  spawnUnit(playerPos, wanted) {
    const super_ = wanted >= 3 && this.units.filter(u => u.vehicle.type === 'policeSuper').length === 0;
    // spawn on a road 62–84 m away, biased behind the player's view
    let x = playerPos.x, z = playerPos.z;
    for (let tries = 0; tries < 8; tries++) {
      const a = AVENUES[Math.floor(this.r() * AVENUES.length)];
      const s = STREETS[Math.floor(this.r() * STREETS.length)];
      const cand = this.r() < 0.5 ? { x: a, z: playerPos.z + (this.r() < 0.5 ? -70 : 70) } : { x: playerPos.x + (this.r() < 0.5 ? -70 : 70), z: s };
      const d = Math.hypot(cand.x - playerPos.x, cand.z - playerPos.z);
      if (d > 52 && d < 96) { x = cand.x; z = cand.z; break; }
      x = cand.x; z = cand.z;
    }
    const v = new Vehicle(this.scene, super_ ? 'policeSuper' : 'police', x, z, 0);
    v.driver = 'police';
    const unit = { vehicle: v, call: 'UNIT ' + (++this.seq), role: ROLES[this.units.length % ROLES.length], disabled: 0 };
    this.units.push(unit);
    return unit;
  }
  removeUnit(unit) {
    this.scene.remove(unit.vehicle.group);
    this.units = this.units.filter(u => u !== unit);
  }
  ensureHeli() {
    if (this.heli) return;
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2b3a4a, roughness: 0.4, metalness: 0.5 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.7, 4.6), bodyMat); body.castShadow = true; g.add(body);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.0, 1.6), new THREE.MeshStandardMaterial({ color: 0x9fd8e8, roughness: 0.15, metalness: 0.6 }));
    glass.position.set(0, 0.15, 1.9); g.add(glass);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 3.6), bodyMat);
    tail.position.set(0, 0.3, -3.8); g.add(tail);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, 0.8), new THREE.MeshStandardMaterial({ color: 0xe2483d }));
    fin.position.set(0, 0.7, -5.4); g.add(fin);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.06, 0.5), new THREE.MeshStandardMaterial({ color: 0x14161a }));
    rotor.position.y = 1.15; g.add(rotor);
    const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.5, 0.3), rotor.material);
    tailRotor.position.set(0.3, 0.7, -5.4); g.add(tailRotor);
    for (const s of [-1, 1]) {
      const skid = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 3.4), bodyMat);
      skid.position.set(s * 0.85, -1.05, 0.3); g.add(skid);
    }
    const beam = new THREE.Mesh(
      new THREE.ConeGeometry(7.5, 30, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2c8, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    beam.position.y = -15.8; g.add(beam);
    const pool = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('#fff2c8'), color: 0xfff2c8, transparent: true, opacity: 0.4, depthWrite: false }));
    pool.scale.set(13, 13, 1); pool.position.y = -29.5; g.add(pool);
    const light = new THREE.SpotLight(0xfff2c8, 900, 70, 0.42, 0.5, 1.4);
    light.position.set(0, -1, 0);
    light.target.position.set(0, -30, 0);
    g.add(light); g.add(light.target);
    const blink = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('#ff2222'), color: 0xff2222, transparent: true, opacity: 0.8, depthWrite: false }));
    blink.scale.set(2.4, 2.4, 1); blink.position.set(0, -0.6, -1); g.add(blink);
    g.position.set(0, 30, -60);
    this.scene.add(g);
    this.heli = { group: g, rotor, tailRotor, blink };
  }
  update(dt, t, playerPos, playerHeading, wanted) {
    this.spawnCooldown -= dt;
    this.stunT = Math.max(0, this.stunT - dt);
    const want = this.desiredCount(wanted);
    if (wanted > 0 && this.units.length < want && this.spawnCooldown <= 0) {
      this.spawnUnit(playerPos, wanted);
      this.spawnCooldown = 2.2;
    }
    if (wanted === 0 && this.units.length) {
      // heat is gone: units peel off and despawn with distance
      for (const u of [...this.units]) {
        const d = Math.hypot(u.vehicle.pos.x - playerPos.x, u.vehicle.pos.z - playerPos.z);
        u.vehicle.step(dt, d > 30 ? 0.8 : 0.3, 0);
        if (d > 95) this.removeUnit(u);
      }
    }
    for (const u of [...this.units]) {
      const v = u.vehicle;
      const d = Math.hypot(v.pos.x - playerPos.x, v.pos.z - playerPos.z);
      if (d > 150) { this.removeUnit(u); continue; }         // lost the trail entirely
      if (v.health <= 20) {                                   // wrecked: smoke and stop
        u.disabled += dt; v.step(dt, 0, 0);
        if (u.disabled > 6) this.removeUnit(u);
        continue;
      }
      let tx = playerPos.x, tz = playerPos.z;
      if (u.role === 'FLANKING') {                            // aim where the player is heading
        tx += Math.sin(playerHeading) * 16; tz += Math.cos(playerHeading) * 16;
      }
      const desired = Math.atan2(tx - v.pos.x, tz - v.pos.z);
      let diff = desired - v.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const steer = Math.max(-1, Math.min(1, diff * 1.9));
      let throttle = 1;
      if (d < 5.2) throttle = 0.25;                           // don't orbit the player
      if (Math.abs(diff) > 2.2) throttle = 0.55;              // turned around: recover
      if (u.role === 'RAMMING' && d < 26) throttle = 1;       // committed
      v.step(dt, this.stunT > 0 ? 0 : throttle, steer);
      // shove against the player's car so rams register as hits
      if (this.playerVehicleRef) {
        const pv = this.playerVehicleRef;
        const dx = pv.pos.x - v.pos.x, dz = pv.pos.z - v.pos.z, dd = Math.hypot(dx, dz);
        if (dd < 3.4 && dd > 0.01) {
          const push = (3.4 - dd) / 2;
          pv.pos.x += dx / dd * push; pv.pos.z += dz / dd * push;
          v.pos.x -= dx / dd * push; v.pos.z -= dz / dd * push;
          if (Math.abs(v.speed) > 7) { pv.health = Math.max(15, pv.health - 2.2); v.speed *= 0.55; }
        }
      }
    }
    // AIR-1 'GULL'
    if (wanted >= 4) {
      this.ensureHeli();
      const h = this.heli;
      h.group.visible = true;
      this.heliAngle += dt * 0.24;
      const hx = playerPos.x + Math.cos(this.heliAngle) * 14;
      const hz = playerPos.z + Math.sin(this.heliAngle) * 14;
      h.group.position.x += (hx - h.group.position.x) * Math.min(1, dt * 1.6);
      h.group.position.z += (hz - h.group.position.z) * Math.min(1, dt * 1.6);
      h.group.position.y = 25 + Math.sin(t * 0.8) * 1.1;
      h.group.rotation.y = Math.atan2(playerPos.x - h.group.position.x, playerPos.z - h.group.position.z);
      h.rotor.rotation.y += dt * 28;
      h.tailRotor.rotation.x += dt * 34;
      h.blink.material.opacity = Math.floor(t * 2.4) % 2 ? 0.85 : 0.1;
    } else if (this.heli) {
      this.heli.group.visible = false;
    }
  }
  dispatchRows(playerPos) {
    const rows = this.units.map(u => ({
      call: u.vehicle.type === 'policeSuper' ? u.call + ' · GT' : u.call,
      role: u.role,
      dist: Math.round(Math.hypot(u.vehicle.pos.x - playerPos.x, u.vehicle.pos.z - playerPos.z)),
    })).sort((a, b) => a.dist - b.dist).slice(0, 4);
    if (this.heli && this.heli.group.visible) rows.push({ call: "AIR-1 'GULL'", role: 'SHORE WATCH', dist: Math.round(Math.hypot(this.heli.group.position.x - playerPos.x, this.heli.group.position.z - playerPos.z)) });
    return rows;
  }
  nearestDist(playerPos) {
    let d = 1e9;
    for (const u of this.units) d = Math.min(d, Math.hypot(u.vehicle.pos.x - playerPos.x, u.vehicle.pos.z - playerPos.z));
    return d;
  }
}
