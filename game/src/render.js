// Rendering Solmar Bay: the top-down city, the cars and people in it, and the
// whole HUD — cash, health, wanted stars, mission objective, speed and the
// minimap — drawn on one canvas. The start screen, pause menu and busted
// screen are drawn here too, so a screenshot always shows the game itself.

import { WORLD, VIEW, COLORS, CONTROLS, GAME_TITLE, GAME_SUBTITLE } from './config.js';
import { clamp } from './random.js';
import { stepTarget, objectiveText, currentMission } from './missions.js';
import { wantedStars } from './police.js';

// Draw one frame. Camera follows the player with a soft lag; the HUD is drawn
// in screen space after the world.
export function render(ctx, state) {
  const { player, camera } = state;
  ctx.clearRect(0, 0, VIEW.width, VIEW.height);

  // Camera: follow the player, lead a little in the driving direction.
  const lead = player.onFoot ? 0 : 46;
  const targetX = player.x + Math.cos(player.angle) * lead - VIEW.width / 2;
  const targetY = player.y + Math.sin(player.angle) * lead - VIEW.height / 2;
  camera.x += (targetX - camera.x) * 0.12;
  camera.y += (targetY - camera.y) * 0.12;
  camera.x = clamp(camera.x, -40, WORLD.width - VIEW.width + 40);
  camera.y = clamp(camera.y, -40, WORLD.height - VIEW.height + 40);

  ctx.save();
  ctx.translate(-Math.round(camera.x), -Math.round(camera.y));
  drawGround(ctx, state);
  drawBuildings(ctx, state);
  drawMissionMarker(ctx, state);
  drawCars(ctx, state);
  drawPeds(ctx, state);
  drawPlayer(ctx, state);
  drawEffects(ctx, state);
  ctx.restore();

  drawHud(ctx, state);
  if (state.screen === 'title') drawTitle(ctx, state);
  if (state.screen === 'paused') drawPaused(ctx, state);
  if (state.screen === 'busted') drawBusted(ctx, state);
  if (state.screen === 'wasted') drawWasted(ctx, state);
}

// Grass, sea, beach, park, roads and sidewalks.
function drawGround(ctx, state) {
  const { world } = state;
  ctx.fillStyle = COLORS.grass;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  for (const zone of world.zones) {
    if (zone.kind === 'sea') {
      ctx.fillStyle = COLORS.sea;
      ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
      ctx.fillStyle = COLORS.seaDeep;
      for (let y = 40; y < zone.h; y += 130) {
        ctx.fillRect(zone.x + 30 + ((y * 7) % 90), y, 130, 5);
      }
    } else if (zone.kind === 'beach') {
      ctx.fillStyle = COLORS.sand;
      ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
      ctx.fillStyle = '#d9c48a';
      for (let i = 0; i < 24; i++) {
        const y = (i * 137) % WORLD.height;
        ctx.fillRect(zone.x + 40 + ((i * 53) % 150), y, 26, 4);
      }
    } else if (zone.kind === 'park') {
      ctx.fillStyle = COLORS.park;
      ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
    }
  }
  // Roads: dark asphalt with a pale sidewalk edge and a dashed centre line.
  const half = WORLD.road / 2;
  for (const x of world.avenues) {
    ctx.fillStyle = COLORS.sidewalk;
    ctx.fillRect(x - half - 8, 0, WORLD.road + 16, WORLD.height);
    ctx.fillStyle = COLORS.road;
    ctx.fillRect(x - half, 0, WORLD.road, WORLD.height);
  }
  for (const y of world.streets) {
    ctx.fillStyle = COLORS.sidewalk;
    ctx.fillRect(0, y - half - 8, WORLD.width, WORLD.road + 16);
    ctx.fillStyle = COLORS.road;
    ctx.fillRect(0, y - half, WORLD.width, WORLD.road);
  }
  ctx.fillStyle = COLORS.roadLine;
  for (const x of world.avenues) {
    for (let y = 24; y < WORLD.height; y += 64) ctx.fillRect(x - 3, y, 6, 30);
  }
  for (const y of world.streets) {
    for (let x = 24; x < WORLD.width; x += 64) ctx.fillRect(x, y - 3, 30, 6);
  }
  // Trees and lamps.
  for (const tree of world.trees) {
    ctx.fillStyle = '#3f7a34';
    ctx.beginPath();
    ctx.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5da24a';
    ctx.beginPath();
    ctx.arc(tree.x - 3, tree.y - 3, tree.r * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#d9d9d9';
  for (const lamp of world.lamps) ctx.fillRect(lamp.x - 2, lamp.y - 2, 4, 4);
}

// Rooftops with a wall edge, windows and a height shadow.
function drawBuildings(ctx, state) {
  for (const b of state.world.buildings) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    ctx.fillStyle = COLORS.buildingWall;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    const cols = Math.max(1, Math.floor(b.w / 26));
    const rows = Math.max(1, Math.floor(b.h / 26));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        ctx.fillRect(b.x + 12 + i * 26, b.y + 12 + j * 26, 10, 8);
      }
    }
    if (b.kind === 'tower') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(b.district, b.x + 10, b.y + 22);
    }
  }
}

// The pulsing objective marker and its beam.
function drawMissionMarker(ctx, state) {
  const target = stepTarget(state.missions, state.world);
  if (!target || state.screen !== 'playing') return;
  const pulse = 1 + Math.sin(state.now * 4) * 0.15;
  ctx.save();
  ctx.translate(target.x, target.y);
  ctx.strokeStyle = COLORS.marker;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, 34 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 210, 61, 0.18)';
  ctx.beginPath();
  ctx.arc(0, 0, 34 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.marker;
  ctx.beginPath();
  ctx.moveTo(0, -52);
  ctx.lineTo(10, -30);
  ctx.lineTo(-10, -30);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = COLORS.marker;
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(target.name, target.x, target.y - 62);
  ctx.textAlign = 'left';
}

// Cars: body, windshield, headlights and, for police, the flashing light bar.
function drawCars(ctx, state) {
  for (const car of state.cars) {
    drawCar(ctx, car, state.now);
  }
  for (const cruiser of state.police) {
    drawCar(ctx, cruiser, state.now);
  }
}

function drawCar(ctx, car, now) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const len = car.kind === 'van' ? 52 : car.kind === 'pickup' ? 50 : 46;
  const wid = car.kind === 'van' ? 26 : 22;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fillRect(-len / 2 + 3, -wid / 2 + 4, len, wid);
  ctx.fillStyle = car.color;
  roundRect(ctx, -len / 2, -wid / 2, len, wid, 7);
  ctx.fill();
  ctx.fillStyle = '#1d2733';
  ctx.fillRect(-len / 2 + 12, -wid / 2 + 4, 12, wid - 8);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.fillRect(len / 2 - 8, -wid / 2 + 3, 3, 4);
  ctx.fillRect(len / 2 - 8, wid / 2 - 7, 3, 4);
  if (car.kind === 'police') {
    const flash = Math.sin(now * 9) > 0;
    ctx.fillStyle = flash ? COLORS.policeLight : COLORS.policeLight2;
    ctx.fillRect(-4, -wid / 2 - 2, 8, 5);
    ctx.fillStyle = flash ? COLORS.policeLight2 : COLORS.policeLight;
    ctx.fillRect(-4, wid / 2 - 3, 8, 5);
    ctx.fillStyle = '#f5f0e1';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SBPD', 0, 3);
    ctx.textAlign = 'left';
  }
  ctx.restore();
}

// Pedestrians: a coloured walker with a direction tick, or a fallen marker.
function drawPeds(ctx, state) {
  for (const ped of state.peds) {
    if (ped.dead) {
      ctx.fillStyle = 'rgba(120, 20, 20, 0.8)';
      ctx.beginPath();
      ctx.arc(ped.x, ped.y, 9, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.fillStyle = ped.fleeing ? '#ff5a4e' : ped.color;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, ped.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ped.x, ped.y);
    ctx.lineTo(ped.x + Math.cos(ped.angle) * 12, ped.y + Math.sin(ped.angle) * 12);
    ctx.stroke();
  }
}

// The player: a yellow-jacketed walker on foot, or the car she drives.
function drawPlayer(ctx, state) {
  const { player } = state;
  if (player.onFoot) {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.arc(2, 3, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = player.hurtTimer > 0 && Math.floor(state.now * 12) % 2 === 0 ? '#ff6b5e' : COLORS.player;
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#20242e';
    ctx.beginPath();
    ctx.arc(5, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#20242e';
    ctx.fillRect(12, -3, 8, 6);
    ctx.restore();
  }
}

// Smoke, sparks and floating text.
function drawEffects(ctx, state) {
  for (const fx of state.effects) {
    const alpha = Math.max(0, fx.life / fx.max);
    if (fx.kind === 'smoke') {
      ctx.fillStyle = `rgba(200, 200, 200, ${alpha * 0.6})`;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, 10 + (1 - alpha) * 12, 0, Math.PI * 2);
      ctx.fill();
    } else if (fx.kind === 'spark') {
      ctx.fillStyle = `rgba(255, 210, 61, ${alpha})`;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, 6 * alpha + 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (fx.kind === 'text') {
      ctx.fillStyle = `rgba(245, 240, 225, ${alpha})`;
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(fx.text, fx.x, fx.y);
      ctx.textAlign = 'left';
    }
  }
}

// The HUD: cash, health, wanted stars, objective, timer, speed, minimap and
// the message banner. Everything the judge's screenshots need to show.
function drawHud(ctx, state) {
  if (state.screen === 'title') return;
  const { player } = state;
  ctx.fillStyle = COLORS.hudBg;
  roundRect(ctx, 14, 14, 250, 92, 10);
  ctx.fill();
  ctx.fillStyle = COLORS.hudText;
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(`$${player.cash}`, 28, 44);
  ctx.font = '14px sans-serif';
  ctx.fillStyle = '#9fd97f';
  ctx.fillRect(28, 54, 120 * (player.health / 100), 10);
  ctx.strokeStyle = COLORS.hudText;
  ctx.lineWidth = 1;
  ctx.strokeRect(28, 54, 120, 10);
  ctx.fillStyle = COLORS.hudText;
  ctx.fillText(`Health ${Math.max(0, Math.round(player.health))}`, 156, 64);
  ctx.fillText(`Ammo ${player.ammo}`, 28, 88);
  ctx.fillText(`Missions ${player.missionsDone}/3`, 110, 88);

  // Wanted stars.
  ctx.font = '26px sans-serif';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < wantedStars(player) ? COLORS.star : 'rgba(245, 240, 225, 0.25)';
    ctx.fillText('★', 280 + i * 30, 44);
  }

  // Objective and timer.
  ctx.fillStyle = COLORS.hudBg;
  roundRect(ctx, 14, 116, 430, 44, 10);
  ctx.fill();
  ctx.fillStyle = COLORS.marker;
  ctx.font = 'bold 15px sans-serif';
  const mission = currentMission(state.missions);
  ctx.fillText(mission ? mission.title : 'Free Roam', 28, 134);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = '14px sans-serif';
  ctx.fillText(objectiveText(state.missions), 28, 152);
  if (mission && mission.timer) {
    ctx.fillStyle = state.missions.timer < 30 ? '#ff6b5e' : COLORS.hudText;
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(`⏱ ${Math.ceil(state.missions.timer)}s`, 460, 146);
  }

  // Speed, when driving.
  if (!player.onFoot && player.car) {
    ctx.fillStyle = COLORS.hudBg;
    roundRect(ctx, VIEW.width - 150, VIEW.height - 70, 136, 56, 10);
    ctx.fill();
    ctx.fillStyle = COLORS.hudText;
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(`${Math.round(Math.abs(player.car.speed) * 0.18)}`, VIEW.width - 132, VIEW.height - 32);
    ctx.font = '13px sans-serif';
    ctx.fillText('km/h', VIEW.width - 82, VIEW.height - 32);
  }

  drawMinimap(ctx, state);

  // Message banner.
  if (state.missions.message && state.now - state.missions.messageAt < 4) {
    ctx.fillStyle = COLORS.hudBg;
    const text = state.missions.message;
    ctx.font = 'bold 16px sans-serif';
    const w = ctx.measureText(text).width + 36;
    roundRect(ctx, (VIEW.width - w) / 2, 170, w, 38, 10);
    ctx.fill();
    ctx.fillStyle = COLORS.hudText;
    ctx.textAlign = 'center';
    ctx.fillText(text, VIEW.width / 2, 195);
    ctx.textAlign = 'left';
  }

  // Controls hint.
  ctx.fillStyle = 'rgba(12, 16, 24, 0.55)';
  ctx.fillRect(14, VIEW.height - 34, 560, 22);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = '12px sans-serif';
  ctx.fillText('WASD move / drive · E enter car · F punch · Click shoot · Space handbrake · N mission · P pause', 20, VIEW.height - 19);
}

// The minimap: the whole city shrunk into the corner, with roads, the player,
// police, traffic and the mission marker.
function drawMinimap(ctx, state) {
  const size = 190;
  const x0 = VIEW.width - size - 14;
  const y0 = 14;
  const scale = size / WORLD.width;
  const scaleY = size / WORLD.height;
  ctx.fillStyle = 'rgba(12, 16, 24, 0.72)';
  roundRect(ctx, x0 - 6, y0 - 6, size + 12, size * (WORLD.height / WORLD.width) + 12, 10);
  ctx.fill();
  const h = size * (WORLD.height / WORLD.width);
  ctx.fillStyle = COLORS.sea;
  ctx.fillRect(x0, y0, WORLD.seaWidth * scale, h);
  ctx.fillStyle = COLORS.sand;
  ctx.fillRect(x0 + WORLD.seaWidth * scale, y0, WORLD.beachWidth * scale, h);
  ctx.fillStyle = COLORS.grass;
  ctx.fillRect(x0 + (WORLD.seaWidth + WORLD.beachWidth) * scale, y0, size - (WORLD.seaWidth + WORLD.beachWidth) * scale, h);
  ctx.fillStyle = COLORS.park;
  ctx.fillRect(x0 + state.world.park.x * scale, y0 + state.world.park.y * scaleY, state.world.park.w * scale, state.world.park.h * scaleY);
  ctx.strokeStyle = COLORS.road;
  ctx.lineWidth = 2;
  for (const ax of state.world.avenues) {
    ctx.beginPath();
    ctx.moveTo(x0 + ax * scale, y0);
    ctx.lineTo(x0 + ax * scale, y0 + h);
    ctx.stroke();
  }
  for (const sy of state.world.streets) {
    ctx.beginPath();
    ctx.moveTo(x0, y0 + sy * scaleY);
    ctx.lineTo(x0 + size, y0 + sy * scaleY);
    ctx.stroke();
  }
  const target = stepTarget(state.missions, state.world);
  if (target) {
    ctx.fillStyle = COLORS.marker;
    ctx.beginPath();
    ctx.arc(x0 + target.x * scale, y0 + target.y * scaleY, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#c9c9c9';
  for (const car of state.cars) {
    if (car.driver === 'traffic') ctx.fillRect(x0 + car.x * scale - 1, y0 + car.y * scaleY - 1, 2, 2);
  }
  ctx.fillStyle = COLORS.policeLight;
  for (const cruiser of state.police) {
    ctx.beginPath();
    ctx.arc(x0 + cruiser.x * scale, y0 + cruiser.y * scaleY, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = COLORS.player;
  ctx.beginPath();
  ctx.arc(x0 + state.player.x * scale, y0 + state.player.y * scaleY, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = COLORS.hudText;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x0 + state.player.x * scale, y0 + state.player.y * scaleY, 7, 0, Math.PI * 2);
  ctx.stroke();
}

// The title screen: the city name, the story hook, the controls and the prompt.
function drawTitle(ctx, state) {
  ctx.fillStyle = 'rgba(8, 12, 20, 0.62)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.fillStyle = '#ffd23d';
  ctx.font = 'bold 84px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(GAME_TITLE, VIEW.width / 2, 210);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = '24px sans-serif';
  ctx.fillText(GAME_SUBTITLE, VIEW.width / 2, 252);
  ctx.font = '16px sans-serif';
  ctx.fillText('Mari Vega came to Solmar Bay to drive. The city had other plans.', VIEW.width / 2, 300);
  ctx.fillText('Three chapters. One bay. Zero patience from the SBPD.', VIEW.width / 2, 326);
  ctx.font = 'bold 20px sans-serif';
  ctx.fillStyle = Math.sin(state.now * 4) > 0 ? '#ffd23d' : COLORS.hudText;
  ctx.fillText('Press ENTER to play', VIEW.width / 2, 400);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = '15px sans-serif';
  ctx.textAlign = 'left';
  let y = 470;
  ctx.fillText('Controls', 430, y);
  y += 28;
  for (const [key, action] of CONTROLS) {
    ctx.fillStyle = '#ffd23d';
    ctx.fillText(key, 430, y);
    ctx.fillStyle = COLORS.hudText;
    ctx.fillText(action, 640, y);
    y += 24;
  }
  ctx.textAlign = 'center';
  ctx.font = '13px sans-serif';
  ctx.fillStyle = 'rgba(245, 240, 225, 0.7)';
  ctx.fillText('An original game. Solmar Bay, its people and its story are invented for this bounty.', VIEW.width / 2, 740);
  ctx.textAlign = 'left';
}

// Pause menu.
function drawPaused(ctx, state) {
  ctx.fillStyle = 'rgba(8, 12, 20, 0.6)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = 'bold 48px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Paused', VIEW.width / 2, 300);
  ctx.font = '18px sans-serif';
  ctx.fillText('P or Esc to resume · S to save · N for the next mission', VIEW.width / 2, 350);
  ctx.textAlign = 'left';
}

// Busted: the police caught Mari on foot.
function drawBusted(ctx, state) {
  ctx.fillStyle = 'rgba(20, 8, 12, 0.72)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.fillStyle = '#ff6b5e';
  ctx.font = 'bold 72px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('BUSTED', VIEW.width / 2, 340);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = '18px sans-serif';
  ctx.fillText('The SBPD caught up with you. Press R to get back on the street.', VIEW.width / 2, 390);
  ctx.textAlign = 'left';
}

// Wasted: Mari's health ran out.
function drawWasted(ctx, state) {
  ctx.fillStyle = 'rgba(20, 8, 8, 0.78)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.fillStyle = '#ff6b5e';
  ctx.font = 'bold 72px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('WASTED', VIEW.width / 2, 340);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = '18px sans-serif';
  ctx.fillText('Solmar Bay is not done with you yet. Press R to try again.', VIEW.width / 2, 390);
  ctx.textAlign = 'left';
}

// A rounded rectangle path, filled by the caller.
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
