// world.js — Neon Harbor itself: a sun-soaked grid of avenues and streets
// between a working marina and a beach. Builds the ground, roads with
// markings, buildings with lit facades, shops with awnings and neon signs,
// palms, street furniture, the cafe plaza, the market, the pier and boats —
// and the golden-hour light that grades it all.
import * as THREE from 'three';
import { asphaltTexture, sidewalkTexture, grassTexture, sandTexture, facadeTexture, awningTexture, signTexture, skyTexture, glowTexture, rng } from './textures.js';

export const WORLD = { minX: -176, maxX: 176, minZ: -176, waterZ: 146 };
export const AVENUES = [-120, -60, 0, 60, 120];       // north–south roads (x)
export const STREETS = [-120, -60, 0, 60, 108];       // east–west roads (z); 108 is the coast road
export const ROAD_HALF = 6, WALK_LINE = 7.9;          // lane + sidewalk offsets
export const PLACES = {
  diner:     { x: 88,  z: 96,  name: 'Seaside Diner' },
  cafe:      { x: 30,  z: 94,  name: 'Cafe Plaza' },
  market:    { x: -72, z: 52,  name: 'Harbor Market' },
  foodtruck: { x: -24, z: 68,  name: 'Taco Truck' },
  marina:    { x: -52, z: 138, name: 'Neon Marina' },
  pier:      { x: -52, z: 168, name: 'The Pier' },
  beach:     { x: 60,  z: 128, name: 'Coral Beach' },
  warehouse: { x: -132, z: -102, name: 'Harbor Freight Depot' },
  chopshop:  { x: 134, z: -108, name: "Ray's Customs" },
  hotel:     { x: -96, z: -30, name: 'Hotel Miramar' },
};
export const colliders = [];   // {minX,maxX,minZ,maxZ} boxes the player and cars cannot enter
export const cafeTables = [];  // {x,z} cafe tables pedestrians sit at
export const marketStalls = []; // {x,z} spots in front of market stalls
export const beachSpots = [];  // {x,z,towel|swim} beach activity spots
export const marinaWork = [];  // {x,z} crate-hauling endpoints for workers
export const boats = [];       // moored boats that bob on the water   // {minX,maxX,minZ,maxZ} boxes the player and cars cannot enter
function addCollider(x, z, w, d) { colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 }); }
export function collideCircle(p, radius) {
  for (const c of colliders) {
    const nx = Math.max(c.minX, Math.min(p.x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(p.z, c.maxZ));
    const dx = p.x - nx, dz = p.z - nz, d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 0.0001) { const d = Math.sqrt(d2); p.x = nx + dx / d * radius; p.z = nz + dz / d * radius; }
      else { p.x = c.maxX + radius; }
    }
  }
  p.x = Math.max(WORLD.minX, Math.min(WORLD.maxX, p.x));
  p.z = Math.max(WORLD.minZ, Math.min(WORLD.waterZ + 26, p.z));
}

let sunLight = null, waterMat = null;
const std = (opts) => new THREE.MeshStandardMaterial(opts);

export function buildWorld(scene) {
  buildSkyAndLights(scene);
  buildGroundAndRoads(scene);
  buildBlocks(scene);
  buildLandmarks(scene);
  buildBeachAndMarina(scene);
  buildSkyline(scene);
}

function buildSkyAndLights(scene) {
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1150, 28, 18),
    new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false }),
  );
  scene.add(sky);
  const sunCore = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('#fff3cf'), color: 0xfff0bd, fog: false, depthWrite: false }));
  sunCore.position.set(-860, 265, -460); sunCore.scale.setScalar(300); scene.add(sunCore);
  const sunHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('#ff9a52'), color: 0xffb36b, fog: false, depthWrite: false, opacity: 0.55 }));
  sunHalo.position.copy(sunCore.position); sunHalo.scale.setScalar(760); scene.add(sunHalo);

  scene.add(new THREE.HemisphereLight(0xffe2b8, 0x46607e, 0.95));
  sunLight = new THREE.DirectionalLight(0xffbe78, 2.35);
  sunLight.position.set(-190, 205, -130);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = -135; sunLight.shadow.camera.right = 135;
  sunLight.shadow.camera.top = 135; sunLight.shadow.camera.bottom = -135;
  sunLight.shadow.camera.far = 760; sunLight.shadow.bias = -0.0006;
  scene.add(sunLight); scene.add(sunLight.target);
  scene.fog = new THREE.Fog(0xf2a56b, 165, 980);
}
export function followSun(x, z) {
  if (!sunLight) return;
  sunLight.position.set(x - 190, 205, z - 130);
  sunLight.target.position.set(x, 0, z);
}
export function setShadowQuality(high) {
  if (sunLight) sunLight.shadow.mapSize.set(high ? 2048 : 1024, high ? 2048 : 1024);
  if (sunLight && sunLight.shadow.map) { sunLight.shadow.map.dispose(); sunLight.shadow.map = null; }
}

function buildGroundAndRoads(scene) {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.maxX - WORLD.minX + 300, WORLD.waterZ - WORLD.minZ + 60),
    std({ map: grassTexture(), roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.02, (WORLD.minZ + WORLD.waterZ) / 2);
  ground.receiveShadow = true;
  scene.add(ground);

  const asphalt = std({ map: asphaltTexture(), roughness: 0.94 });
  const walkMat = std({ map: sidewalkTexture(), roughness: 1 });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5e9c8 });
  const edgeMat = new THREE.MeshBasicMaterial({ color: 0xd8d8d8 });
  const crossMat = new THREE.MeshBasicMaterial({ color: 0xe8e8e4 });

  const road = (x, z, w, d) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), asphalt);
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.0, z); m.receiveShadow = true; scene.add(m);
  };
  const walk = (x, z, w, d) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.14, d), walkMat);
    m.position.set(x, 0.07, z); m.receiveShadow = true; scene.add(m);
  };
  const dash = (x, z, w, d) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), dashMat);
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.02, z); scene.add(m);
  };

  for (const x of AVENUES) {           // north–south avenues
    road(x, -24, ROAD_HALF * 2, 316);
    walk(x - WALK_LINE - 0.6, -24, 3.4, 316); walk(x + WALK_LINE + 0.6, -24, 3.4, 316);
    for (let z = -168; z < 128; z += 12) if (!STREETS.some(s => Math.abs(z - s) < 9)) dash(x, z, 0.28, 5);
    for (const s of STREETS) {          // zebra crossings on all four arms
      for (let i = -2; i <= 2; i++) {
        const a = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 4.6), crossMat);
        a.rotation.x = -Math.PI / 2; a.position.set(x + i * 2.2, 0.02, s - ROAD_HALF - 3.4); scene.add(a);
        const b = a.clone(); b.position.z = s + ROAD_HALF + 3.4; scene.add(b);
      }
    }
  }
  for (const z of STREETS) {           // east–west streets
    road(0, z, 352, ROAD_HALF * 2);
    walk(0, z - WALK_LINE - 0.6, 352, 3.4); walk(0, z + WALK_LINE + 0.6, 352, 3.4);
    for (let x = -168; x < 176; x += 12) if (!AVENUES.some(a => Math.abs(x - a) < 9)) dash(x, z, 5, 0.28);
    for (const a of AVENUES) {
      for (let i = -2; i <= 2; i++) {
        const s1 = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.1), crossMat);
        s1.rotation.x = -Math.PI / 2; s1.position.set(a - ROAD_HALF - 3.4, 0.02, z + i * 2.2); scene.add(s1);
        const s2 = s1.clone(); s2.position.x = a + ROAD_HALF + 3.4; scene.add(s2);
      }
    }
    void edgeMat;
  }
}

const FACADE_BASES = ['#c9a184', '#b7c3c9', '#d9c9a8', '#a8b8a2', '#c48f7d', '#9fb4c8', '#e0d3b8', '#b09a86'];
const SHOP_SIGNS = [
  ['PALM LIQUOR', '#4be1ff'], ['NOODLE BAR', '#ff5fa2'], ['SURF SHACK', '#ffd23e'], ['LAUNDRY', '#9fd8e8'],
  ['PAWN & GOLD', '#ffb36b'], ['CAFE SOL', '#ff8a5c'], ['TATTOO', '#b46bff'], ['MINI MART', '#37e08b'],
  ['GYM 24H', '#ff7a6b'], ['BOOKS', '#e8f2f8'], ['PHARMACY', '#7be0a3'], ['BARBER', '#f2f4f8'],
];
let signIdx = 0;

function buildBlocks(scene) {
  const r = rng(1234);
  const roofMat = std({ color: 0x6b6259, roughness: 1 });
  const xEdges = [-168, ...AVENUES.flatMap(a => [a - 10, a + 10]), 168];
  const zEdges = [-168, ...STREETS.slice(0, 4).flatMap(s => [s - 10, s + 10]), 92];
  for (let i = 0; i < xEdges.length; i += 2) for (let j = 0; j < zEdges.length; j += 2) {
    const cx = (xEdges[i] + xEdges[i + 1]) / 2, cz = (zEdges[j] + zEdges[j + 1]) / 2;
    const bw = xEdges[i + 1] - xEdges[i] - 4, bd = zEdges[j + 1] - zEdges[j] - 4;
    if (Math.abs(cx - PLACES.cafe.x) < 26 && Math.abs(cz - PLACES.cafe.z) < 20) continue;   // cafe plaza stays open
    if (Math.abs(cx - PLACES.market.x) < 30 && Math.abs(cz - 60) < 16) continue;           // market stays open
    const nearCoast = cz > 40;
    const floors = nearCoast ? 2 + Math.floor(r() * 3) : 3 + Math.floor(r() * 7);
    const h = floors * 3.1;
    const base = FACADE_BASES[Math.floor(r() * FACADE_BASES.length)];
    const facade = facadeTexture(1000 + i * 37 + j * 91, base, floors, 5);
    const sideMat = std({ map: facade, roughness: 0.9 });
    const b = new THREE.Mesh(new THREE.BoxGeometry(bw, h, bd), [sideMat, sideMat, roofMat, roofMat, sideMat, sideMat]);
    b.position.set(cx, h / 2, cz);
    b.castShadow = true; b.receiveShadow = true;
    scene.add(b);
    addCollider(cx, cz, bw, bd);
    // rooftop clutter: AC boxes, a water tank on taller blocks
    const acCount = 1 + Math.floor(r() * 3);
    for (let k = 0; k < acCount; k++) {
      const ac = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 1.2), std({ color: 0x9aa2a8, roughness: 0.7, metalness: 0.4 }));
      ac.position.set(cx + (r() - 0.5) * (bw - 4), h + 0.45, cz + (r() - 0.5) * (bd - 4));
      ac.castShadow = true; scene.add(ac);
    }
    if (floors >= 6 && r() < 0.6) {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 2.6, 10), std({ color: 0x7a5c40, roughness: 1 }));
      tank.position.set(cx + (r() - 0.5) * bw * 0.5, h + 1.3, cz + (r() - 0.5) * bd * 0.5);
      tank.castShadow = true; scene.add(tank);
    }
    // ground-floor shopfront on street-facing sides of some blocks
    if (r() < 0.55) addShopfront(scene, cx, cz, bw, bd, r);
  }
}

function addShopfront(scene, cx, cz, bw, bd, r) {
  const [text, color] = SHOP_SIGNS[signIdx++ % SHOP_SIGNS.length];
  const south = r() < 0.5;
  const z = cz + (south ? bd / 2 : -bd / 2) + (south ? 0.35 : -0.35);
  const rotY = south ? 0 : Math.PI;
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(Math.min(11, bw * 0.7), 2.2),
    new THREE.MeshBasicMaterial({ map: signTexture(text, color, '#14100e') }),
  );
  sign.position.set(cx, 4.6, z); sign.rotation.y = rotY; scene.add(sign);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(color), color, transparent: true, opacity: 0.35, depthWrite: false }));
  halo.position.set(cx, 4.6, z + (south ? 0.5 : -0.5)); halo.scale.set(13, 3.4, 1); scene.add(halo);
  const awn = new THREE.Mesh(
    new THREE.BoxGeometry(Math.min(12, bw * 0.76), 0.16, 2.6),
    std({ map: awningTexture(color, '#f2ead8'), roughness: 0.9 }),
  );
  awn.position.set(cx, 3.4, z + (south ? 1.1 : -1.1)); awn.rotation.x = south ? 0.22 : -0.22;
  awn.castShadow = true; scene.add(awn);
}

// Palms: a leaning trunk of stacked segments and 8 fronds. Exported so the
// beach and plaza can plant their own.
export function makePalm(r) {
  const g = new THREE.Group();
  const trunkMat = std({ color: 0x8a6a48, roughness: 1 });
  let x = 0, y = 0; const lean = (r() - 0.5) * 0.24;
  for (let i = 0; i < 5; i++) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.22 - i * 0.02, 0.26 - i * 0.02, 1.15, 7), trunkMat);
    x += lean * i * 0.4; y += 1.05;
    seg.position.set(x, y, 0); seg.rotation.z = -lean; seg.castShadow = true; g.add(seg);
  }
  const frondMat = std({ color: 0x3f7d33, roughness: 1, side: THREE.DoubleSide });
  for (let i = 0; i < 8; i++) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.55, 3.6, 4), frondMat);
    const a = (i / 8) * Math.PI * 2;
    f.position.set(x + Math.cos(a) * 1.1, y + 0.75, Math.sin(a) * 1.1);
    f.rotation.set(Math.sin(a) * 1.15, 0, -Math.cos(a) * 1.15);
    f.scale.set(1, 1, 0.24); f.castShadow = true; g.add(f);
  }
  const nutMat = std({ color: 0x6b4e2a, roughness: 1 });
  for (let i = 0; i < 3; i++) {
    const nut = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), nutMat);
    nut.position.set(x + (r() - 0.5) * 0.5, y + 0.25, (r() - 0.5) * 0.5); g.add(nut);
  }
  return g;
}

function buildLandmarks(scene) {
  const r = rng(555);
  // streetlights and palms along the coast road and avenues
  const poleMat = std({ color: 0x3c4248, roughness: 0.6, metalness: 0.6 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe2a8 });
  for (let x = -160; x <= 160; x += 32) {
    for (const side of [-1, 1]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 5.6, 6), poleMat);
      pole.position.set(x, 2.8, 108 + side * 8.6); pole.castShadow = true; scene.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), lampMat);
      lamp.position.set(x, 5.7, 108 + side * 8.6); scene.add(lamp);
    }
    const palm = makePalm(r); palm.position.set(x + 14, 0, 118); palm.rotation.y = r() * 6.28; scene.add(palm);
  }
  for (const a of AVENUES) for (let z = -150; z <= 90; z += 44) {
    const palm = makePalm(r); palm.position.set(a + 10.6, 0, z + 12); palm.rotation.y = r() * 6.28; scene.add(palm);
  }
  // --- Seaside Diner: low slab, huge sign, parking forecourt ---
  const diner = PLACES.diner;
  const dinerMat = std({ map: facadeTexture(42, '#e8ddc8', 1, 8), roughness: 0.85 });
  const db = new THREE.Mesh(new THREE.BoxGeometry(24, 4.6, 12), dinerMat);
  db.position.set(diner.x, 2.3, diner.z - 4); db.castShadow = true; db.receiveShadow = true; scene.add(db);
  addCollider(diner.x, diner.z - 4, 24, 12);
  const dsign = new THREE.Mesh(new THREE.PlaneGeometry(17, 3.6), new THREE.MeshBasicMaterial({ map: signTexture('SEASIDE DINER', '#ffd23e', '#231612') }));
  dsign.position.set(diner.x, 6.4, diner.z + 2.2); scene.add(dsign);
  const dhalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('#ffd23e'), color: 0xffd23e, transparent: true, opacity: 0.3, depthWrite: false }));
  dhalo.position.set(diner.x, 6.4, diner.z + 2.8); dhalo.scale.set(20, 5, 1); scene.add(dhalo);
  // --- Cafe Plaza: paved square, tables, umbrellas, planters ---
  const cafe = PLACES.cafe;
  const plaza = new THREE.Mesh(new THREE.PlaneGeometry(34, 22), std({ map: sidewalkTexture(), roughness: 1 }));
  plaza.rotation.x = -Math.PI / 2; plaza.position.set(cafe.x, 0.03, cafe.z); plaza.receiveShadow = true; scene.add(plaza);
  const tableMat = std({ color: 0xf0ead8, roughness: 0.6 });
  const umbMats = [0xff5fa2, 0x4be1ff, 0xffd23e, 0xff8a5c].map(c => std({ color: c, roughness: 0.8 }));
  cafeTables.length = 0;
  for (let i = 0; i < 6; i++) {
    const tx = cafe.x - 12 + (i % 3) * 12, tz = cafe.z - 5 + Math.floor(i / 3) * 10;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.3, 6), tableMat);
    pole.position.set(tx, 1.15, tz); scene.add(pole);
    const top = new THREE.Mesh(new THREE.ConeGeometry(1.9, 0.7, 10), umbMats[i % 4]);
    top.position.set(tx, 2.5, tz); top.castShadow = true; scene.add(top);
    const table = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.07, 12), tableMat);
    table.position.set(tx, 0.95, tz); scene.add(table);
    cafeTables.push({ x: tx, z: tz });
  }
  // --- Harbor Market: stalls with striped awnings and crates ---
  const stallCols = [['#e2483d', '#f2ead8'], ['#2e8f6e', '#f2ead8'], ['#e8a13c', '#7a4a21'], ['#4a7ab5', '#f2ead8']];
  marketStalls.length = 0;
  for (let i = 0; i < 7; i++) {
    const sx = PLACES.market.x - 36 + i * 12, sz = (i % 2 ? 46 : 58);
    const stall = new THREE.Group();
    const counter = new THREE.Mesh(new THREE.BoxGeometry(5.4, 1.1, 2.4), std({ color: 0x8a6a48, roughness: 1 }));
    counter.position.y = 0.55; counter.castShadow = true; stall.add(counter);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.14, 3.4), std({ map: awningTexture(stallCols[i % 4][0], stallCols[i % 4][1]), roughness: 0.9 }));
    roof.position.set(0, 2.6, 0); roof.rotation.x = 0.16; roof.castShadow = true; stall.add(roof);
    for (const px of [-2.8, 2.8]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6), std({ color: 0x6b4e2a }));
      post.position.set(px, 1.3, 1.2); stall.add(post);
    }
    for (let k = 0; k < 4; k++) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.55, 0.8), std({ color: [0xe8a13c, 0x7ab54a, 0xe2483d, 0xf2ead8][k], roughness: 1 }));
      crate.position.set(-1.8 + k * 1.2, 1.38, 0); crate.castShadow = true; stall.add(crate);
    }
    stall.position.set(sx, 0, sz); stall.rotation.y = sz > 52 ? Math.PI : 0;
    scene.add(stall);
    addCollider(sx, sz, 5.6, 2.6);
    marketStalls.push({ x: sx, z: sz + (sz > 52 ? -2.6 : 2.6) });
  }
  // --- Ray's Customs (chop shop) and the Harbor Freight depot ---
  landmarkBlock(scene, PLACES.chopshop, 22, 9, 14, "RAY'S CUSTOMS", '#ff8a5c', '#3a3f45');
  landmarkBlock(scene, PLACES.warehouse, 30, 11, 18, 'HARBOR FREIGHT', '#9fd8e8', '#5d6670');
  landmarkBlock(scene, PLACES.hotel, 26, 22, 16, 'HOTEL MIRAMAR', '#ff5fa2', '#c9b8a8');
}

function landmarkBlock(scene, place, w, h, d, sign, color, base) {
  const mat = std({ map: facadeTexture(place.x * 3 + 7, base, Math.max(2, Math.round(h / 3.1)), 6), roughness: 0.9 });
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  b.position.set(place.x, h / 2, place.z); b.castShadow = true; b.receiveShadow = true; scene.add(b);
  addCollider(place.x, place.z, w, d);
  const s = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(18, w * 0.8), 3), new THREE.MeshBasicMaterial({ map: signTexture(sign, color, '#14100e') }));
  s.position.set(place.x, h - 1.2, place.z + d / 2 + 0.4); scene.add(s);
}

function buildBeachAndMarina(scene) {
  const r = rng(88);
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(560, 34), std({ map: sandTexture(), roughness: 1 }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.01, 131); sand.receiveShadow = true; scene.add(sand);
  // water with an animated sun-glitter path
  waterMat = new THREE.ShaderMaterial({
    transparent: true, fog: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv; varying vec3 vPos; void main(){ vUv=uv; vec4 wp=modelMatrix*vec4(position,1.0); vPos=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp; }`,
    fragmentShader: `varying vec2 vUv; varying vec3 vPos; uniform float uTime;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      void main(){
        vec3 deep=vec3(0.04,0.20,0.40); vec3 lift=vec3(0.12,0.41,0.62);
        float w = sin(vPos.x*0.11 + uTime*0.9) * sin(vPos.z*0.13 - uTime*0.7);
        vec3 col = mix(deep, lift, 0.5 + 0.5*w);
        float glit = step(0.965, hash(floor(vPos.xz*2.4) + floor(uTime*3.0)));
        float path = smoothstep(60.0, 0.0, abs(vPos.x + 120.0 + sin(vPos.z*0.05)*18.0));
        col += vec3(1.0, 0.62, 0.3) * glit * (0.25 + path*0.9);
        gl_FragColor = vec4(col, 0.93);
      }`,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1100, 420), waterMat);
  water.rotation.x = -Math.PI / 2; water.position.set(0, -0.25, WORLD.waterZ + 210); scene.add(water);
  // pier: deck planks out to the fishing end, posts, moored boats
  const deckMat = std({ color: 0x8a6a48, roughness: 1 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(10, 0.5, 52), deckMat);
  deck.position.set(PLACES.pier.x, 0.55, PLACES.pier.z); deck.castShadow = true; deck.receiveShadow = true; scene.add(deck);
  addCollider(PLACES.pier.x - 8, PLACES.pier.z, 2, 52); addCollider(PLACES.pier.x + 8, PLACES.pier.z, 2, 52);
  const hullCols = [0xe2483d, 0xf2f4f8, 0x4a7ab5, 0xffd23e, 0x2e8f6e, 0xf2f4f8];
  for (let i = 0; i < 6; i++) {
    const bx = PLACES.pier.x + (i % 2 ? 10 : -10), bz = 152 + Math.floor(i / 2) * 15;
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.1, 7.5), std({ color: hullCols[i], roughness: 0.55 }));
    hull.position.y = 0.35; hull.castShadow = true; boat.add(hull);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 2.6), std({ color: 0xf2f4f8, roughness: 0.5 }));
    cabin.position.set(0, 1.3, -0.6); cabin.castShadow = true; boat.add(cabin);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 5.4, 6), deckMat);
    mast.position.set(0, 3.4, 1.4); boat.add(mast);
    boat.position.set(bx, 0, bz); boat.rotation.y = (i % 2 ? -0.1 : 0.12);
    scene.add(boat);
    boat.userData.bobPhase = i * 1.3;
    boats.push(boat);
  }
  // beach umbrellas, towels, a lifeguard stand
  const umbCols = [0xff5fa2, 0x4be1ff, 0xffd23e, 0xff8a5c, 0x37e08b, 0xb46bff];
  beachSpots.length = 0;
  for (let i = 0; i < 9; i++) {
    const ux = 16 + i * 15 + r() * 5, uz = 124 + (i % 3) * 6 + r() * 3;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), std({ color: 0xf0ead8 }));
    pole.position.set(ux, 1.2, uz); scene.add(pole);
    const top = new THREE.Mesh(new THREE.ConeGeometry(2.1, 0.8, 10), std({ color: umbCols[i % 6], roughness: 0.85 }));
    top.position.set(ux, 2.55, uz); top.castShadow = true; scene.add(top);
    const towel = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.04, 2.1), std({ color: umbCols[(i + 2) % 6], roughness: 1 }));
    towel.position.set(ux + 1.6, 0.06, uz + 0.6); towel.rotation.y = r() * 0.8; scene.add(towel);
    beachSpots.push({ x: ux + 1.6, z: uz + 0.6, towel: true }, { x: ux - 1.4, z: uz + 1.2, swim: true });
  }
  const stand = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.4, 1.6), std({ color: 0xf2f4f8, roughness: 0.8 }));
  seat.position.y = 2.6; seat.castShadow = true; stand.add(seat);
  for (const [lx, lz] of [[-0.7, -0.6], [0.7, -0.6], [-0.7, 0.6], [0.7, 0.6]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.1, 6), std({ color: 0xe2483d }));
    leg.position.set(lx, 1.05, lz); stand.add(leg);
  }
  stand.position.set(96, 0, 126); scene.add(stand);
  // marina crates and barrels where the workers haul
  marinaWork.push({ x: -66, z: 136 }, { x: -40, z: 136 });
  for (let i = 0; i < 8; i++) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.1, 1.4), std({ color: i % 2 ? 0x9a7a4e : 0x6e8f5a, roughness: 1 }));
    crate.position.set(-68 + (i % 4) * 3.4, 0.55 + Math.floor(i / 4) * 1.12, 133 + (i % 2) * 2);
    crate.castShadow = true; scene.add(crate);
  }
  addCollider(-62, 134, 16, 5);
}

function buildSkyline(scene) {
  const r = rng(31);
  // unlit and fog-washed: distant towers dissolving into the golden haze
  const silMat = new THREE.MeshBasicMaterial({ color: 0x9db1c2, fog: true });
  for (let i = 0; i < 16; i++) {
    const h = 30 + r() * 48;
    const t = new THREE.Mesh(new THREE.BoxGeometry(20 + r() * 16, h, 18), silMat);
    const side = i % 3;
    if (side === 0) t.position.set(-260 + i * 34, h / 2, -250 - r() * 40);
    else if (side === 1) t.position.set(-300 - r() * 30, h / 2, -180 + i * 22);
    else t.position.set(300 + r() * 30, h / 2, -180 + i * 22);
    scene.add(t);
  }
}

export function updateWorld(dt, t) {
  if (waterMat) waterMat.uniforms.uTime.value = t;
  for (const b of boats) {
    b.position.y = Math.sin(t * 0.9 + b.userData.bobPhase) * 0.14;
    b.rotation.z = Math.sin(t * 0.7 + b.userData.bobPhase) * 0.03;
  }
}
