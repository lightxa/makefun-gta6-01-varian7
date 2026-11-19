// render.js — everything the player sees: the sun-soaked city, the cars and
// people in it, and the HUD with its minimap, wanted stars and mission card.
// The camera follows the player and the world is drawn in layers so the
// screenshots read at a glance: streets, buildings, traffic, police, marker.
import { WORLD_W, WORLD_H, ROAD_STEP, SEA_X, BEACH_W, COLORS } from './config.js';
import { districtAt, roadXs, roadYs } from './world.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.camX = 0;
    this.camY = 0;
    this.zoom = 1;
  }

  resize(w, h) {
    this.canvas.width = w;
    this.canvas.height = h;
  }

  updateCamera(game) {
    const p = game.player;
    const tx = p.x - this.canvas.width / 2;
    const ty = p.y - this.canvas.height / 2;
    this.camX += (tx - this.camX) * 0.12;
    this.camY += (ty - this.camY) * 0.12;
    // Never show past the world's edge: the ground is only drawn inside
    // the world, so the camera stops where the world does.
    const maxX = Math.max(0, WORLD_W - this.canvas.width);
    const maxY = Math.max(0, WORLD_H - this.canvas.height);
    this.camX = Math.max(0, Math.min(maxX, this.camX));
    this.camY = Math.max(0, Math.min(maxY, this.camY));
  }

  draw(game) {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    ctx.clearRect(0, 0, W, H);
    this.updateCamera(game);
    ctx.save();
    ctx.translate(-Math.round(this.camX), -Math.round(this.camY));
    this.drawGround(ctx, game);
    this.drawRoads(ctx, game);
    this.drawParks(ctx, game);
    this.drawBuildings(ctx, game);
    this.drawTrees(ctx, game);
    this.drawCoins(ctx, game);
    this.drawMarkers(ctx, game);
    this.drawSkids(ctx, game);
    for (const car of game.traffic.cars) this.drawCar(ctx, car, false);
    for (const car of game.police.copCars) this.drawCar(ctx, car, true);
    for (const ped of game.traffic.peds) this.drawPed(ctx, ped);
    for (const o of game.police.officers) this.drawOfficer(ctx, o);
    this.drawPlayer(ctx, game);
    this.drawParticles(ctx, game);
    ctx.restore();
    this.drawVignette(ctx, W, H);
    this.drawHud(ctx, game, W, H);
    this.drawMinimap(ctx, game, W, H);
    this.drawToasts(ctx, game, W, H);
  }

  drawGround(ctx, game) {
    const x0 = Math.max(0, this.camX - 60);
    const y0 = Math.max(0, this.camY - 60);
    const x1 = Math.min(WORLD_W, this.camX + this.canvas.width + 60);
    const y1 = Math.min(WORLD_H, this.camY + this.canvas.height + 60);
    ctx.fillStyle = COLORS.grass;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    // Mow stripes so the grass reads as lawns, not flat color.
    ctx.fillStyle = COLORS.grassDark;
    const stripe = 120;
    for (let y = Math.floor(y0 / stripe) * stripe; y < y1; y += stripe * 2) {
      ctx.fillRect(x0, y, x1 - x0, stripe);
    }
    // The sea and the beach along the west edge.
    ctx.fillStyle = COLORS.seaDeep;
    ctx.fillRect(0, y0, SEA_X, y1 - y0);
    ctx.fillStyle = COLORS.sea;
    ctx.fillRect(30, y0, SEA_X - 30, y1 - y0);
    ctx.fillStyle = COLORS.sand;
    ctx.fillRect(SEA_X, y0, BEACH_W, y1 - y0);
    // Foam line where the water meets the sand.
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (let y = Math.floor(y0 / 90) * 90; y < y1; y += 90) {
      ctx.fillRect(SEA_X - 6, y, 10, 26);
    }
    // District tint: a warm wash over each part of town.
    for (const d of game.worldDistricts) {
      ctx.fillStyle = 'rgba(255,220,150,0.05)';
      ctx.fillRect(d.x0, d.y0, d.x1 - d.x0, d.y1 - d.y0);
    }
  }

  drawRoads(ctx, game) {
    ctx.fillStyle = COLORS.roadEdge;
    for (const rx of roadXs()) ctx.fillRect(rx - 40, 0, 80, WORLD_H);
    for (const ry of roadYs()) ctx.fillRect(0, ry - 40, WORLD_W, 80);
    ctx.fillStyle = COLORS.road;
    for (const rx of roadXs()) ctx.fillRect(rx - 34, 0, 68, WORLD_H);
    for (const ry of roadYs()) ctx.fillRect(0, ry - 34, WORLD_W, 68);
    // Sidewalks.
    ctx.fillStyle = COLORS.sidewalk;
    for (const rx of roadXs()) {
      ctx.fillRect(rx - 48, 0, 8, WORLD_H);
      ctx.fillRect(rx + 40, 0, 8, WORLD_H);
    }
    for (const ry of roadYs()) {
      ctx.fillRect(0, ry - 48, WORLD_W, 8);
      ctx.fillRect(0, ry + 40, WORLD_W, 8);
    }
    // Lane dashes.
    ctx.fillStyle = COLORS.lane;
    for (const rx of roadXs()) {
      for (let y = 0; y < WORLD_H; y += 56) ctx.fillRect(rx - 2, y, 4, 26);
    }
    for (const ry of roadYs()) {
      for (let x = 0; x < WORLD_W; x += 56) ctx.fillRect(x, ry - 2, 26, 4);
    }
    // Crosswalks at every intersection.
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (const rx of roadXs()) {
      for (const ry of roadYs()) {
        for (let i = -3; i <= 3; i++) {
          ctx.fillRect(rx + i * 10 - 3, ry - 46, 6, 12);
          ctx.fillRect(rx + i * 10 - 3, ry + 34, 6, 12);
        }
      }
    }
    // Road names on the two main avenues.
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const ry of roadYs()) {
      ctx.fillText('PALM AVE', 1000, ry - 52);
      ctx.fillText('BAY BLVD', 2400, ry + 66);
    }
  }

  drawParks(ctx, game) {
    for (const p of game.world.parks) {
      ctx.fillStyle = COLORS.park;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.strokeStyle = '#4a7a30';
      ctx.lineWidth = 4;
      ctx.strokeRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.name.toUpperCase(), p.x + p.w / 2, p.y + 26);
      ctx.fillStyle = '#7fb2d9';
      ctx.beginPath();
      ctx.arc(p.x + p.w / 2, p.y + p.h / 2, 46, 0, Math.PI * 2);
      ctx.fill();
    }
    const pl = game.world.plaza;
    ctx.fillStyle = COLORS.plaza;
    ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
    ctx.strokeStyle = '#a89e88';
    ctx.lineWidth = 4;
    ctx.strokeRect(pl.x, pl.y, pl.w, pl.h);
    ctx.fillStyle = '#5a5344';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SOLMAR PLAZA', pl.x + pl.w / 2, pl.y + 26);
  }

  drawBuildings(ctx, game) {
    for (const b of game.world.buildings) {
      if (b.x + b.w < this.camX - 40 || b.x > this.camX + this.canvas.width + 40) continue;
      if (b.y + b.h < this.camY - 40 || b.y > this.camY + this.canvas.height + 40) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      const inset = b.tall ? 14 : 10;
      ctx.fillRect(b.x + inset, b.y + inset, b.w - inset * 2, b.h - inset * 2);
      // Windows on tall towers.
      if (b.tall) {
        ctx.fillStyle = 'rgba(255,255,200,0.85)';
        for (let wx = b.x + 22; wx < b.x + b.w - 22; wx += 26) {
          for (let wy = b.y + 22; wy < b.y + b.h - 22; wy += 26) {
            ctx.fillRect(wx, wy, 12, 14);
          }
        }
      } else {
        ctx.fillStyle = '#2c2f36';
        ctx.fillRect(b.x + b.w / 2 - 9, b.y + b.h - 4, 18, 6);
      }
      if (b.name) {
        ctx.fillStyle = 'rgba(40,30,20,0.8)';
        ctx.font = 'bold 12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(b.name, b.x + b.w / 2, b.y - 6);
      }
    }
  }

  drawTrees(ctx, game) {
    for (const t of game.world.trees) {
      if (t.x < this.camX - 40 || t.x > this.camX + this.canvas.width + 40) continue;
      if (t.y < this.camY - 40 || t.y > this.camY + this.canvas.height + 40) continue;
      ctx.fillStyle = '#6a4a2a';
      ctx.fillRect(t.x - 2, t.y - 2, 4, 8);
      ctx.fillStyle = t.palm ? '#3f9e4d' : '#2f7a3a';
      ctx.beginPath();
      ctx.arc(t.x, t.y - 6, t.palm ? 13 : 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.arc(t.x - 4, t.y - 10, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawCoins(ctx, game) {
    for (const c of game.world.coins) {
      if (c.taken) continue;
      const pulse = 1 + Math.sin(game.time * 4 + c.x) * 0.15;
      ctx.fillStyle = '#ffd94a';
      ctx.beginPath();
      ctx.arc(c.x, c.y, 11 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#b8860b';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', c.x, c.y + 5);
    }
  }

  drawMarkers(ctx, game) {
    const targets = [];
    const missionTarget = game.missions.stepTarget();
    if (missionTarget) targets.push({ ...missionTarget, color: '#ffd94a', label: 'JOB' });
    const taxiTarget = game.taxi.target();
    if (taxiTarget) targets.push({ x: taxiTarget.x, y: taxiTarget.y, r: 60, color: '#7fd9ff', label: 'TAXI' });
    if (!game.missions.active && game.missionIndex < 5) {
      targets.push({ x: game.world.garage.x, y: game.world.garage.y, r: 80, color: '#ffd94a', label: 'JOB' });
    }
    for (const t of targets) {
      const bob = Math.sin(game.time * 3) * 6;
      ctx.strokeStyle = t.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = t.color;
      ctx.beginPath();
      ctx.moveTo(t.x, t.y - 58 + bob);
      ctx.lineTo(t.x - 12, t.y - 82 + bob);
      ctx.lineTo(t.x + 12, t.y - 82 + bob);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#1a1a1a';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(t.label, t.x, t.y - 66 + bob);
    }
  }

  drawSkids(ctx, game) {
    ctx.fillStyle = 'rgba(20,20,20,0.35)';
    for (const s of game.skids) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.angle);
      ctx.fillRect(-12, -3, 24, 6);
      ctx.restore();
    }
  }

  drawCar(ctx, car, isCop) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-20, -11 + 4, 44, 24);
    // Body.
    ctx.fillStyle = car.color;
    roundRect(ctx, -22, -12, 44, 24, 7);
    ctx.fill();
    // Cabin and windshield.
    ctx.fillStyle = isCop ? '#dfe8f2' : '#20242c';
    roundRect(ctx, -8, -10, 18, 20, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(160,210,240,0.9)';
    ctx.fillRect(6, -9, 5, 18);
    // Headlights and taillights.
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(20, -10, 3, 5);
    ctx.fillRect(20, 5, 3, 5);
    ctx.fillStyle = '#ff4a3d';
    ctx.fillRect(-23, -10, 3, 5);
    ctx.fillRect(-23, 5, 3, 5);
    if (isCop) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SBPD', 0, 3);
      const phase = Math.floor(performance.now() / 260) % 2 === 0;
      ctx.fillStyle = phase ? '#ff2d2d' : '#2d6bff';
      ctx.beginPath();
      ctx.arc(-14, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = phase ? '#2d6bff' : '#ff2d2d';
      ctx.beginPath();
      ctx.arc(-6, 0, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    if (car.isPlayerCar) {
      ctx.strokeStyle = 'rgba(255,217,74,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(car.x, car.y, 34, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  drawPed(ctx, ped) {
    const bob = Math.sin(ped.bob) * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(ped.x, ped.y + 8, 7, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.skin;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y - 6 + bob * 0.3, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.shirt;
    ctx.fillRect(ped.x - 6, ped.y - 2 + bob * 0.3, 12, 12);
    ctx.fillStyle = '#2c2f36';
    ctx.fillRect(ped.x - 6, ped.y + 9, 5, 6);
    ctx.fillRect(ped.x + 1, ped.y + 9, 5, 6);
  }

  drawOfficer(ctx, o) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(o.x, o.y + 8, 7, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8c39a';
    ctx.beginPath();
    ctx.arc(o.x, o.y - 6, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a2a4a';
    ctx.fillRect(o.x - 7, o.y - 2, 14, 13);
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 8px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PD', o.x, o.y + 6);
    ctx.fillStyle = '#1a2a4a';
    ctx.fillRect(o.x - 7, o.y + 10, 5, 6);
    ctx.fillRect(o.x + 2, o.y + 10, 5, 6);
  }

  drawPlayer(ctx, game) {
    const p = game.player;
    if (!p.onFoot) return;
    const bob = Math.sin(game.time * 9) * 1.5;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 9, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    // Rico Vega: teal jacket, dark jeans, the driver's look.
    ctx.fillStyle = '#e8c39a';
    ctx.beginPath();
    ctx.arc(p.x, p.y - 7 + bob * 0.3, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath();
    ctx.arc(p.x, p.y - 9 + bob * 0.3, 7, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#1f8a7a';
    ctx.fillRect(p.x - 7, p.y - 2 + bob * 0.3, 14, 13);
    ctx.fillStyle = '#2c2f36';
    ctx.fillRect(p.x - 7, p.y + 10, 6, 7);
    ctx.fillRect(p.x + 1, p.y + 10, 6, 7);
    if (p.punchTimer > 0) {
      ctx.fillStyle = '#e8c39a';
      ctx.beginPath();
      ctx.arc(p.x + Math.cos(p.angle) * 22, p.y + Math.sin(p.angle) * 22, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 20, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawParticles(ctx, game) {
    for (const pt of game.particles) {
      ctx.fillStyle = pt.color;
      ctx.globalAlpha = Math.max(0, pt.life / pt.max);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawVignette(ctx, W, H) {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(255,200,120,0)');
    g.addColorStop(1, 'rgba(255,170,60,0.14)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  drawHud(ctx, game, W, H) {
    const p = game.player;
    // Top-left: cash, health, clock.
    ctx.fillStyle = 'rgba(10,14,20,0.72)';
    roundRect(ctx, 12, 12, 210, 86, 10);
    ctx.fill();
    ctx.fillStyle = '#7dff9a';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`$${p.cash.toLocaleString('en-US')}`, 26, 44);
    ctx.fillStyle = '#ffffff';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(`RICO VEGA  •  ${game.clockText()}`, 26, 66);
    // Health bar.
    ctx.fillStyle = '#333';
    ctx.fillRect(26, 74, 120, 10);
    ctx.fillStyle = p.health > 40 ? '#7dff9a' : '#ff5a4a';
    ctx.fillRect(26, 74, 120 * (p.health / 100), 10);
    ctx.fillStyle = '#ffffff';
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillText(`${Math.ceil(p.health)} HP`, 152, 83);
    // Wanted stars, top center.
    const stars = game.police.wanted;
    ctx.fillStyle = 'rgba(10,14,20,0.72)';
    roundRect(ctx, W / 2 - 100, 12, 200, 44, 10);
    ctx.fill();
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i < stars ? '#ffd94a' : 'rgba(255,255,255,0.25)';
      ctx.font = '26px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('★', W / 2 - 72 + i * 36, 44);
    }
    if (game.police.crimeTimer > 0 && game.police.lastCrime) {
      ctx.fillStyle = '#ffb0a8';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillText(game.police.lastCrime, W / 2, 76);
    }
    // Speed and car, bottom-right.
    if (!p.onFoot && p.car) {
      ctx.fillStyle = 'rgba(10,14,20,0.72)';
      roundRect(ctx, W - 222, H - 92, 210, 80, 10);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 30px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.round(Math.abs(p.car.speed) * 0.9)}`, W - 66, H - 46);
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillText('mph', W - 34, H - 46);
      ctx.textAlign = 'left';
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillText(p.car.name, W - 208, H - 46);
      ctx.fillStyle = '#9ab';
      ctx.fillText('E exit  •  Space handbrake', W - 208, H - 26);
    } else {
      ctx.fillStyle = 'rgba(10,14,20,0.72)';
      roundRect(ctx, W - 222, H - 62, 210, 50, 10);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '13px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('On foot — E steals a car', W - 208, H - 32);
    }
    // Mission card, bottom-left.
    const obj = game.missions.objectiveText();
    if (obj) {
      ctx.fillStyle = 'rgba(10,14,20,0.78)';
      roundRect(ctx, 12, H - 96, 330, 84, 10);
      ctx.fill();
      ctx.fillStyle = '#ffd94a';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`JOB: ${obj.title}`, 26, H - 66);
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px system-ui, sans-serif';
      ctx.fillText(obj.label, 26, H - 42);
      ctx.fillStyle = '#9ab';
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillText('Follow the yellow marker', 26, H - 22);
    } else if (game.missionIndex < 5) {
      ctx.fillStyle = 'rgba(10,14,20,0.78)';
      roundRect(ctx, 12, H - 96, 330, 84, 10);
      ctx.fill();
      ctx.fillStyle = '#ffd94a';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('NO JOB ACTIVE', 26, H - 66);
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px system-ui, sans-serif';
      ctx.fillText('Drive to the yellow JOB marker to start', 26, H - 42);
      ctx.fillText('the next job for Marisol.', 26, H - 22);
    } else {
      ctx.fillStyle = 'rgba(10,14,20,0.78)';
      roundRect(ctx, 12, H - 96, 330, 84, 10);
      ctx.fill();
      ctx.fillStyle = '#7dff9a';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('KING OF THE BAY', 26, H - 66);
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px system-ui, sans-serif';
      ctx.fillText('Every job done. Solmar Bay is yours, Rico.', 26, H - 42);
    }
    // District label, bottom center.
    const d = districtAt(p.x, p.y);
    ctx.fillStyle = 'rgba(10,14,20,0.6)';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const labelW = ctx.measureText(d.name.toUpperCase()).width + 28;
    roundRect(ctx, W / 2 - labelW / 2, H - 34, labelW, 24, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(d.name.toUpperCase(), W / 2, H - 17);
  }

  drawMinimap(ctx, game, W, H) {
    const size = 168;
    const x0 = W - size - 12;
    const y0 = 108;
    const scale = size / WORLD_W;
    ctx.fillStyle = 'rgba(10,14,20,0.78)';
    roundRect(ctx, x0 - 6, y0 - 6, size + 12, size + 12, 10);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, size, size);
    ctx.clip();
    ctx.fillStyle = '#5d8a45';
    ctx.fillRect(x0, y0, size, size);
    ctx.fillStyle = '#2e7fa8';
    ctx.fillRect(x0, y0, SEA_X * scale, size);
    ctx.fillStyle = '#3a3d44';
    for (const rx of roadXs()) ctx.fillRect(x0 + rx * scale - 1, y0, 2, size);
    for (const ry of roadYs()) ctx.fillRect(x0, y0 + ry * scale - 1, size, 2);
    ctx.fillStyle = '#7fae5a';
    for (const p of game.world.parks) ctx.fillRect(x0 + p.x * scale, y0 + p.y * scale, p.w * scale, p.h * scale);
    // Mission marker.
    const mt = game.missions.stepTarget();
    if (mt) {
      ctx.fillStyle = '#ffd94a';
      ctx.beginPath();
      ctx.arc(x0 + mt.x * scale, y0 + mt.y * scale, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    const tt = game.taxi.target();
    if (tt) {
      ctx.fillStyle = '#7fd9ff';
      ctx.beginPath();
      ctx.arc(x0 + tt.x * scale, y0 + tt.y * scale, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // Police blips.
    ctx.fillStyle = '#4a90ff';
    for (const car of game.police.copCars) {
      ctx.beginPath();
      ctx.arc(x0 + car.x * scale, y0 + car.y * scale, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player arrow.
    const px = x0 + game.player.x * scale;
    const py = y0 + game.player.y * scale;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(game.player.angle);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(-6, -5);
    ctx.lineTo(-6, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('SOLMAR BAY', x0, y0 + size + 18);
  }

  drawToasts(ctx, game, W, H) {
    let y = 120;
    for (const t of game.toasts) {
      const alpha = Math.min(1, t.life / 0.8);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(10,14,20,0.85)';
      const w = Math.max(ctx.measureText(t.title).width, ctx.measureText(t.body).width) + 40;
      roundRect(ctx, W / 2 - w / 2, y, w, 58, 10);
      ctx.fill();
      ctx.fillStyle = '#ffd94a';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(t.title, W / 2, y + 24);
      ctx.fillStyle = '#ffffff';
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillText(t.body, W / 2, y + 44);
      ctx.globalAlpha = 1;
      y += 68;
    }
  }
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
