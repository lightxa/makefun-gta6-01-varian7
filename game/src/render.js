// Rendering for Solmar Bay: the whole city drawn top-down on one canvas —
// water, beach, roads, blocks, parks and palms, traffic, the player,
// police, mission beacons and particles — plus the HUD (cash, health,
// wanted stars, objective), the minimap, and the title, pause, busted,
// wasted and story-complete screens. All art is drawn in code; no images.
import {
  WORLD_W, WORLD_H, ROADS_X, ROADS_Y, ROAD_W, BEACH_X, BEACH_W,
  PALETTE, CONTROLS_TEXT, STORY_INTRO, MISSIONS, districtAt,
} from './config.js';
import { clamp, dist } from './random.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawCar(ctx, x, y, angle, color, model, isPolice, speedRatio) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  roundRect(ctx, -22 + 3, -12 + 4, 46, 26, 7);
  ctx.fill();
  ctx.fillStyle = color;
  roundRect(ctx, -22, -12, 46, 26, 7);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,30,50,0.85)';
  roundRect(ctx, -6, -10, 14, 20, 3);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillRect(20, -10, 2, 4);
  ctx.fillRect(20, 6, 2, 4);
  ctx.fillStyle = '#ffdd55';
  ctx.fillRect(22, -9, 2, 5);
  ctx.fillRect(22, 4, 2, 5);
  if (isPolice) {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLICE', -2, 3);
  }
  ctx.restore();
  if (model) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(model, x, y - 18);
    ctx.restore();
  }
}

export function drawPedestrian(ctx, ped) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  if (ped.down) {
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(2, 3, 12, 7, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = ped.down ? '#888888' : ped.shirt;
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8b88a';
  ctx.beginPath();
  ctx.arc(Math.cos(ped.angle) * 3, Math.sin(ped.angle) * 3, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawPlayerOnFoot(ctx, player, time) {
  const bob = Math.abs(Math.sin(time * 10)) * (player.speed > 10 ? 2 : 0);
  ctx.save();
  ctx.translate(player.x, player.y - bob);
  ctx.rotate(player.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(2, 4, 12, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1d3557';
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f1faee';
  ctx.beginPath();
  ctx.arc(4, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  if (player.punchTimer > 0) {
    ctx.fillStyle = '#e8b88a';
    ctx.beginPath();
    ctx.arc(20, 0, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBuilding(ctx, b, cam) {
  const h = b.height * 7;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(b.x + h * 0.5, b.y + h * 0.5, b.w, b.h);
  ctx.fillStyle = b.wall;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = b.roof;
  ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1;
  const cols = Math.max(2, Math.floor(b.w / 34));
  const rows = Math.max(2, Math.floor(b.h / 34));
  for (let i = 1; i < cols; i++) {
    ctx.beginPath();
    ctx.moveTo(b.x + (b.w / cols) * i, b.y + 4);
    ctx.lineTo(b.x + (b.w / cols) * i, b.y + b.h - 4);
    ctx.stroke();
  }
  for (let j = 1; j < rows; j++) {
    ctx.beginPath();
    ctx.moveTo(b.x + 4, b.y + (b.h / rows) * j);
    ctx.lineTo(b.x + b.w - 4, b.y + (b.h / rows) * j);
    ctx.stroke();
  }
  if (b.height >= 3) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(b.x + b.w / 2 - 8, b.y + b.h / 2 - 8, 16, 16);
  }
}

function drawPalm(ctx, palm, time) {
  const sway = Math.sin(time * 1.2 + palm.x * 0.01) * 3;
  ctx.save();
  ctx.translate(palm.x, palm.y);
  ctx.strokeStyle = '#8a6d3b';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(sway, -12 * palm.s);
  ctx.stroke();
  ctx.fillStyle = '#2d9d5f';
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(
      Math.cos(a) * 9 * palm.s + sway, -12 * palm.s + Math.sin(a) * 6 * palm.s,
      9 * palm.s, 3.5 * palm.s, a, 0, Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.restore();
}

function drawWorld(ctx, world, cam, time) {
  const { x0, y0, x1, y1 } = cam.view;
  // Base ground.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  // Water and beach on the west edge.
  ctx.fillStyle = PALETTE.waterDeep;
  ctx.fillRect(x0, y0, Math.max(0, BEACH_X - x0), y1 - y0);
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(Math.max(x0, 40), y0, Math.max(0, BEACH_X - Math.max(x0, 40)), y1 - y0);
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(BEACH_X, y0, BEACH_W, y1 - y0);
  // Wave lines.
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  for (let y = Math.floor(y0 / 90) * 90; y < y1; y += 90) {
    ctx.beginPath();
    ctx.moveTo(BEACH_X - 14, y + Math.sin(time + y * 0.05) * 4);
    ctx.quadraticCurveTo(BEACH_X - 4, y + 8, BEACH_X + 6, y);
    ctx.stroke();
  }
  // Parks and plazas.
  for (const park of world.parks) {
    ctx.fillStyle = PALETTE.park;
    ctx.fillRect(park.x, park.y, park.w, park.h);
  }
  for (const plaza of world.plazas) {
    ctx.fillStyle = PALETTE.plaza;
    ctx.fillRect(plaza.x, plaza.y, plaza.w, plaza.h);
  }
  // Roads.
  ctx.fillStyle = PALETTE.road;
  for (const rx of ROADS_X) ctx.fillRect(rx - ROAD_W / 2, y0, ROAD_W, y1 - y0);
  for (const ry of ROADS_Y) ctx.fillRect(x0, ry - ROAD_W / 2, x1 - x0, ROAD_W);
  // Centre dashes.
  ctx.strokeStyle = PALETTE.roadLine;
  ctx.lineWidth = 3;
  ctx.setLineDash([22, 26]);
  for (const rx of ROADS_X) {
    ctx.beginPath();
    ctx.moveTo(rx, y0);
    ctx.lineTo(rx, y1);
    ctx.stroke();
  }
  for (const ry of ROADS_Y) {
    ctx.beginPath();
    ctx.moveTo(x0, ry);
    ctx.lineTo(x1, ry);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // Sidewalks.
  ctx.strokeStyle = PALETTE.sidewalk;
  ctx.lineWidth = 10;
  for (const rx of ROADS_X) {
    ctx.beginPath(); ctx.moveTo(rx - ROAD_W / 2 - 5, y0); ctx.lineTo(rx - ROAD_W / 2 - 5, y1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(rx + ROAD_W / 2 + 5, y0); ctx.lineTo(rx + ROAD_W / 2 + 5, y1); ctx.stroke();
  }
  for (const ry of ROADS_Y) {
    ctx.beginPath(); ctx.moveTo(x0, ry - ROAD_W / 2 - 5); ctx.lineTo(x1, ry - ROAD_W / 2 - 5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x0, ry + ROAD_W / 2 + 5); ctx.lineTo(x1, ry + ROAD_W / 2 + 5); ctx.stroke();
  }
  // District labels on the ground.
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'center';
  for (const d of [{ name: 'MARINA', x: 550, y: 420 }, { name: 'PALM ROW', x: 1600, y: 420 }, { name: 'HARBOR', x: 2700, y: 420 }, { name: 'DOWNTOWN', x: 1600, y: 1150 }, { name: 'OLD TOWN', x: 550, y: 1050 }]) {
    ctx.fillText(d.name, d.x, d.y);
  }
  // Buildings, palms.
  for (const b of world.buildings) {
    if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
    drawBuilding(ctx, b, cam);
  }
  for (const palm of world.palms) {
    if (palm.x < x0 - 30 || palm.x > x1 + 30 || palm.y < y0 - 30 || palm.y > y1 + 30) continue;
    drawPalm(ctx, palm, time);
  }
}

function drawMarker(ctx, target, time) {
  if (!target) return;
  const pulse = 1 + Math.sin(time * 5) * 0.18;
  const r = 34 * pulse;
  ctx.save();
  ctx.strokeStyle = '#ffd60a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(target.x, target.y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,214,10,0.18)';
  ctx.beginPath();
  ctx.arc(target.x, target.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd60a';
  ctx.beginPath();
  ctx.moveTo(target.x, target.y - 52 - Math.sin(time * 5) * 6);
  ctx.lineTo(target.x - 10, target.y - 30);
  ctx.lineTo(target.x + 10, target.y - 30);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#111111';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(target.label, target.x, target.y - 60 - Math.sin(time * 5) * 6);
  ctx.restore();
}

function drawParticles(ctx, particles) {
  for (const p of particles) {
    ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function drawMinimap(ctx, state, viewW, viewH) {
  const mw = 190;
  const mh = 138;
  const mx = 16;
  const my = viewH - mh - 16;
  const sx = mw / WORLD_W;
  const sy = mh / WORLD_H;
  ctx.save();
  ctx.fillStyle = 'rgba(10,16,28,0.82)';
  roundRect(ctx, mx - 6, my - 6, mw + 12, mh + 12, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.beginPath();
  roundRect(ctx, mx, my, mw, mh, 6);
  ctx.clip();
  ctx.fillStyle = '#2a9dbe';
  ctx.fillRect(mx, my, 26, mh);
  ctx.fillStyle = '#7fb069';
  ctx.fillRect(mx + 26, my, mw - 26, mh);
  ctx.fillStyle = '#3d3d4d';
  for (const rx of ROADS_X) ctx.fillRect(mx + rx * sx - 1, my, 2, mh);
  for (const ry of ROADS_Y) ctx.fillRect(mx, my + ry * sy, mw, 2);
  ctx.fillStyle = '#ffd60a';
  const target = state.missionTarget;
  if (target) {
    ctx.beginPath();
    ctx.arc(mx + target.x * sx, my + target.y * sy, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(mx + state.player.x * sx, my + state.player.y * sy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#111111';
  ctx.lineWidth = 1;
  ctx.stroke();
  for (const car of state.police.cars) {
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath();
    ctx.arc(mx + car.x * sx, my + car.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(districtAt(state.player.x, state.player.y), mx, my - 10);
}

function drawHud(ctx, state, viewW, viewH) {
  // Top-left: cash and health.
  ctx.fillStyle = 'rgba(10,16,28,0.78)';
  roundRect(ctx, 14, 12, 230, 64, 10);
  ctx.fill();
  ctx.fillStyle = '#7ee081';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('$' + state.player.cash.toLocaleString('en-US'), 26, 42);
  ctx.fillStyle = '#ffffff';
  ctx.font = '13px sans-serif';
  ctx.fillText('KIT VELA', 26, 62);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  roundRect(ctx, 130, 50, 100, 10, 5);
  ctx.fill();
  ctx.fillStyle = state.player.health > 30 ? '#7ee081' : '#ff5a5a';
  roundRect(ctx, 130, 50, 100 * clamp(state.player.health / 100, 0, 1), 10, 5);
  ctx.fill();

  // Top-right: wanted stars.
  ctx.fillStyle = 'rgba(10,16,28,0.78)';
  roundRect(ctx, viewW - 214, 12, 200, 44, 10);
  ctx.fill();
  for (let i = 0; i < 5; i++) {
    ctx.font = '26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = i < state.police.level ? '#ffd60a' : 'rgba(255,255,255,0.25)';
    ctx.fillText('\u2605', viewW - 188 + i * 36, 42);
  }

  // Mission objective banner.
  if (state.missions.active) {
    const mission = MISSIONS[state.missions.index];
    const step = mission ? mission.steps[state.missions.stepIndex] : null;
    ctx.fillStyle = 'rgba(10,16,28,0.78)';
    const text = (mission ? mission.title + ': ' : '') + (step ? step.text : '');
    ctx.font = 'bold 15px sans-serif';
    const w = Math.min(viewW - 40, ctx.measureText(text).width + 28);
    roundRect(ctx, (viewW - w) / 2, 66, w, 34, 9);
    ctx.fill();
    ctx.fillStyle = '#ffd60a';
    ctx.textAlign = 'center';
    ctx.fillText(text, viewW / 2, 88);
    if (state.missions.countdown > 0) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(Math.ceil(state.missions.countdown) + 's left', viewW / 2, 118);
    }
  }

  // Speed and vehicle.
  if (!state.player.onFoot && state.player.car) {
    ctx.fillStyle = 'rgba(10,16,28,0.78)';
    roundRect(ctx, viewW - 214, viewH - 66, 200, 52, 10);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(Math.abs(state.player.car.speed) * 0.18) + ' km/h', viewW - 30, viewH - 32);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#ffd60a';
    ctx.fillText(state.player.car.model, viewW - 30, viewH - 52 + 34);
  }

  // Toast message.
  if (state.missions.messageTimer > 0 && state.missions.message) {
    ctx.fillStyle = 'rgba(10,16,28,0.85)';
    ctx.font = 'bold 17px sans-serif';
    const w = Math.min(viewW - 60, ctx.measureText(state.missions.message).width + 32);
    roundRect(ctx, (viewW - w) / 2, viewH - 190, w, 38, 9);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(state.missions.message, viewW / 2, viewH - 165);
  }

  // Controls hint.
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('WASD move/drive  •  E enter car  •  Space punch  •  P pause  •  M mute', viewW - 16, viewH - 14);
}

function drawTitle(ctx, state, viewW, viewH, hasSave) {
  ctx.fillStyle = 'rgba(8,12,24,0.72)';
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd60a';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('SOLMAR BAY', viewW / 2, viewH / 2 - 130);
  ctx.fillStyle = '#ffffff';
  ctx.font = '20px sans-serif';
  ctx.fillText('A sun-soaked open-world crime story', viewW / 2, viewH / 2 - 96);
  ctx.font = '15px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  const words = STORY_INTRO.split(' ');
  let line = '';
  let y = viewH / 2 - 58;
  const lines = [];
  for (const word of words) {
    if ((line + ' ' + word).length > 78) { lines.push(line); line = word; }
    else line = line ? line + ' ' + word : word;
  }
  lines.push(line);
  for (const l of lines) { ctx.fillText(l, viewW / 2, y); y += 20; }
  ctx.font = '14px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  y += 16;
  for (const c of CONTROLS_TEXT) { ctx.fillText(c, viewW / 2, y); y += 19; }
  // Buttons.
  state.titleButtons = [];
  const bw = 260;
  const bx = viewW / 2 - bw / 2;
  const by = y + 18;
  const buttons = hasSave
    ? [{ label: 'CONTINUE', action: 'continue' }, { label: 'NEW GAME', action: 'new' }]
    : [{ label: 'START ENGINE', action: 'new' }];
  buttons.forEach((b, i) => {
    const yy = by + i * 52;
    ctx.fillStyle = i === 0 ? '#ffd60a' : 'rgba(255,255,255,0.18)';
    roundRect(ctx, bx, yy, bw, 42, 9);
    ctx.fill();
    ctx.fillStyle = i === 0 ? '#111111' : '#ffffff';
    ctx.font = 'bold 17px sans-serif';
    ctx.fillText(b.label, viewW / 2, yy + 27);
    state.titleButtons.push({ x: bx, y: yy, w: bw, h: 42, action: b.action });
  });
}

function drawOverlay(ctx, viewW, viewH, title, lines, accent) {
  ctx.fillStyle = 'rgba(8,12,24,0.72)';
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.textAlign = 'center';
  ctx.fillStyle = accent;
  ctx.font = 'bold 56px sans-serif';
  ctx.fillText(title, viewW / 2, viewH / 2 - 40);
  ctx.fillStyle = '#ffffff';
  ctx.font = '18px sans-serif';
  let y = viewH / 2 + 6;
  for (const line of lines) { ctx.fillText(line, viewW / 2, y); y += 28; }
}

export function drawGame(ctx, state, viewW, viewH, time) {
  ctx.clearRect(0, 0, viewW, viewH);
  const cam = state.camera;
  ctx.save();
  ctx.translate(viewW / 2, viewH / 2);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x, -cam.y);
  drawWorld(ctx, state.world, cam, time);
  // Landmark flags.
  for (const key of Object.keys(state.world.landmarks)) {
    if (key === 'spawn') continue;
    const lm = state.world.landmarks[key];
    ctx.fillStyle = '#ffd60a';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(lm.label.toUpperCase(), lm.x, lm.y - 44);
  }
  drawMarker(ctx, state.missionTarget, time);
  // Cars: parked and traffic first, then police, then the player car.
  for (const car of state.traffic.cars) {
    if (car === state.player.car) continue;
    if (car.x < cam.view.x0 - 80 || car.x > cam.view.x1 + 80 || car.y < cam.view.y0 - 80 || car.y > cam.view.y1 + 80) continue;
    drawCar(ctx, car.x, car.y, car.angle, car.color, null, false, 0);
  }
  for (const car of state.police.cars) {
    drawCar(ctx, car.x, car.y, car.angle, car.color, null, true, 0);
    if (car.sirenPhase % (Math.PI * 2) < Math.PI) {
      ctx.fillStyle = 'rgba(255,60,60,0.5)';
      ctx.beginPath(); ctx.arc(car.x, car.y, 26, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(60,120,255,0.5)';
      ctx.beginPath(); ctx.arc(car.x, car.y, 26, 0, Math.PI * 2); ctx.fill();
    }
  }
  for (const ped of state.traffic.peds) {
    if (ped.x < cam.view.x0 - 40 || ped.x > cam.view.x1 + 40 || ped.y < cam.view.y0 - 40 || ped.y > cam.view.y1 + 40) continue;
    drawPedestrian(ctx, ped);
  }
  for (const cop of state.police.cops) {
    drawPedestrian(ctx, { ...cop, shirt: '#1b2a4a' });
  }
  if (state.player.onFoot) drawPlayerOnFoot(ctx, state.player, time);
  else if (state.player.car) drawCar(ctx, state.player.car.x, state.player.car.y, state.player.car.angle, state.player.car.color, state.player.car.model, false, 0);
  drawParticles(ctx, state.particles);
  ctx.restore();

  // Time-of-day tint.
  ctx.fillStyle = 'rgba(255,180,80,0.05)';
  ctx.fillRect(0, 0, viewW, viewH);
  if (state.player.hurtFlash > 0) {
    ctx.fillStyle = 'rgba(255,40,40,' + (state.player.hurtFlash * 0.5) + ')';
    ctx.fillRect(0, 0, viewW, viewH);
  }
  // Vignette.
  const grad = ctx.createRadialGradient(viewW / 2, viewH / 2, Math.min(viewW, viewH) * 0.42, viewW / 2, viewH / 2, Math.max(viewW, viewH) * 0.75);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, viewW, viewH);

  if (state.mode === 'playing' || state.mode === 'paused' || state.mode === 'busted' || state.mode === 'wasted') {
    drawMinimap(ctx, state, viewW, viewH);
    drawHud(ctx, state, viewW, viewH);
  }
  if (state.mode === 'title') drawTitle(ctx, state, viewW, viewH, state.hasSave);
  if (state.mode === 'paused') {
    drawOverlay(ctx, viewW, viewH, 'PAUSED', ['Press P or Esc to keep playing', 'Progress saves automatically at each job'], '#ffffff');
  }
  if (state.mode === 'busted') {
    drawOverlay(ctx, viewW, viewH, 'BUSTED!', ['The Solmar Bay Police caught Kit Vela.', 'Press R to get out on bail and try again ($100).'], '#ff5a5a');
  }
  if (state.mode === 'wasted') {
    drawOverlay(ctx, viewW, viewH, 'WASTED', ['Kit Vela is down. The city keeps moving.', 'Press R to wake up at the hospital ($100).'], '#ff5a5a');
  }
  if (state.mode === 'storyDone') {
    drawOverlay(ctx, viewW, viewH, 'SOLMAR IS YOURS', ['All five jobs done. Kit Vela owns the bay.', 'Keep driving — the city is yours now. Press R to play on.'], '#ffd60a');
  }
}
