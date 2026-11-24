// missions.js — Marisol Vega's three jobs: the story of Neon Harbor.
// Staged objectives (four per mission) with gold marker beams, dialogue
// banners, a package run under sirens, the theft of the VANTA GT, a beach
// rescue fought against three rivals, and an escort home. Also the twelve
// collectible shells hidden around the harbor.
import * as THREE from 'three';
import { PLACES } from './world.js';
import { makePerson } from './people.js';
import { rng } from './textures.js';

export const SHELL_SPOTS = [
  { x: -52, z: 186 }, { x: 96, z: 122 }, { x: 30, z: 90 }, { x: -72, z: 44 },
  { x: 88, z: 90 }, { x: -132, z: -88 }, { x: 134, z: -96 }, { x: -96, z: -16 },
  { x: 8, z: 116 }, { x: -24, z: 62 }, { x: 150, z: 116 }, { x: -150, z: 116 },
];
const MARISOL = { name: 'MARISOL VEGA — FIXER', color: '#ffd23e' };
const RIO = { name: 'RIO — YOU', color: '#14f2d8' };
const PINA = { name: 'PINA — CREW', color: '#ff9ecf' };
const RAY = { name: "RAY — RAY'S CUSTOMS", color: '#ff8a5c' };

export const MISSIONS = [
  {
    title: 'MISSION 1 — WARM WELCOME',
    stages: [
      { text: 'Meet Marisol at the Seaside Diner', next: 'She has a package problem at the marina.', type: 'goto', x: PLACES.diner.x - 2, z: PLACES.diner.z + 7, r: 5 },
      { text: 'Pick up the package at the end of the pier', next: 'Careful — the harbor patrol is watching.', type: 'goto', x: PLACES.pier.x, z: PLACES.pier.z + 14, r: 5 },
      { text: 'Deliver the package to Harbor Freight Depot', next: 'Lose any tail before you roll in.', type: 'gotoVehicle', x: PLACES.warehouse.x + 4, z: PLACES.warehouse.z + 13, r: 8 },
      { text: 'Lose the heat', next: 'Lay low until the stars fade.', type: 'loseHeat' },
    ],
    intro: [MARISOL, "Rio. You owe me, so you drive. There's a package at the end of my pier with your name on it."],
    reward: 600,
  },
  {
    title: 'MISSION 2 — GOLDEN HOUR',
    stages: [
      { text: 'Meet Marisol at the Seaside Diner', next: 'A collector wants a certain supercar.', type: 'goto', x: PLACES.diner.x - 2, z: PLACES.diner.z + 7, r: 5 },
      { text: 'Steal the VANTA GT by the diner', next: 'Keys are in it. They always leave the keys in it.', type: 'enterHero' },
      { text: "Deliver the VANTA GT to Ray's Customs", next: 'Ray pays in cash and asks nothing.', type: 'gotoVehicle', x: PLACES.chopshop.x - 2, z: PLACES.chopshop.z + 12, r: 8, heroOnly: true },
      { text: 'Lose the heat', next: 'Then come back for your cut.', type: 'loseHeat' },
    ],
    intro: [MARISOL, 'See that wedge by my diner? A collector in the hills wants it tonight. Take it to Ray.'],
    reward: 1200,
  },
  {
    title: 'MISSION 3 — LOW TIDE',
    stages: [
      { text: 'Meet Pina at Coral Beach', next: 'She went to settle a debt alone. Bad idea.', type: 'goto', x: PLACES.beach.x, z: PLACES.beach.z - 2, r: 6 },
      { text: 'Drive off the Saltline rivals', next: 'Three of them. Make it loud or make it fast.', type: 'fight', x: PLACES.beach.x, z: PLACES.beach.z + 4 },
      { text: 'Escort Pina to Cafe Plaza', next: 'She stays close. Keep her breathing.', type: 'escort', x: PLACES.cafe.x, z: PLACES.cafe.z, r: 7 },
      { text: 'Bring Pina back to the Seaside Diner', next: 'Then your debt is done, Rio.', type: 'escort', x: PLACES.diner.x - 2, z: PLACES.diner.z + 7, r: 7 },
    ],
    intro: [PINA, 'Rio! Tell Marisol the Saltline crew jumped me at the beach — I need a ride out of this.'],
    reward: 2000,
  },
];

export class Missions {
  constructor(scene, hooks) {
    this.scene = scene; this.hooks = hooks;
    this.r = rng(31337);
    this.missionIdx = 0; this.stageIdx = 0;
    this.done = false;
    this.hostiles = [];
    this.follower = null;
    // the gold objective beam
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xffb300, transparent: true, opacity: 0.19, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 26, 14, 1, true), beamMat);
    this.beam.position.y = 13;
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(1.7, 2.1, 26), ringMat);
    this.ring.rotation.x = -Math.PI / 2; this.ring.position.y = 0.06;
    scene.add(this.beam); scene.add(this.ring);
    // shells: little emissive clams on a bobbing spin
    this.shells = [];
    const shellMat = new THREE.MeshStandardMaterial({ color: 0xffe9f4, emissive: 0xff9ecf, emissiveIntensity: 0.55, roughness: 0.4 });
    for (const s of SHELL_SPOTS) {
      const g = new THREE.Group();
      const a = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), shellMat);
      a.scale.set(1, 0.62, 1); g.add(a);
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), shellMat);
      b.position.set(0, 0.16, -0.08); b.scale.set(1, 0.55, 1); b.rotation.x = -0.7; g.add(b);
      g.position.set(s.x, 0.55, s.z);
      scene.add(g);
      this.shells.push({ group: g, x: s.x, z: s.z, got: false });
    }
    this.shellsGot = 0;
    this.introPlayed = false;
  }
  get stage() { return this.done ? null : MISSIONS[this.missionIdx].stages[this.stageIdx]; }
  get mission() { return MISSIONS[this.missionIdx]; }
  markerPos() {
    const s = this.stage;
    if (!s) return null;
    if (s.type === 'loseHeat') return null;
    if (s.type === 'enterHero') return this.heroPos || null;
    return { x: s.x, z: s.z };
  }
  startMissionDialogue() {
    const m = this.mission;
    if (this.introPlayed) return;
    this.introPlayed = true;
    this.hooks.say(m.intro[0], m.intro[1], 6.5);
  }
  advance() {
    const h = this.hooks;
    this.stageIdx++;
    if (this.stageIdx >= this.mission.stages.length) {
      h.addCash(this.mission.reward);
      h.addRespect(22);
      h.banner('MISSION COMPLETE', `${this.mission.title.split('—')[1].trim()} — $${this.mission.reward} earned`);
      h.audio.missionDone();
      this.missionIdx++;
      this.stageIdx = 0;
      this.introPlayed = false;
      if (this.missionIdx >= MISSIONS.length) {
        this.done = true;
        h.banner('STORY COMPLETE', 'The harbor is yours, Rio. Free roam — the city keeps living.');
        h.addRespect(30);
      }
    } else {
      h.audio.objective();
    }
  }
  spawnHostiles() {
    for (let i = 0; i < 3; i++) {
      const P = makePerson(this.r, { top: 0x37474f, bottom: 0x24262a, hat: 1, capColor: 0xe2483d });
      const x = PLACES.beach.x - 6 + i * 6, z = PLACES.beach.z + 6 + (i % 2) * 3;
      P.group.position.set(x, 0, z);
      this.scene.add(P.group);
      this.hostiles.push({ P, hp: 55, alive: true, shootCd: 1.2 + i * 0.5, phase: i * 2.1 });
    }
    this.hooks.say({ name: 'SALTLINE RIVAL', color: '#ff7a6b' }, 'Wrong beach, driver. Walk away or get carried.', 4.5);
  }
  spawnFollower() {
    const P = makePerson(this.r, { top: 0xff9ecf, bottom: 0xf2ead8, longHair: true });
    P.group.position.set(PLACES.beach.x + 2, 0, PLACES.beach.z);
    this.scene.add(P.group);
    this.follower = { P, phase: 0 };
    this.hooks.say(PINA, 'Car, boat, I do not care — just get me off this beach, Rio.', 4.5);
  }
  update(dt, t, ctx) {
    if (ctx.heroVehicle) this.heroPos = { x: ctx.heroVehicle.pos.x, z: ctx.heroVehicle.pos.z };
    // shells bob, spin, and get collected
    for (const s of this.shells) {
      if (s.got) continue;
      s.group.position.y = 0.55 + Math.sin(t * 2 + s.x) * 0.12;
      s.group.rotation.y += dt * 1.6;
      if (Math.hypot(ctx.playerPos.x - s.x, ctx.playerPos.z - s.z) < 2.1) {
        s.got = true; s.group.visible = false; this.shellsGot++;
        this.hooks.audio.pickup();
        this.hooks.banner('SHELL FOUND', `${this.shellsGot} of 12 harbor shells`);
        this.hooks.addRespect(2);
      }
    }
    const s = this.stage;
    // marker beam follows the objective
    const mp = this.markerPos();
    if (mp) {
      this.beam.visible = this.ring.visible = true;
      this.beam.position.x = mp.x; this.beam.position.z = mp.z;
      this.ring.position.x = mp.x; this.ring.position.z = mp.z;
      const pulse = 1 + Math.sin(t * 3.2) * 0.12;
      this.ring.scale.setScalar(pulse);
    } else this.beam.visible = this.ring.visible = false;
    if (!s || ctx.mode !== 'play') return;
    const px = ctx.playerPos.x, pz = ctx.playerPos.z;
    const near = (x, z, r) => Math.hypot(px - x, pz - z) < r;
    if (this.stageIdx === 0) this.startMissionDialogue();
    switch (s.type) {
      case 'goto':
        if (near(s.x, s.z, s.r)) {
          if (this.missionIdx === 0 && this.stageIdx === 1) { this.hooks.setWanted(2); this.hooks.say(MARISOL, 'NHPD just lit up the marina. Move, Rio — depot, now!', 4.5); }
          if (this.missionIdx === 2 && this.stageIdx === 0) this.spawnHostiles();
          this.advance();
        }
        break;
      case 'enterHero':
        if (ctx.playerVehicle && ctx.heroVehicle && ctx.playerVehicle === ctx.heroVehicle) {
          this.hooks.say(RAY, 'That is the one. Bring her home gentle, kid.', 4);
          this.advance();
        }
        break;
      case 'gotoVehicle':
        if (ctx.playerVehicle && near(s.x, s.z, s.r)) {
          if (s.heroOnly && ctx.playerVehicle !== ctx.heroVehicle) break;
          if (this.missionIdx === 0 && this.stageIdx === 2) this.hooks.say(MARISOL, 'Package received. Now vanish until the stars forget you.', 4.5);
          this.advance();
        }
        break;
      case 'loseHeat':
        if (ctx.wanted === 0) { this.hooks.say(RIO, 'Clean. For now.', 3); this.advance(); }
        break;
      case 'fight': {
        const alive = this.hostiles.filter(h => h.alive);
        if (!alive.length && this.hostiles.length) {
          this.hooks.say(PINA, 'That is all of them. Rio, you beautiful maniac — Cafe Plaza, please.', 4.5);
          this.spawnFollower();
          this.advance();
        }
        break;
      }
      case 'escort': {
        if (this.follower) {
          const f = this.follower, fp = f.P.group.position;
          const d = Math.hypot(px - fp.x, pz - fp.z);
          if (d > 3.2) {
            const sp = ctx.playerVehicle ? 7.4 : 4.6;
            fp.x += (px - fp.x) / d * Math.min(sp * dt, d - 2.4);
            fp.z += (pz - fp.z) / d * Math.min(sp * dt, d - 2.4);
            f.P.group.rotation.y = Math.atan2(px - fp.x, pz - fp.z);
            f.phase += dt * 9;
            const sw = Math.sin(f.phase);
            f.P.armL.sh.rotation.x = sw * 0.5; f.P.armR.sh.rotation.x = -sw * 0.5;
            f.P.legL.hip.rotation.x = -sw * 0.55; f.P.legR.hip.rotation.x = sw * 0.55;
          }
          if (near(s.x, s.z, s.r) && Math.hypot(fp.x - s.x, fp.z - s.z) < s.r + 4) {
            if (this.stageIdx === 3) { this.follower = null; f.P.group.visible = false; }
            this.advance();
          }
        }
        break;
      }
    }
    // hostiles press the player and shoot in bursts
    for (const h of this.hostiles) {
      if (!h.alive) continue;
      const hp = h.P.group.position;
      const d = Math.hypot(px - hp.x, pz - hp.z);
      if (d > 11) {
        hp.x += (px - hp.x) / d * 2.6 * dt; hp.z += (pz - hp.z) / d * 2.6 * dt;
        h.phase += dt * 8;
        const sw = Math.sin(h.phase);
        h.P.legL.hip.rotation.x = -sw * 0.5; h.P.legR.hip.rotation.x = sw * 0.5;
        h.P.armL.sh.rotation.x = sw * 0.4; h.P.armR.sh.rotation.x = -sw * 0.4;
      }
      h.P.group.rotation.y = Math.atan2(px - hp.x, pz - hp.z);
      h.P.armR.sh.rotation.x = -1.3;
      h.shootCd -= dt;
      if (h.shootCd <= 0 && d < 30) {
        h.shootCd = 1.5 + Math.random() * 0.7;
        this.hooks.audio.gunshot(1, true);
        if (Math.random() < 0.42) this.hooks.hurtPlayer(4 + Math.random() * 5);
      }
      if (h.hp <= 0) {
        h.alive = false;
        h.P.group.rotation.x = -Math.PI / 2;
        h.P.group.position.y = 0.2;
        this.hooks.addRespect(3);
      }
    }
  }
}
