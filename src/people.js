// people.js — the citizens of Neon Harbor. A shared-geometry humanoid
// factory (heads with hair, two-tone outfits, uniforms, swimwear) and a
// life system that gives every pedestrian a day: walking with purpose
// between the diner, cafe, market, marina and beach, sitting with coffee,
// fishing off the pier, sunbathing, swimming, queuing for tacos, chatting
// in pairs, hauling crates, jogging the block.
import * as THREE from 'three';
import { AVENUES, STREETS, WALK_LINE, PLACES, cafeTables, marketStalls, beachSpots, marinaWork, collideCircle } from './world.js';
import { rng } from './textures.js';

const SKIN = [0xf2c79b, 0xe0ac7e, 0xc68863, 0x9c6644, 0x7a4b28, 0x5d3a1e];
const HAIR = [0x1c1512, 0x3a2417, 0x6b4423, 0xa9743f, 0xd8c9a3, 0x8a8d90, 0xb03a2e, 0x2e4a8f];
const TOPS = [0xe2483d, 0x4a7ab5, 0xf2ead8, 0x37e08b, 0xffd23e, 0xff5fa2, 0xb46bff, 0xff8a5c, 0x2e8f6e, 0xf2f4f8, 0x37474f, 0xe8a13c];
const BOTS = [0x2b3a4a, 0x5d4a33, 0x8a8d90, 0x243028, 0x704214, 0xd8cfc0, 0x37474f, 0x7a2e3f];

const geoCache = new Map(), matCache = new Map();
function geo(key, make) { if (!geoCache.has(key)) geoCache.set(key, make()); return geoCache.get(key); }
function mat(color, rough = 0.9) {
  const k = color + '/' + rough;
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color, roughness: rough }));
  return matCache.get(k);
}
const box = (w, h, d) => geo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
const sph = (r) => geo(`s${r}`, () => new THREE.SphereGeometry(r, 10, 8));
function limb(w, h, d, color) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(box(w, h, d), mat(color));
  m.position.y = -h / 2; m.castShadow = true; g.add(m);
  return g;
}

// Builds one stylized citizen. opts: {skin, hair, top, bottom, shoes,
// style: 'shirt'|'dress'|'hivis'|'uniform'|'swim', hat: 0 none 1 cap 2 sunhat,
// longHair, prop: 'bag'|'crate'|'phone'|'rod'|null}
export function makePerson(r, opts = {}) {
  const skin = opts.skin ?? SKIN[Math.floor(r() * SKIN.length)];
  const hairC = opts.hair ?? HAIR[Math.floor(r() * HAIR.length)];
  const top = opts.top ?? TOPS[Math.floor(r() * TOPS.length)];
  const bottom = opts.bottom ?? BOTS[Math.floor(r() * BOTS.length)];
  const shoes = opts.shoes ?? (r() < 0.5 ? 0xf2f4f8 : 0x24262a);
  const style = opts.style ?? 'shirt';
  const g = new THREE.Group();
  const P = { group: g };

  const hips = new THREE.Group(); hips.position.y = 0.96; g.add(hips); P.hips = hips;
  const pelvis = new THREE.Mesh(box(0.34, 0.2, 0.2), mat(style === 'swim' ? top : bottom));
  pelvis.castShadow = true; hips.add(pelvis);
  if (style === 'dress') {
    const skirt = new THREE.Mesh(geo('skirt', () => new THREE.CylinderGeometry(0.19, 0.30, 0.42, 10)), mat(top));
    skirt.position.y = -0.16; skirt.castShadow = true; hips.add(skirt);
  }
  const torso = new THREE.Group(); torso.position.y = 0.08; hips.add(torso); P.torso = torso;
  const chest = new THREE.Mesh(box(0.38, 0.52, 0.22), mat(style === 'hivis' ? 0xd8e021 : top));
  chest.position.y = 0.28; chest.castShadow = true; torso.add(chest);
  if (style === 'hivis') {
    const stripe = new THREE.Mesh(box(0.39, 0.07, 0.23), mat(0xb8bec4, 0.35));
    stripe.position.y = 0.3; torso.add(stripe);
  }
  if (style === 'uniform') {
    const badge = new THREE.Mesh(box(0.07, 0.07, 0.02), mat(0xffd23e, 0.3));
    badge.position.set(0.1, 0.36, 0.12); torso.add(badge);
  }
  const neck = new THREE.Mesh(geo('neck', () => new THREE.CylinderGeometry(0.055, 0.06, 0.09, 8)), mat(skin));
  neck.position.y = 0.58; torso.add(neck);
  const headG = new THREE.Group(); headG.position.y = 0.66; torso.add(headG); P.head = headG;
  const head = new THREE.Mesh(sph(0.145), mat(skin));
  head.scale.set(0.92, 1.08, 0.98); head.position.y = 0.08; head.castShadow = true; headG.add(head);
  const hairStyle = opts.hat === 1 ? 'cap' : opts.hat === 2 ? 'sunhat' : (opts.longHair ? 'long' : (r() < 0.72 ? 'short' : 'bald'));
  if (hairStyle === 'short' || hairStyle === 'long') {
    const hair = new THREE.Mesh(sph(0.15), mat(hairC));
    hair.scale.set(0.95, 1.02, 0.98); hair.position.set(0, 0.115, -0.018); headG.add(hair);
    if (hairStyle === 'long') {
      const back = new THREE.Mesh(box(0.24, 0.34, 0.07), mat(hairC));
      back.position.set(0, -0.05, -0.13); headG.add(back);
    }
  } else if (hairStyle === 'cap') {
    const cap = new THREE.Mesh(geo('cap', () => new THREE.CylinderGeometry(0.155, 0.16, 0.09, 10)), mat(opts.capColor ?? top));
    cap.position.y = 0.185; headG.add(cap);
    const brim = new THREE.Mesh(box(0.2, 0.03, 0.14), mat(opts.capColor ?? top));
    brim.position.set(0, 0.15, 0.17); headG.add(brim);
  } else if (hairStyle === 'sunhat') {
    const hat = new THREE.Mesh(geo('sunhat', () => new THREE.CylinderGeometry(0.30, 0.32, 0.05, 12)), mat(0xe8d9a8));
    hat.position.y = 0.19; headG.add(hat);
    const dome = new THREE.Mesh(sph(0.14), mat(0xe8d9a8));
    dome.position.y = 0.2; dome.scale.y = 0.6; headG.add(dome);
  }
  if (r() < 0.3) { // sunglasses
    const shades = new THREE.Mesh(box(0.21, 0.05, 0.03), mat(0x14161c, 0.25));
    shades.position.set(0, 0.09, 0.135); headG.add(shades);
  }
  function arm(side) {
    const sh = new THREE.Group(); sh.position.set(side * 0.245, 0.5, 0); torso.add(sh);
    const upper = limb(0.105, 0.34, 0.115, style === 'swim' ? skin : top); sh.add(upper);
    const fore = new THREE.Group(); fore.position.y = -0.34; upper.add(fore);
    const fm = new THREE.Mesh(box(0.09, 0.32, 0.1), mat(skin)); fm.position.y = -0.16; fm.castShadow = true; fore.add(fm);
    return { sh, fore };
  }
  const aL = arm(-1), aR = arm(1); P.armL = aL; P.armR = aR;
  function leg(side) {
    const hip = new THREE.Group(); hip.position.set(side * 0.1, -0.04, 0); hips.add(hip);
    const thigh = limb(0.14, 0.46, 0.15, style === 'dress' || style === 'swim' ? skin : bottom); hip.add(thigh);
    const shin = new THREE.Group(); shin.position.y = -0.46; thigh.add(shin);
    const sm = new THREE.Mesh(box(0.115, 0.42, 0.125), mat(style === 'swim' ? skin : bottom)); sm.position.y = -0.21; sm.castShadow = true; shin.add(sm);
    const shoe = new THREE.Mesh(box(0.12, 0.07, 0.24), mat(shoes)); shoe.position.set(0, -0.435, 0.05); shin.add(shoe);
    return { hip, shin };
  }
  const lL = leg(-1), lR = leg(1); P.legL = lL; P.legR = lR;
  if (opts.prop === 'bag') {
    const bag = new THREE.Mesh(box(0.16, 0.3, 0.24), mat(BOTS[Math.floor(r() * BOTS.length)]));
    bag.position.set(0, -0.52, 0.1); aR.fore.add(bag);
  }
  if (opts.prop === 'phone') {
    const ph = new THREE.Mesh(box(0.07, 0.12, 0.015), mat(0x14161c, 0.3));
    ph.position.set(0, -0.34, 0.1); aR.fore.add(ph);
  }
  if (opts.prop === 'rod') {
    const rod = new THREE.Mesh(geo('rod', () => new THREE.CylinderGeometry(0.012, 0.02, 2.4, 5)), mat(0x37474f, 0.5));
    rod.position.set(0, -0.3, 0.7); rod.rotation.x = 1.1; aR.fore.add(rod);
    P.rod = rod;
  }
  if (opts.prop === 'crate') {
    const crate = new THREE.Mesh(box(0.52, 0.4, 0.52), mat(0x9a7a4e));
    crate.position.set(0, 0.42, 0.42); torso.add(crate);
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return P;
}

function pose(P, name) {
  const { armL: L, armR: R, legL: LL, legR: LR } = P;
  L.sh.rotation.set(0, 0, 0.06); R.sh.rotation.set(0, 0, -0.06);
  L.fore.rotation.x = R.fore.rotation.x = -0.12;
  LL.hip.rotation.x = LR.hip.rotation.x = 0; LL.shin.rotation.x = LR.shin.rotation.x = 0;
  P.hips.position.y = 0.96; P.group.rotation.x = 0;
  if (name === 'sit') {
    LL.hip.rotation.x = LR.hip.rotation.x = -1.5;
    LL.shin.rotation.x = LR.shin.rotation.x = 1.45;
    P.hips.position.y = 0.52;
  } else if (name === 'lie') {
    P.group.rotation.x = -Math.PI / 2 + 0.06; P.hips.position.y = 0.96;
    L.sh.rotation.z = 0.9; R.sh.rotation.z = -0.4;
  } else if (name === 'fish') {
    R.sh.rotation.x = -0.7; R.fore.rotation.x = -0.35; L.sh.rotation.x = -0.3;
  } else if (name === 'phone') {
    R.sh.rotation.x = -0.5; R.fore.rotation.x = -1.9;
  } else if (name === 'carry') {
    L.sh.rotation.x = -0.95; R.sh.rotation.x = -0.95; L.fore.rotation.x = R.fore.rotation.x = -0.5;
  } else if (name === 'queue') {
    L.fore.rotation.x = R.fore.rotation.x = -0.4;
  }
}

// Sidewalk graph: nodes where an avenue's walk line crosses a street's.
function nearestLine(v, lines) { let best = lines[0], bd = 1e9; for (const l of lines) { const d = Math.abs(v - l); if (d < bd) { bd = d; best = l; } } return best; }
export function sidewalkRoute(from, to) {
  const xs = AVENUES.flatMap(a => [a - WALK_LINE, a + WALK_LINE]);
  const zs = STREETS.flatMap(s => [s - WALK_LINE, s + WALK_LINE]);
  const x1 = nearestLine(from.x, xs), z1 = nearestLine(from.z, zs);
  const x2 = nearestLine(to.x, xs), z2 = nearestLine(to.z, zs);
  const pts = [{ x: x1, z: from.z }, { x: x1, z: z2 }];
  if (Math.abs(x2 - x1) > 0.1) pts.push({ x: x2, z: z2 });
  pts.push({ x: to.x, z: to.z });
  return pts.filter((p, i) => i === 0 || Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z) > 0.6);
}

const POIS = [
  { x: PLACES.diner.x - 6, z: PLACES.diner.z + 6 }, { x: PLACES.cafe.x, z: PLACES.cafe.z - 8 },
  { x: PLACES.market.x, z: 52 }, { x: PLACES.foodtruck.x + 4, z: PLACES.foodtruck.z },
  { x: PLACES.marina.x, z: 128 }, { x: PLACES.beach.x, z: 120 },
  { x: PLACES.hotel.x + 16, z: PLACES.hotel.z + 10 }, { x: 8, z: -8 }, { x: -68, z: -68 },
  { x: 68, z: 68 }, { x: -8, z: 100 }, { x: 128, z: 8 },
];
export class PeopleSystem {
  constructor(scene) {
    this.r = rng(2024);
    this.peds = [];
    this.scene = scene;
    const r = this.r;
    const spawn = (P, x, z, role, data = {}) => {
      P.group.position.set(x, 0, z);
      P.group.rotation.y = r() * 6.28;
      scene.add(P.group);
      const ped = { P, role, x, z, route: [], ri: 0, speed: 1.15 + r() * 0.55, phase: r() * 6.28, timer: r() * 4, state: 'idle', flee: 0, ...data };
      this.peds.push(ped); return ped;
    };
    // purposeful walkers — the city's bloodstream
    for (let i = 0; i < 52; i++) {
      const poi = POIS[Math.floor(r() * POIS.length)];
      const prop = r() < 0.24 ? 'bag' : r() < 0.14 ? 'phone' : null;
      const P = makePerson(r, { prop, hat: r() < 0.2 ? 1 : 0, longHair: r() < 0.4 });
      const ped = spawn(P, poi.x + (r() - 0.5) * 8, poi.z + (r() - 0.5) * 8, 'walker');
      if (prop === 'phone') pose(P, 'phone'), ped.phonePose = true;
      this.giveRoute(ped, POIS[Math.floor(r() * POIS.length)]);
    }
    // cafe sitters with coffee
    for (const t of cafeTables) {
      if (r() < 0.28) continue;
      const P = makePerson(r, { hat: r() < 0.3 ? 2 : 0, longHair: r() < 0.5 });
      const ped = spawn(P, t.x + 0.95, t.z + 0.3, 'sitter');
      P.group.rotation.y = Math.atan2(t.x - P.group.position.x, t.z - P.group.position.z);
      pose(P, 'sit');
    }
    // market browsers drifting stall to stall
    for (let i = 0; i < 7 && i < marketStalls.length; i++) {
      const s = marketStalls[i];
      const P = makePerson(r, { prop: r() < 0.5 ? 'bag' : null });
      spawn(P, s.x + (r() - 0.5) * 2, s.z, 'browser', { stall: i, faceZ: s.z > 52 ? 1 : -1 });
    }
    // fishers on the pier
    for (let i = 0; i < 3; i++) {
      const P = makePerson(r, { prop: 'rod', hat: 1, capColor: 0xe2483d });
      const side = i % 2 ? 1 : -1;
      const ped = spawn(P, PLACES.pier.x + side * 3.6, 158 + i * 12, 'fisher');
      P.group.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
      pose(P, 'fish');
    }
    // beach life: sunbathers on towels, swimmers in the shallows
    for (const s of beachSpots) {
      if (s.towel && r() < 0.62) {
        const P = makePerson(r, { style: 'swim', hat: 2 });
        const ped = spawn(P, s.x, s.z, 'sunbather');
        P.group.position.y = 0.14; pose(P, 'lie');
      } else if (s.swim && r() < 0.5) {
        const P = makePerson(r, { style: 'swim' });
        const ped = spawn(P, s.x + 6, 152 + r() * 7, 'swimmer');
        P.group.position.y = -0.95;
      }
    }
    // taco queue
    for (let i = 0; i < 4; i++) {
      const P = makePerson(r, {});
      const ped = spawn(P, PLACES.foodtruck.x + 2.5, PLACES.foodtruck.z - 3 - i * 1.05, 'queue', { qi: i });
      P.group.rotation.y = Math.PI; pose(P, 'queue');
    }
    // chatting pairs
    for (let i = 0; i < 3; i++) {
      const c = POIS[1 + i * 3];
      for (const s of [-1, 1]) {
        const P = makePerson(r, { longHair: s > 0 && r() < 0.6 });
        const ped = spawn(P, c.x + s * 0.75, c.z + (r() - 0.5) * 2, 'chatter', { pair: i });
        P.group.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2;
      }
    }
    // marina workers hauling crates
    for (let i = 0; i < 4; i++) {
      const P = makePerson(r, { style: 'hivis', prop: 'crate', hat: 1, capColor: 0xffd23e });
      const ped = spawn(P, marinaWork[i % 2].x, marinaWork[i % 2].z, 'worker', { dest: 1 - (i % 2) });
      pose(P, 'carry');
    }
    // the jogger, forever circling the block
    const jog = makePerson(r, { top: 0xff5fa2, bottom: 0x24262a, hat: 1, capColor: 0xff5fa2 });
    spawn(jog, -52, -52, 'jogger', { speed: 3.4, corner: 0 });
    this.count = this.peds.length;
  }
  giveRoute(ped, dest) {
    ped.route = sidewalkRoute({ x: ped.x, z: ped.z }, dest);
    ped.ri = 0; ped.state = 'walk';
  }
  triggerFlee(x, z, radius = 16) {
    for (const ped of this.peds) {
      if (ped.role !== 'walker' && ped.role !== 'browser' && ped.role !== 'queue') continue;
      const d = Math.hypot(ped.x - x, ped.z - z);
      if (d < radius) { ped.flee = 2.6; ped.fleeFrom = { x, z }; ped.state = 'flee'; }
    }
  }
  update(dt, t) {
    const r = this.r;
    for (const ped of this.peds) {
      const P = ped.P, g = P.group;
      if (ped.state === 'down' || ped.state === 'gone') continue;   // casualties and drivers stay put
      ped.timer -= dt;
      let moving = 0;
      if (ped.state === 'flee') {
        ped.flee -= dt;
        const dx = ped.x - ped.fleeFrom.x, dz = ped.z - ped.fleeFrom.z, d = Math.hypot(dx, dz) || 1;
        this.step(ped, ped.x + dx / d * 6, ped.z + dz / d * 6, dt, 2.6); moving = 1;
        if (ped.flee <= 0) { ped.state = 'idle'; ped.timer = 0.5; }
      } else if (ped.role === 'walker' || ped.role === 'worker') {
        if (ped.state === 'walk' && ped.route.length) {
          const target = ped.route[Math.min(ped.ri, ped.route.length - 1)];
          const arrived = this.step(ped, target.x, target.z, dt, ped.speed); moving = 1;
          if (arrived) {
            ped.ri++;
            if (ped.ri >= ped.route.length) {
              ped.state = 'idle'; ped.timer = 1.5 + r() * 5;
              if (ped.role === 'worker') { ped.dest = 1 - ped.dest; this.giveRoute(ped, marinaWork[ped.dest]); pose(P, 'carry'); }
            }
          }
        } else if (ped.timer <= 0) {
          this.giveRoute(ped, ped.role === 'worker' ? marinaWork[ped.dest] : POIS[Math.floor(r() * POIS.length)]);
        }
      } else if (ped.role === 'browser') {
        if (ped.timer <= 0) {
          ped.stall = Math.floor(r() * marketStalls.length);
          const s = marketStalls[ped.stall];
          this.step(ped, s.x + (r() - 0.5) * 2, s.z, dt, ped.speed);
          ped.timer = 4 + r() * 6;
        }
        g.rotation.y += Math.sin(t * 0.6 + ped.phase) * 0.0016;
      } else if (ped.role === 'jogger') {
        const corners = [[-52, -52], [52, -52], [52, 52], [-52, 52]];
        const c = corners[ped.corner];
        if (this.step(ped, c[0], c[1], dt, ped.speed)) ped.corner = (ped.corner + 1) % 4;
        moving = 1;
      } else if (ped.role === 'swimmer') {
        g.position.y = -0.95 + Math.sin(t * 1.4 + ped.phase) * 0.09;
        P.armL.sh.rotation.z = Math.sin(t * 2.2 + ped.phase) * 0.9 + 1.2;
        P.armR.sh.rotation.z = -Math.sin(t * 2.2 + ped.phase) * 0.9 - 1.2;
      } else if (ped.role === 'sitter') {
        if (r() < dt * 0.14) P.armR.fore.rotation.x = -1.7;         // lifts the cup
        else P.armR.fore.rotation.x *= 0.96;
        P.head.rotation.y = Math.sin(t * 0.3 + ped.phase) * 0.3;
      } else if (ped.role === 'chatter') {
        const wave = Math.sin(t * 2.4 + ped.phase);
        P.armR.sh.rotation.x = -0.4 + wave * 0.28;
        P.armR.fore.rotation.x = -0.5 + Math.cos(t * 3.1 + ped.phase) * 0.3;
        P.head.rotation.z = Math.sin(t * 0.9 + ped.phase) * 0.05;
      } else if (ped.role === 'fisher') {
        P.armR.sh.rotation.x = -0.7 + Math.sin(t * 0.8 + ped.phase) * 0.05;
        g.rotation.z = Math.sin(t * 0.5 + ped.phase) * 0.012;
      } else if (ped.role === 'queue') {
        if (ped.timer <= 0) { ped.timer = 5 + r() * 5; ped.z += 0.28; g.position.z = ped.z; }
      }
      // walk-cycle animation for anyone moving
      if (moving) {
        ped.phase += dt * (ped.state === 'flee' ? 13 : 7.2) * (ped.speed / 1.4);
        const s = Math.sin(ped.phase), amp = ped.state === 'flee' ? 0.75 : 0.52;
        if (!ped.phonePose) { P.armL.sh.rotation.x = s * amp * 0.8; P.armR.sh.rotation.x = -s * amp * 0.8; }
        else { P.armL.sh.rotation.x = s * amp * 0.8; }
        P.legL.hip.rotation.x = -s * amp; P.legR.hip.rotation.x = s * amp;
        P.legL.shin.rotation.x = Math.max(0, -s) * 0.7; P.legR.shin.rotation.x = Math.max(0, s) * 0.7;
        P.hips.position.y = 0.96 + Math.abs(Math.cos(ped.phase)) * 0.045;
        P.torso.rotation.z = s * 0.03;
      } else if (ped.role === 'walker' || ped.role === 'worker' || ped.role === 'jogger') {
        P.armL.sh.rotation.x *= 0.85; P.armR.sh.rotation.x *= ped.phonePose ? 1 : 0.85;
        P.legL.hip.rotation.x *= 0.85; P.legR.hip.rotation.x *= 0.85;
        P.legL.shin.rotation.x *= 0.85; P.legR.shin.rotation.x *= 0.85;
      }
      g.position.x = ped.x; g.position.z = ped.z;
      if (ped.role !== 'sunbather' && ped.role !== 'swimmer') g.position.y = 0;
    }
  }
  // Moves a ped toward a point, turning smoothly; returns true on arrival.
  step(ped, tx, tz, dt, speed) {
    const dx = tx - ped.x, dz = tz - ped.z, d = Math.hypot(dx, dz);
    if (d < 0.45) return true;
    const vx = dx / d * speed * dt, vz = dz / d * speed * dt;
    ped.x += vx; ped.z += vz;
    const p = { x: ped.x, z: ped.z };
    collideCircle(p, 0.42);
    ped.x = p.x; ped.z = p.z;
    const targetRot = Math.atan2(dx, dz);
    let diff = targetRot - ped.P.group.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    ped.P.group.rotation.y += diff * Math.min(1, dt * 8);
    return false;
  }
}
