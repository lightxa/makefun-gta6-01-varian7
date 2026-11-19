// Rendering: the canvas draws the whole city top-down — roads, blocks,
// beach and water, traffic, the player, police, mission beacons, particles
// — plus the HUD (cash, health, wanted stars, objective), the minimap and
// the title / pause / busted screens. All art is drawn in code; no images.
import { WORLD_W, WORLD_H, ROADS_X, ROADS_Y, ROAD_W, BEACH_Y, WATER_Y, PALETTE, districtAt } from './config.js';
import { clamp, dist } from './random.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = canvas.width;
    this.H = canvas.height;
  }

  draw(game, cam) {
    const ctx = this.ctx;
    const { x: cx, y: cy, zoom } = cam;
    ctx.save();
    ctx.fillStyle = '#1d2733';
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.translate(this.W / 2, this.H / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-cx, -cy);
    this.drawGround(ctx, game, cx, cy);
    this.drawWorld(ctx, game, cx, cy);
    this.drawMissionMarker(ctx, game);
    this.drawTraffic(ctx, game);
    this.drawPedestrians(ctx, game);
    this.drawPolice(ctx, game);
    this.drawPlayer(ctx, game);
    this.drawParticles(ctx, game);
    ctx.restore();
    this.drawHud(ctx, game);
    this.drawMinimap(ctx, game);
    if (game.state === 'title') this.drawTitle(ctx, game);
    else if (game.state === 'paused') this.drawPaused(ctx, game);
    else if (game.state === 'busted') this.drawBusted(ctx, game);
    else if (game.missions.done) this.drawComplete(ctx, game);
  }

  viewBounds(cam) {
    const hw = this.W / 2 / cam.zoom;
    const hh = this.H / 2 / cam.zoom;
    return { x0: cam.x - hw - 60, y0: cam.y - hh - 60, x1: cam.x + hw + 60, y1: cam.y + hh + 60 };
  }

  drawGround(ctx, game, cx, cy) {
    const v = this.viewBounds({ x: cx, y: cy, zoom: game.cam.zoom });
    // Grass base.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
    // Sand and water at the south edge.
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(Math.max(v.x0, 0), BEACH_Y, Math.min(v.x1, WORLD_W) - Math.max(v.x0, 0), WATER_Y - BEACH_Y);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(Math.max(v.x0, 0), WATER_Y, Math.min(v.x1, WORLD_W) - Math.max(v.x0, 0), WORLD_H - WATER_Y);
    ctx.fillStyle = PALETTE.waterDeep;
    for (let i = 0; i < 8; i++) {
      const wx = 200 + i * 380 + Math.sin(game.time * 0.7 + i) * 22;
      const wy = WATER_Y + 40 + (i % 3) * 46;
      ctx.fillRect(wx, wy, 90, 4);
    }
    // Roads.
    ctx.fillStyle = PALETTE.asphalt;
    for (const rx of ROADS_X) ctx.fillRect(rx - ROAD_W / 2, 0, ROAD_W, BEACH_Y);
    for (const ry of ROADS_Y) ctx.fillRect(0, ry - ROAD_W / 2, WORLD_W, ROAD_W);
    // Sidewalk edges.
    ctx.fillStyle = PALETTE.sidewalk;
    for (const rx of ROADS_X) {
      ctx.fillRect(rx - ROAD_W / 2 - 8, 0, 8, BEACH_Y);
      ctx.fillRect(rx + ROAD_W / 2, 0, 8, BEACH_Y);
    }
    for (const ry of ROADS_Y) {
      ctx.fillRect(0, ry - ROAD_W / 2 - 8, WORLD_W, 8);
      ctx.fillRect(0, ry + ROAD_W / 2, WORLD_W, 8);
    }
    // Centre dashes.
    ctx.fillStyle = PALETTE.asphaltLine;
    for (const rx of ROADS_X) {
      for (let y = 0; y < BEACH_Y; y += 64) ctx.fillRect(rx - 2, y, 4, 30);
    }
    for (const ry of ROADS_Y) {
      for (let x = 0; x < WORLD_W; x += 64) ctx.fillRect(x, ry - 2, 30, 4);
    }
    // Crosswalk stripes at intersections.
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (const rx of ROADS_X) {
      for (const ry of ROADS_Y) {
        for (let i = -2; i <= 2; i++) ctx.fillRect(rx + i * 14 - 4, ry - ROAD_W / 2 - 2, 8, 12);
      }
    }
  }

  drawWorld(ctx, game, cx, cy) {
    const v = this.viewBounds({ x: cx, y: cy, zoom: game.cam.zoom });
    // Parks, plazas and markets.
    for (const p of game.world.parks) {
      if (p.x1 < v.x0 || p.x0 > v.x1 || p.y1 < v.y0 || p.y0 > v.y1) continue;
      ctx.fillStyle = p.kind === 'plaza' ? '#c9bda6' : p.kind === 'market' ? '#d8c49a' : '#69a854';
      ctx.fillRect(p.x0, p.y0, p.x1 - p.x0, p.y1 - p.y0);
      if (p.kind === 'market') {
        ctx.fillStyle = '#e85d75';
        for (let i = 0; i < 4; i++) ctx.fillRect(p.x0 + 24 + i * 52, p.y0 + 30, 40, 26);
        ctx.fillStyle = '#f2a541';
        for (let i = 0; i < 4; i++) ctx.fillRect(p.x0 + 24 + i * 52, p.y0 + 90, 40, 26);
      }
    }
    // Trees.
    for (const t of game.world.trees) {
      if (t.x < v.x0 || t.x > v.x1 || t.y < v.y0 || t.y > v.y1) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath(); ctx.arc(t.x + 4, t.y + 5, t.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = PALETTE.parkTree;
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = PALETTE.parkTreeLight;
      ctx.beginPath(); ctx.arc(t.x - 3, t.y - 3, t.r * 0.55, 0, Math.PI * 2); ctx.fill();
    }
    // Buildings with a sun shadow and a roof.
    for (const b of game.world.buildings) {
      if (b.x1 < v.x0 || b.x0 > v.x1 || b.y1 < v.y0 || b.y0 > v.y1) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(b.x0 + 7, b.y0 + 8, b.x1 - b.x0, b.y1 - b.y0);
      ctx.fillStyle = b.wall;
      ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x0 + 5, b.y0 + 5, b.x1 - b.x0 - 10, b.y1 - b.y0 - 10);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(b.x0 + 8, b.y0 + 8, b.x1 - b.x0 - 16, 5);
      if (b.downtown && b.h > 24) {
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(b.x0 + 10, b.y0 + 12, 8, 8);
        ctx.fillRect(b.x0 + 26, b.y0 + 12, 8, 8);
      }
    }
    // Beach props.
    for (const p of game.world.beachProps) {
      if (p.x < v.x0 || p.x > v.x1 || p.y < v.y0 || p.y > v.y1) continue;
      if (p.kind === 'umbrella') {
        ctx.fillStyle = '#8a5a3b';
        ctx.fillRect(p.x - 1, p.y, 2, 16);
        ctx.fillStyle = p.hue;
        ctx.beginPath(); ctx.arc(p.x, p.y, 15, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#f2e6d0';
        ctx.fillRect(p.x - 12, p.y + 14, 24, 8);
      } else {
        ctx.fillStyle = '#7a5230';
        ctx.fillRect(p.x - 2, p.y - 18, 4, 20);
        ctx.fillStyle = PALETTE.parkTree;
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + (i - 2) * 0.5;
          ctx.beginPath();
          ctx.ellipse(p.x + Math.cos(a) * 12, p.y - 18 + Math.sin(a) * 8, 12, 4, a, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  drawCar(ctx, car, isPlayer) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(-car.w / 2 + 3, -car.h / 2 + 4, car.w, car.h);
    ctx.fillStyle = car.color;
    ctx.beginPath();
    ctx.roundRect(-car.w / 2, -car.h / 2, car.w, car.h, 7);
    ctx.fill();
    ctx.fillStyle = 'rgba(20,30,44,0.85)';
    ctx.fillRect(-6, -car.h / 2 + 3, 16, car.h - 6);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillRect(car.w / 2 - 7, -car.h / 2 + 2, 3, 4);
    ctx.fillRect(car.w / 2 - 7, car.h / 2 - 6, 3, 4);
    ctx.fillStyle = '#e84a3d';
    ctx.fillRect(-car.w / 2 + 1, -car.h / 2 + 2, 3, 4);
    ctx.fillRect(-car.w / 2 + 1, car.h / 2 - 6, 3, 4);
    if (car.kind === 'police') {
      ctx.fillStyle = '#f2f2f2';
      ctx.fillRect(-14, -car.h / 2, 26, car.h);
      ctx.fillStyle = '#1c2733';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('POLICE', 0, 3);
      const blink = Math.sin(car.siren * 6) > 0;
      ctx.fillStyle = blink ? '#ff2d2d' : '#2d7bff';
      ctx.beginPath(); ctx.arc(-2, -car.h / 2 + 2, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = blink ? '#2d7bff' : '#ff2d2d';
      ctx.beginPath(); ctx.arc(-2, car.h / 2 - 2, 4, 0, Math.PI * 2); ctx.fill();
    }
    if (isPlayer) {
      ctx.strokeStyle = '#ffe14d';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-car.w / 2 - 3, -car.h / 2 - 3, car.w + 6, car.h + 6, 9);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawTraffic(ctx, game) {
    for (const car of game.traffic) this.drawCar(ctx, car, false);
    for (const car of game.police.cars) this.drawCar(ctx, car, false);
    for (const car of game.parkedCars) this.drawCar(ctx, car, car === game.missionCar);
  }

  drawPedestrians(ctx, game) {
    for (const ped of game.peds) {
      ctx.save();
      ctx.translate(ped.x, ped.y);
      if (ped.down) {
        ctx.rotate(Math.PI / 2);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath(); ctx.ellipse(0, 4, 12, 6, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = ped.skin;
      ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = ped.shirt;
      ctx.beginPath(); ctx.arc(0, 9, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2b2b33';
      ctx.fillRect(-8, 15, 6, 8);
      ctx.fillRect(2, 15, 6, 8);
      ctx.restore();
    }
    for (const cop of game.police.cops) {
      ctx.save();
      ctx.translate(cop.x, cop.y);
      ctx.rotate(cop.angle);
      ctx.fillStyle = '#1c2733';
      ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2d5a8a';
      ctx.beginPath(); ctx.arc(0, 9, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffe14d';
      ctx.fillRect(-4, 2, 8, 3);
      ctx.restore();
    }
  }

  drawPlayer(ctx, game) {
    const p = game.player;
    if (p.inCar && p.car) {
      this.drawCar(ctx, p.car, true);
      return;
    }
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    // Shadow, legs, jacket, head — Dana in her yellow courier jacket.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(2, 4, 12, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2b2b33';
    ctx.fillRect(-8, 12, 6, 9);
    ctx.fillRect(2, 12, 6, 9);
    ctx.fillStyle = '#f2c230';
    ctx.beginPath(); ctx.arc(0, 4, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8b88a';
    ctx.beginPath(); ctx.arc(8, 0, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a2a1a';
    ctx.beginPath(); ctx.arc(9, -3, 6, 0, Math.PI * 2); ctx.fill();
    if (p.punchTimer > 0.2) {
      ctx.fillStyle = '#e8b88a';
      ctx.beginPath(); ctx.arc(20, 0, 5, 0, Math.PI * 2); ctx.fill();
    }
    if (p.muzzle > 0) {
      ctx.fillStyle = '#ffd94d';
      ctx.beginPath(); ctx.arc(26, 0, 7, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    if (p.hurtTimer > 0) {
      ctx.fillStyle = 'rgba(255,40,40,0.12)';
      ctx.fillRect(p.x - 400, p.y - 300, 800, 600);
    }
  }

  drawPolice(ctx, game) {
    // Wanted flash on the screen edge when the heat is on.
    if (game.police.stars > 0) {
      const a = 0.05 + 0.03 * Math.sin(game.time * 6);
      ctx.fillStyle = `rgba(255,30,30,${a})`;
      const v = this.viewBounds(game.cam);
      ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, 14);
    }
  }

  drawMissionMarker(ctx, game) {
    const step = game.missions.step;
    if (!step || game.missions.done || game.missions.failed) return;
    if (step.kind !== 'goto' && step.kind !== 'driveTo' && step.kind !== 'steal') return;
    const pulse = 1 + 0.18 * Math.sin(game.time * 4);
    ctx.save();
    ctx.translate(step.x, step.y);
    ctx.strokeStyle = '#ffe14d';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, 34 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,225,77,0.25)';
    ctx.beginPath(); ctx.arc(0, 0, 34 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffe14d';
    ctx.beginPath(); ctx.moveTo(0, -52); ctx.lineTo(10, -30); ctx.lineTo(-10, -30); ctx.closePath(); ctx.fill();
    ctx.restore();
    // Off-screen arrow pointing at the objective.
    const p = game.player;
    const d = dist(p.x, p.y, step.x, step.y);
    if (d > 480) {
      const a = Math.atan2(step.y - p.y, step.x - p.x);
      const ex = p.x + Math.cos(a) * 190;
      const ey = p.y + Math.sin(a) * 140;
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(a);
      ctx.fillStyle = '#ffe14d';
      ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -9); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  drawParticles(ctx, game) {
    for (const pt of game.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.max);
      ctx.fillStyle = pt.color;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawHud(ctx, game) {
    const p = game.player;
    const pad = 14;
    // Cash and health panel.
    ctx.fillStyle = 'rgba(10,16,24,0.72)';
    ctx.beginPath(); ctx.roundRect(pad, pad, 250, 64, 10); ctx.fill();
    ctx.fillStyle = '#7ee787';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`$${p.cash.toLocaleString('en-US')}`, pad + 14, pad + 28);
    ctx.fillStyle = '#e8e8e8';
    ctx.font = '13px sans-serif';
    ctx.fillText(`SCORE ${p.score.toLocaleString('en-US')}   AMMO ${p.ammo}`, pad + 14, pad + 50);
    // Health bar.
    ctx.fillStyle = '#333';
    ctx.fillRect(pad + 150, pad + 16, 84, 12);
    ctx.fillStyle = p.health > 40 ? '#4ad97b' : '#e84a3d';
    ctx.fillRect(pad + 150, pad + 16, 84 * (p.health / 100), 12);
    ctx.fillStyle = '#e8e8e8';
    ctx.font = '11px sans-serif';
    ctx.fillText('HEALTH', pad + 150, pad + 44);
    // Wanted stars.
    ctx.fillStyle = 'rgba(10,16,24,0.72)';
    ctx.beginPath(); ctx.roundRect(this.W - 220, pad, 206, 44, 10); ctx.fill();
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i < game.police.stars ? '#ffd94d' : 'rgba(255,255,255,0.22)';
      const sx = this.W - 206 + i * 38;
      this.star(ctx, sx + 14, pad + 22, 13);
    }
    ctx.fillStyle = '#e8e8e8';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(districtAt(p.x, p.y), this.W - 14, pad + 64);
    // Objective banner.
    ctx.textAlign = 'center';
    const obj = game.missions.objective;
    ctx.font = 'bold 15px sans-serif';
    const w = ctx.measureText(obj).width + 36;
    ctx.fillStyle = 'rgba(10,16,24,0.72)';
    ctx.beginPath(); ctx.roundRect((this.W - w) / 2, pad, w, 34, 9); ctx.fill();
    ctx.fillStyle = '#ffe14d';
    ctx.fillText(obj, this.W / 2, pad + 22);
    // Step timer.
    if (game.missions.step && game.missions.step.time && !game.missions.done) {
      ctx.fillStyle = game.missions.stepTimer < 15 ? '#ff6b5e' : '#e8e8e8';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(`⏱ ${Math.ceil(game.missions.stepTimer)}s`, this.W / 2, pad + 56);
    }
    // Mission toast message.
    if (game.missions.messageTimer > 0) {
      ctx.font = '14px sans-serif';
      const msg = game.missions.message;
      const mw = Math.min(this.W - 80, ctx.measureText(msg).width + 30);
      ctx.fillStyle = 'rgba(10,16,24,0.78)';
      ctx.beginPath(); ctx.roundRect((this.W - mw) / 2, this.H - 118, mw, 30, 8); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(msg, this.W / 2, this.H - 98);
    }
    // Speed and controls.
    ctx.textAlign = 'left';
    ctx.font = '13px sans-serif';
    ctx.fillStyle = 'rgba(232,232,232,0.9)';
    if (p.inCar) {
      const kmh = Math.round(Math.abs(p.speed) * 0.9);
      ctx.fillStyle = 'rgba(10,16,24,0.72)';
      ctx.beginPath(); ctx.roundRect(pad, this.H - 52, 190, 38, 9); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(`${kmh} km/h`, pad + 14, this.H - 26);
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#c8c8c8';
      ctx.fillText(p.car ? p.car.model : '', pad + 104, this.H - 26);
    }
    ctx.font = '12px sans-serif';
    ctx.fillStyle = 'rgba(232,232,232,0.75)';
    ctx.fillText('WASD move / drive   E enter car   SPACE punch / brake   F shoot   M mute   S save   ESC pause', pad, this.H - 62);
    ctx.textAlign = 'left';
  }

  star(ctx, x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 === 0 ? r : r * 0.45;
      const px = x + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  drawMinimap(ctx, game) {
    const mw = 200;
    const mh = 150;
    const mx = this.W - mw - 14;
    const my = this.H - mh - 14;
    const sx = mw / WORLD_W;
    const sy = mh / WORLD_H;
    ctx.fillStyle = 'rgba(10,16,24,0.78)';
    ctx.beginPath(); ctx.roundRect(mx - 6, my - 6, mw + 12, mh + 12, 10); ctx.fill();
    ctx.save();
    ctx.beginPath(); ctx.rect(mx, my, mw, mh); ctx.clip();
    ctx.fillStyle = '#5d8a4a';
    ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = '#e8c878';
    ctx.fillRect(mx, BEACH_Y * sy + my, mw, (WORLD_H - BEACH_Y) * sy);
    ctx.fillStyle = '#2f7fb8';
    ctx.fillRect(mx, WATER_Y * sy + my, mw, (WORLD_H - WATER_Y) * sy);
    ctx.fillStyle = '#3d3a38';
    for (const rx of ROADS_X) ctx.fillRect(mx + rx * sx - 2, my, 4, BEACH_Y * sy);
    for (const ry of ROADS_Y) ctx.fillRect(mx, my + ry * sy - 2, mw, 4);
    // Mission marker.
    const step = game.missions.step;
    if (step && (step.kind === 'goto' || step.kind === 'driveTo' || step.kind === 'steal') && !game.missions.done) {
      ctx.fillStyle = '#ffe14d';
      ctx.beginPath(); ctx.arc(mx + step.x * sx, my + step.y * sy, 5, 0, Math.PI * 2); ctx.fill();
    }
    // Police blips.
    ctx.fillStyle = '#ff4d4d';
    for (const c of game.police.cars) {
      ctx.beginPath(); ctx.arc(mx + c.x * sx, my + c.y * sy, 3, 0, Math.PI * 2); ctx.fill();
    }
    // Player arrow.
    ctx.save();
    ctx.translate(mx + game.player.x * sx, my + game.player.y * sy);
    ctx.rotate(game.player.angle);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-6, -5); ctx.lineTo(-6, 5); ctx.closePath(); ctx.fill();
    ctx.restore();
    // View rectangle.
    const v = this.viewBounds(game.cam);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(mx + v.x0 * sx, my + v.y0 * sy, (v.x1 - v.x0) * sx, (v.y1 - v.y0) * sy);
    ctx.restore();
    ctx.fillStyle = '#e8e8e8';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('SOLMAR BAY', mx, my - 12);
  }

  panel(ctx, title, lines, accent) {
    ctx.fillStyle = 'rgba(8,14,22,0.82)';
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.textAlign = 'center';
    ctx.fillStyle = accent || '#ffe14d';
    ctx.font = 'bold 54px sans-serif';
    ctx.fillText(title, this.W / 2, 190);
    ctx.fillStyle = '#ffffff';
    ctx.font = '17px sans-serif';
    let y = 250;
    for (const line of lines) {
      ctx.fillText(line, this.W / 2, y);
      y += 30;
    }
    return y;
  }

  drawTitle(ctx, game) {
    const y = this.panel(ctx, 'SOLMAR BAY', [
      'An original open-world crime game in the sun-soaked city of Solmar Bay.',
      'Dana Reyes, courier by day, wheelman by night, owes Mama Sol five jobs.',
      'Steal cars, outrun the Solmar police, and finish the Big Score.',
      '',
      'WASD / arrows — move and drive    E — enter / exit a car',
      'SPACE — punch on foot, handbrake in a car    F — shoot    SHIFT — run',
      'S — save    M — mute    ESC — pause',
      '',
      `Missions: ${game.missions.index + 1} of 5   •   Cash $${game.player.cash}   •   Best score ${game.bestScore}`,
    ]);
    ctx.fillStyle = '#ffe14d';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('PRESS ENTER OR CLICK TO PLAY', this.W / 2, y + 30);
    if (game.hasSaveData) {
      ctx.fillStyle = '#7ee787';
      ctx.font = '15px sans-serif';
      ctx.fillText('Saved game found — press C to continue it', this.W / 2, y + 62);
    }
    ctx.fillStyle = 'rgba(232,232,232,0.7)';
    ctx.font = '12px sans-serif';
    ctx.fillText('A fully original game. No real city, person or brand appears in it.', this.W / 2, this.H - 24);
  }

  drawPaused(ctx, game) {
    this.panel(ctx, 'PAUSED', [
      `Mission ${game.missions.index + 1}: ${game.missions.current ? game.missions.current.title : '—'}`,
      game.missions.objective,
      `Cash $${game.player.cash}   •   Health ${Math.round(game.player.health)}   •   Wanted ${game.police.stars} star${game.police.stars === 1 ? '' : 's'}`,
      '',
      'ESC — resume    S — save    R — restart the current job    Q — quit to title',
    ]);
  }

  drawBusted(ctx, game) {
    const y = this.panel(ctx, 'BUSTED', [
      'The Solmar police finally caught up with Dana.',
      game.player.lastDamage ? `Last hit: ${game.player.lastDamage}.` : '',
      `You lost $${game.bustedLoss} of your cash at the precinct.`,
      '',
      'PRESS ENTER TO GET BACK ON THE STREETS',
    ], '#ff6b5e');
    void y;
  }

  drawComplete(ctx, game) {
    this.panel(ctx, 'SOLMAR BAY IS YOURS', [
      'Dana finished all five jobs. The Big Score is done.',
      `Final cash $${game.player.cash}   •   Score ${game.player.score}`,
      '',
      'PRESS ENTER TO KEEP EXPLORING THE CITY',
    ], '#7ee787');
  }
}
