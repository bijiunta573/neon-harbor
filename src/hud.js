// hud.js — everything drawn over the 3D world: the mission card with its
// stage pips, cash/clock/stars/respect, weapon slots, crew cards with
// cooldowns, the NHPD dispatch board, the vehicle readout, dialogue and
// banner queues, the live minimap and the full map screen, plus the title,
// pause and game-over screens and the three localStorage save slots.
import { WORLD, AVENUES, STREETS, PLACES } from './world.js';

const $ = (id) => document.getElementById(id);
export const RANKS = ['ERRAND RUNNER', 'WHEELMAN', 'FIXER\'S FAVORITE', 'HARBOR REGULAR', 'DOCKSIDE NAME', 'NEON PLAYER', 'HARBOR ROYALTY'];
export function rankFor(respect) { return RANKS[Math.min(RANKS.length - 1, Math.floor(respect / 40))]; }

export function loadSaves() {
  const out = [];
  for (let i = 0; i < 3; i++) {
    try { out.push(JSON.parse(localStorage.getItem('neonharbor-save-' + i) || 'null')); }
    catch { out.push(null); }
  }
  return out;
}
export function writeSave(i, data) {
  try { localStorage.setItem('neonharbor-save-' + i, JSON.stringify({ ...data, when: Date.now() })); } catch { /* storage unavailable */ }
}

export class HUD {
  constructor(actions) {
    this.actions = actions;
    this.dlgTimer = 0; this.bannerTimer = 0;
    this.els = {
      hud: $('hud'), menu: $('menu'), pause: $('pause'), over: $('over'), mapscreen: $('mapscreen'),
      mcTitle: $('mc-title'), mcSegs: $('mc-segs'), mcObj: $('mc-obj'), mcNext: $('mc-next'),
      cash: $('cash'), clock: $('clock'), stars: $('stars'), respectFill: $('respect-fill'), rankName: $('rank-name'),
      shells: $('shells'), healthFill: $('health-fill'), bustWrap: $('bust-wrap'), bustFill: $('bust-fill'),
      weapons: $('weapons'), crew: $('crew'), dispatch: $('dispatch'), dispatchRows: $('dispatch-rows'),
      radio: $('radio'), veh: $('veh'), vehSpeed: $('veh-speed'), vehModel: $('veh-model'), vehCond: $('veh-cond'),
      dialogue: $('dialogue'), dlgPortrait: $('dlg-portrait'), dlgName: $('dlg-name'), dlgLine: $('dlg-line'),
      banner: $('banner'), bannerTitle: $('banner-title'), bannerSub: $('banner-sub'),
      prompt: $('prompt'), crosshair: $('crosshair'), hurt: $('hurt'),
      minimap: $('minimap').getContext('2d'), bigmap: $('bigmap').getContext('2d'),
      loadPanel: $('load-panel'), settingsPanel: $('settings-panel'),
    };
    this.buildWeaponSlots(); this.buildCrewCards();
    $('btn-new').onclick = () => { this.hidePanels(); actions.onNew(); };
    $('btn-continue').onclick = () => { const s = loadSaves().map((v, i) => [v, i]).filter(([v]) => v).sort((a, b) => b[0].when - a[0].when)[0]; if (s) { this.hidePanels(); actions.onLoad(s[0], s[1]); } };
    $('btn-load').onclick = () => { this.renderLoadPanel(); this.els.settingsPanel.classList.remove('open'); this.els.loadPanel.classList.toggle('open'); };
    $('btn-settings').onclick = () => { this.els.loadPanel.classList.remove('open'); this.els.settingsPanel.classList.toggle('open'); };
    $('btn-resume').onclick = () => actions.onResume();
    $('btn-save').onclick = () => actions.onSave();
    $('btn-quit').onclick = () => actions.onQuit();
    $('btn-respawn').onclick = () => actions.onRespawn();
    $('set-volume').oninput = (e) => actions.onVolume(e.target.value / 100);
    $('set-quality').onchange = (e) => actions.onQuality(e.target.value);
    $('set-sens').oninput = (e) => actions.onSensitivity(parseFloat(e.target.value));
    this.refreshContinue();
  }
  hidePanels() { this.els.loadPanel.classList.remove('open'); this.els.settingsPanel.classList.remove('open'); }
  refreshContinue() { $('btn-continue').disabled = !loadSaves().some(Boolean); }
  renderLoadPanel() {
    const saves = loadSaves();
    this.els.loadPanel.innerHTML = '<div class="panel-title">LOAD GAME</div>' + saves.map((s, i) =>
      s ? `<button class="slotrow" data-slot="${i}">SLOT ${i + 1} — $${s.cash} · Mission ${s.missionIdx + 1}<span>${new Date(s.when).toLocaleDateString()}</span></button>`
        : `<button class="slotrow empty">SLOT ${i + 1} — EMPTY</button>`).join('');
    this.els.loadPanel.querySelectorAll('.slotrow[data-slot]').forEach(b => {
      b.onclick = () => { const i = parseInt(b.dataset.slot); this.hidePanels(); this.actions.onLoad(loadSaves()[i], i); };
    });
  }
  buildWeaponSlots() {
    this.els.weapons.innerHTML = ['FISTS', 'PISTOL', 'SMG', 'RIFLE'].map((n, i) =>
      `<div class="wslot" id="wslot-${i}"><div class="wkey">${i + 1}</div><div class="wname">${n}</div><div class="wammo"></div></div>`).join('');
  }
  buildCrewCards() {
    this.els.crew.innerHTML = [
      ['DARIO', 'MECHANIC', 'Q', 'Repair + drop a star'],
      ['PINA', 'GHOST DRIVER', 'X', 'Scramble the pursuit'],
      ['TOMAS', 'LOOKOUT', 'C', 'Go dark: no new stars'],
    ].map(([n, r, k, a], i) => `<div class="ccard" id="crew-${i}"><div class="cname">${n} <span>· ${r}</span></div><div class="cability"><span class="ckey">${k}</span> ${a}</div><div class="ccd ready">READY</div></div>`).join('');
  }
  say(who, line, dur = 5) {
    this.els.dlgPortrait.textContent = who.name.charAt(0);
    this.els.dlgPortrait.style.background = who.color;
    this.els.dlgName.textContent = who.name;
    this.els.dlgName.style.color = who.color;
    this.els.dlgLine.textContent = line;
    this.els.dialogue.style.display = 'flex';
    this.dlgTimer = dur;
  }
  banner(title, sub) {
    this.els.bannerTitle.textContent = title;
    this.els.bannerSub.textContent = sub || '';
    this.els.banner.style.display = 'block';
    this.bannerTimer = 3.4;
  }
  setPrompt(text) {
    if (text) { this.els.prompt.textContent = text; this.els.prompt.style.display = 'block'; }
    else this.els.prompt.style.display = 'none';
  }
  showMenu() { this.els.menu.style.display = 'flex'; this.els.hud.style.display = 'none'; this.refreshContinue(); }
  hideMenu() { this.els.menu.style.display = 'none'; this.els.hud.style.display = 'block'; }
  showPause(on) { this.els.pause.style.display = on ? 'flex' : 'none'; }
  showMap(on) { this.els.mapscreen.style.display = on ? 'flex' : 'none'; }
  showOver(kind, sub) {
    $('over-title').textContent = kind;
    $('over-title').style.color = kind === 'BUSTED' ? '#ffb36b' : '#ff5a4b';
    $('over-sub').textContent = sub;
    this.els.over.style.display = 'flex';
  }
  hideOver() { this.els.over.style.display = 'none'; }
  update(dt, G) {
    const e = this.els;
    if (this.dlgTimer > 0) { this.dlgTimer -= dt; if (this.dlgTimer <= 0) e.dialogue.style.display = 'none'; }
    if (this.bannerTimer > 0) { this.bannerTimer -= dt; if (this.bannerTimer <= 0) e.banner.style.display = 'none'; }
    // mission card
    const m = G.missions;
    if (m.done) {
      e.mcTitle.textContent = 'FREE ROAM — NEON HARBOR';
      e.mcObj.textContent = 'The city is yours. Earn cash, find shells, outrun the NHPD.';
      e.mcNext.textContent = '';
      e.mcSegs.innerHTML = '';
    } else {
      const st = m.stage;
      e.mcTitle.textContent = m.mission.title;
      e.mcObj.textContent = st.text;
      e.mcNext.textContent = st.next || '';
      e.mcSegs.innerHTML = m.mission.stages.map((_, i) =>
        `<div class="seg${i < m.stageIdx ? ' done' : ''}"></div>`).join('') +
        `<div class="stagetext">STAGE ${m.stageIdx + 1}/${m.mission.stages.length}</div>`;
    }
    // top-right cluster
    e.cash.textContent = '$' + G.cash.toLocaleString();
    const mins = Math.floor(G.clockMinutes) % (24 * 60);
    e.clock.textContent = String(Math.floor(mins / 60)).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0');
    e.stars.innerHTML = Array.from({ length: 5 }, (_, i) => i < G.wanted ? '★' : '<span class="dim">★</span>').join('');
    e.stars.className = G.wanted >= 3 ? 'hot' : '';
    e.stars.id = 'stars';
    e.respectFill.style.width = (G.respect % 40) / 40 * 100 + '%';
    e.rankName.textContent = rankFor(G.respect);
    e.shells.textContent = `🐚 ${m.shellsGot} / 12 SHELLS`;
    // health + bust meter
    e.healthFill.style.width = G.player.health + '%';
    e.healthFill.style.background = G.player.health < 30 ? '#ff5a4b' : '#37e08b';
    e.hurt.style.opacity = G.player.health < 30 ? String(0.35 + Math.sin(performance.now() / 300) * 0.15) : (G.hurtFlash > 0 ? '0.5' : '0');
    if (G.bustProgress > 0.02) {
      e.bustWrap.style.display = 'block';
      e.bustFill.style.width = Math.min(100, G.bustProgress * 100) + '%';
    } else e.bustWrap.style.display = 'none';
    // weapons
    G.player.weapons.forEach((w, i) => {
      const slot = document.getElementById('wslot-' + i);
      if (!slot) return;
      slot.className = 'wslot' + (i === G.player.weaponIdx ? ' active' : '');
      slot.querySelector('.wammo').textContent = w.ammo === Infinity ? '—' : String(w.ammo);
    });
    // crew cooldowns
    G.crew.forEach((c, i) => {
      const card = document.getElementById('crew-' + i);
      if (!card) return;
      const cd = card.querySelector('.ccd');
      if (c.cd > 0) { cd.textContent = Math.ceil(c.cd) + 's'; cd.className = 'ccd'; }
      else { cd.textContent = 'READY'; cd.className = 'ccd ready'; }
    });
    // dispatch board
    if (G.wanted > 0) {
      e.dispatch.style.display = 'block';
      const rows = G.police.dispatchRows(G.playerPos());
      e.dispatchRows.innerHTML = rows.map(r =>
        `<div class="drow"><span class="dcall">${r.call}</span><span class="drole">${r.role}</span><span class="ddist">${r.dist}m</span></div>`).join('');
    } else e.dispatch.style.display = 'none';
    // vehicle readout + radio
    const v = G.player.vehicle;
    if (v) {
      e.veh.style.display = 'flex';
      e.vehSpeed.textContent = String(Math.round(Math.abs(v.speed) * 3.6));
      e.vehModel.textContent = v.spec.name;
      e.vehCond.style.width = v.health + '%';
      e.vehCond.style.background = v.health < 35 ? '#ff5a4b' : '#37e08b';
      e.radio.style.display = 'block';
      e.radio.textContent = '♪ ' + G.stationName;
    } else { e.veh.style.display = 'none'; e.radio.style.display = 'none'; }
    e.crosshair.style.display = (!v && G.player.weaponIdx > 0 && G.mode === 'play') ? 'block' : 'none';
    this.drawMinimap(G);
    if (G.mode === 'map') this.drawBigmap(G);
  }
  worldToMap(x, z, w, h) {
    return [ (x - WORLD.minX) / (WORLD.maxX - WORLD.minX) * w, (z - WORLD.minZ) / (WORLD.waterZ + 30 - WORLD.minZ) * h ];
  }
  drawRoads(ctx, w, h) {
    ctx.strokeStyle = 'rgba(200,205,215,.5)'; ctx.lineWidth = Math.max(1.4, w / 160);
    for (const a of AVENUES) { const [x] = this.worldToMap(a, 0, w, h); ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (const s of STREETS) { const [, y] = this.worldToMap(0, s, w, h); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  }
  drawMinimap(G) {
    const ctx = this.els.minimap, w = 216, h = 196;
    ctx.fillStyle = '#12202f'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1d4e5e'; ctx.fillRect(0, this.worldToMap(0, WORLD.waterZ, w, h)[1], w, h);
    ctx.fillStyle = '#8a744e'; ctx.fillRect(0, this.worldToMap(0, 118, w, h)[1], w, this.worldToMap(0, WORLD.waterZ, w, h)[1] - this.worldToMap(0, 118, w, h)[1]);
    this.drawRoads(ctx, w, h);
    const mp = G.missions.markerPos();
    if (mp) {
      const [mx, my] = this.worldToMap(mp.x, mp.z, w, h);
      ctx.fillStyle = '#ffd23e';
      ctx.save(); ctx.translate(mx, my); ctx.rotate(Math.PI / 4); ctx.fillRect(-4, -4, 8, 8); ctx.restore();
    }
    for (const u of G.police.units) {
      const [ux, uy] = this.worldToMap(u.vehicle.pos.x, u.vehicle.pos.z, w, h);
      ctx.fillStyle = Math.floor(performance.now() / 300) % 2 ? '#ff4040' : '#4a7aff';
      ctx.beginPath(); ctx.arc(ux, uy, 3, 0, 7); ctx.fill();
    }
    const pp = G.playerPos();
    const [px, py] = this.worldToMap(pp.x, pp.z, w, h);
    const heading = G.player.vehicle ? G.player.vehicle.heading : G.player.heading;
    ctx.save(); ctx.translate(px, py); ctx.rotate(Math.PI - heading);
    ctx.fillStyle = '#14f2d8';
    ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4, 5); ctx.lineTo(-4, 5); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  drawBigmap(G) {
    const ctx = this.els.bigmap, w = 880, h = 800;
    ctx.fillStyle = '#0e1a28'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#17424f'; ctx.fillRect(0, this.worldToMap(0, WORLD.waterZ, w, h)[1], w, h);
    ctx.fillStyle = '#8a744e'; ctx.fillRect(0, this.worldToMap(0, 118, w, h)[1], w, this.worldToMap(0, WORLD.waterZ, w, h)[1] - this.worldToMap(0, 118, w, h)[1]);
    this.drawRoads(ctx, w, h);
    ctx.font = '700 15px Verdana'; ctx.fillStyle = '#ffd23e'; ctx.textAlign = 'center';
    for (const k of Object.keys(PLACES)) {
      const p = PLACES[k];
      const [x, y] = this.worldToMap(p.x, p.z, w, h);
      ctx.fillText('◆', x, y);
      ctx.fillStyle = '#cfe3ef'; ctx.font = '11px Verdana';
      ctx.fillText(p.name.toUpperCase(), x, y + 15);
      ctx.fillStyle = '#ffd23e'; ctx.font = '700 15px Verdana';
    }
    const mp = G.missions.markerPos();
    if (mp) {
      const [mx, my] = this.worldToMap(mp.x, mp.z, w, h);
      ctx.save(); ctx.translate(mx, my); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#ffd23e'; ctx.fillRect(-8, -8, 16, 16); ctx.restore();
    }
    for (const u of G.police.units) {
      const [ux, uy] = this.worldToMap(u.vehicle.pos.x, u.vehicle.pos.z, w, h);
      ctx.fillStyle = '#ff4040'; ctx.beginPath(); ctx.arc(ux, uy, 6, 0, 7); ctx.fill();
    }
    const pp = G.playerPos();
    const [px, py] = this.worldToMap(pp.x, pp.z, w, h);
    ctx.fillStyle = '#14f2d8'; ctx.beginPath(); ctx.arc(px, py, 8, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px, py, 3.5, 0, 7); ctx.fill();
    $('map-stats').innerHTML = [
      ['CASH', '$' + G.cash.toLocaleString()], ['RESPECT', String(Math.floor(G.respect))],
      ['RANK', rankFor(G.respect)], ['SHELLS', G.missions.shellsGot + ' / 12'],
      ['MISSION', G.missions.done ? 'COMPLETE' : (G.missions.missionIdx + 1) + ' · STAGE ' + (G.missions.stageIdx + 1)],
      ['WANTED', G.wanted ? '★'.repeat(G.wanted) : 'CLEAN'],
    ].map(([k, v]) => `<div>${k} <b>${v}</b></div>`).join('');
  }
}
