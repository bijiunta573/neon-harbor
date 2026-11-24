// textures.js — every surface in Neon Harbor is painted at boot on canvas:
// asphalt with worn patches, facades whose windows are lit or shuttered by
// chance, grass, sand, awnings and neon signs. No image files, no network.
import * as THREE from 'three';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function tex(c, rx = 1, ry = 1) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// Small deterministic random so the city paints the same on every boot.
export function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

export function asphaltTexture() {
  const [c, g] = canvas(256, 256); const r = rng(41);
  g.fillStyle = '#33363c'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5200; i++) {
    const v = 38 + r() * 34;
    g.fillStyle = `rgb(${v},${v + 2},${v + 6})`;
    g.fillRect(r() * 256, r() * 256, 2, 2);
  }
  for (let i = 0; i < 9; i++) { // worn patches and tar seams
    g.fillStyle = `rgba(18,19,22,${0.10 + r() * 0.16})`;
    g.beginPath(); g.ellipse(r() * 256, r() * 256, 14 + r() * 42, 8 + r() * 22, r() * 3, 0, 7); g.fill();
  }
  g.strokeStyle = 'rgba(12,12,14,.5)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(0, r() * 256); g.lineTo(256, r() * 256); g.stroke();
  return tex(c, 6, 6);
}

export function sidewalkTexture() {
  const [c, g] = canvas(128, 128); const r = rng(97);
  g.fillStyle = '#8d8578'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 1600; i++) {
    const v = 118 + r() * 42;
    g.fillStyle = `rgb(${v},${v - 6},${v - 18})`;
    g.fillRect(r() * 128, r() * 128, 2, 2);
  }
  g.strokeStyle = 'rgba(60,54,44,.65)'; g.lineWidth = 2;
  g.strokeRect(1, 1, 126, 126);
  return tex(c, 3, 3);
}

export function grassTexture() {
  const [c, g] = canvas(128, 128); const r = rng(7);
  g.fillStyle = '#4d7a35'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 2400; i++) {
    g.fillStyle = `rgb(${58 + r() * 40},${108 + r() * 52},${40 + r() * 26})`;
    g.fillRect(r() * 128, r() * 128, 1.6, 3.4);
  }
  return tex(c, 10, 10);
}

export function sandTexture() {
  const [c, g] = canvas(128, 128); const r = rng(23);
  g.fillStyle = '#dec493'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 2000; i++) {
    const v = 196 + r() * 44;
    g.fillStyle = `rgb(${v},${v - 22},${v - 62})`;
    g.fillRect(r() * 128, r() * 128, 1.6, 1.6);
  }
  g.strokeStyle = 'rgba(178,150,96,.35)';
  for (let i = 0; i < 7; i++) { g.beginPath(); g.moveTo(0, r() * 128); g.bezierCurveTo(40, r() * 128, 90, r() * 128, 128, r() * 128); g.stroke(); }
  return tex(c, 8, 8);
}

// A building face: rows of windows, some warm-lit, some dark glass with a
// sunset sheen, some shuttered; grime at the base and a cornice at the top.
export function facadeTexture(seed, base, floors, cols) {
  const [c, g] = canvas(256, 256); const r = rng(seed);
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(0,0,0,${r() * 0.05})`;
    g.fillRect(r() * 256, r() * 256, 3, 3);
  }
  const fh = 256 / floors, cw = 256 / cols;
  for (let f = 0; f < floors; f++) for (let col = 0; col < cols; col++) {
    const x = col * cw + cw * 0.24, y = f * fh + fh * 0.2, w = cw * 0.52, h = fh * 0.58;
    const roll = r();
    if (roll < 0.30) { // warm-lit window, sometimes with a blind line
      g.fillStyle = r() < 0.5 ? '#ffca7a' : '#ffe9b0';
      g.fillRect(x, y, w, h);
      if (r() < 0.5) { g.fillStyle = 'rgba(120,70,20,.55)'; g.fillRect(x, y, w, h * 0.4); }
    } else if (roll < 0.44) { // shuttered
      g.fillStyle = '#5d6670'; g.fillRect(x, y, w, h);
      g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x, y, w, 2);
    } else { // dark glass with sunset sheen
      const grad = g.createLinearGradient(x, y, x + w, y + h);
      grad.addColorStop(0, '#2b3d4d'); grad.addColorStop(0.55, '#47617a'); grad.addColorStop(1, '#1d2833');
      g.fillStyle = grad; g.fillRect(x, y, w, h);
      g.fillStyle = 'rgba(255,170,90,.28)'; g.fillRect(x, y, w * 0.4, h);
    }
    g.strokeStyle = 'rgba(20,18,16,.6)'; g.lineWidth = 2; g.strokeRect(x, y, w, h);
  }
  const grime = g.createLinearGradient(0, 226, 0, 256);
  grime.addColorStop(0, 'rgba(30,24,18,0)'); grime.addColorStop(1, 'rgba(30,24,18,.45)');
  g.fillStyle = grime; g.fillRect(0, 226, 256, 30);
  g.fillStyle = 'rgba(255,255,255,.20)'; g.fillRect(0, 0, 256, 5);
  return tex(c);
}

export function awningTexture(colorA, colorB) {
  const [c, g] = canvas(128, 64);
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? colorA : colorB; g.fillRect(i * 16, 0, 16, 64); }
  const grad = g.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, 'rgba(255,255,255,.16)'); grad.addColorStop(1, 'rgba(0,0,0,.28)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 64);
  return tex(c, 2, 1);
}

// A glowing shop sign: dark board, bright lettering. Used on emissive planes.
export function signTexture(text, fg, bg) {
  const [c, g] = canvas(512, 128);
  g.fillStyle = bg; g.fillRect(0, 0, 512, 128);
  g.font = '900 64px Verdana, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = fg; g.shadowBlur = 26;
  g.fillStyle = fg;
  g.fillText(text, 256, 66); g.fillText(text, 256, 66);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function skyTexture() {
  const [c, g] = canvas(64, 512);
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.0, '#2e4a72');
  grad.addColorStop(0.34, '#7d94b8');
  grad.addColorStop(0.52, '#e8a56b');
  grad.addColorStop(0.60, '#ffc98a');
  grad.addColorStop(0.66, '#f7b06a');
  grad.addColorStop(1.0, '#e88f52');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Radial glow sprite used for the sun, neon halos, headlights and lightbars.
export function glowTexture(color) {
  const [c, g] = canvas(128, 128);
  const grad = g.createRadialGradient(64, 64, 2, 64, 64, 62);
  grad.addColorStop(0, color);
  grad.addColorStop(0.35, color + 'aa');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
