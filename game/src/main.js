// SOLMAR BAY — game orchestration: the loop, camera, modes (title,
// playing, paused, busted, wasted, story done), crime and combat wiring,
// mission flow, saving, and the deterministic screenshot modes
// (?shot=cover|street|mission|chase) that stage a real gameplay moment
// for the camera. Exposes window.SOLMAR so the game can be driven and
// inspected from a test harness.
import {
  WORLD_W, WORLD_H, SEED_DEFAULT, TUNING, MISSIONS,
} from './config.js';
import { makeRng, clamp, dist, lerp } from './random.js';
import { buildWorld, collideCircle } from './world.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { saveGame, loadGame, clearSave, hasSave } from './save.js';
import { createPlayer, updatePlayer, tryEnterCar, exitCar, resolvePunch, damagePlayer } from './player.js';
import { createTraffic, updateTraffic, checkPedCarHits } from './traffic.js';
import { createPolice, updatePolice, addHeat, setWanted, clearWanted } from './police.js';
import {
  createMissions, currentMission, currentStep, startMission,
  stepTarget, updateMissions, retryMission,
} from './missions.js';
import { drawGame } from './render.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function readQuery() {
  const params = new URLSearchParams(window.location.search);
  return {
    seed: Number(params.get('seed') || SEED_DEFAULT) || SEED_DEFAULT,
    shot: params.get('shot') || null,
  };
}

const query = readQuery();
const seed = query.seed;

const state = {
  seed,
  mode: 'title',
  world: buildWorld(seed),
  player: null,
  traffic: null,
  police: null,
  missions: null,
  camera: { x: 1500, y: 1350, zoom: 1, view: { x0: 0, y0: 0, x1: 1280, y1: 720 } },
  particles: [],
  time: 0,
  rng: makeRng(seed * 101 + 3),
  missionTarget: null,
  hasSave: hasSave(),
  titleButtons: [],
  saveTimer: 0,
  totalEarned: 0,
};

const input = new Input(canvas);
const audio = new AudioEngine();

function newGame(save) {
  const spawn = state.world.landmarks.spawn;
  state.player = createPlayer(spawn.x, spawn.y);
  state.traffic = createTraffic(state.world, seed);
  state.police = createPolice(seed);
  state.missions = createMissions();
  state.particles = [];
  state.totalEarned = 0;
  if (save) {
    state.player.cash = save.cash || 0;
    state.player.health = save.health || 100;
    state.player.x = save.playerX || spawn.x;
    state.player.y = save.playerY || spawn.y;
    state.totalEarned = save.totalEarned || 0;
    state.missions.index = save.missionIndex || 0;
    state.missions.completed = save.completedMissions || [];
  }
  state.mode = 'playing';
  startMission(state.missions, Math.min(state.missions.index, MISSIONS.length - 1));
  state.camera.x = state.player.x;
  state.camera.y = state.player.y;
  audio.resume();
}

function burst(x, y, color, count, speed) {
  for (let i = 0; i < count; i++) {
    const a = state.rng.range(0, Math.PI * 2);
    const v = state.rng.range(speed * 0.4, speed);
    state.particles.push({
      x, y,
      vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      life: state.rng.range(0.3, 0.7), maxLife: 0.7,
      size: state.rng.range(2, 5), color,
    });
  }
}

function handleEvent(ev) {
  const player = state.player;
  const police = state.police;
  switch (ev.type) {
    case 'punch':
      audio.punch();
      break;
    case 'punchLanded':
      burst(player.x + Math.cos(player.angle) * 30, player.y + Math.sin(player.angle) * 30, '#ffd60a', 6, 120);
      break;
    case 'hitPed':
      addHeat(police, 8);
      break;
    case 'hitCop':
      addHeat(police, 15);
      break;
    case 'hitCar':
      audio.tone(160, 0.08, 'square', 0.12, 90);
      break;
    case 'ranOverPed':
      addHeat(police, 12);
      audio.crash();
      burst(ev.ped.x, ev.ped.y, '#ff5a5a', 10, 140);
      break;
    case 'stealCar': {
      addHeat(police, 10);
      audio.chime();
      state.missions.message = 'You took the ' + ev.car.model + ' — the police noticed.';
      state.missions.messageTimer = 3;
      break;
    }
    case 'exitCar':
      break;
    case 'crash':
      audio.crash();
      burst(player.x, player.y, '#ffb703', 12, 200);
      if (ev.speed > 420) damagePlayer(player, 5);
      break;
    case 'trafficCrash':
      audio.crash();
      burst(player.x, player.y, '#ffb703', 8, 160);
      break;
    case 'policeRam':
      audio.crash();
      burst(player.x, player.y, '#ff3b30', 8, 180);
      if (player.onFoot) damagePlayer(player, 6);
      break;
    case 'drive':
      audio.setEngine(ev.speedRatio, true);
      break;
    case 'busted':
      state.mode = 'busted';
      audio.failBuzz();
      audio.setEngine(0, false);
      audio.setSiren(false, 0);
      clearWanted(police);
      player.cash = Math.max(0, player.cash - 100);
      saveGame(snapshot());
      break;
    case 'wantedDown':
      state.missions.message = 'You lost them — wanted level ' + ev.level + '.';
      state.missions.messageTimer = 3;
      break;
    case 'stepComplete':
      audio.chime();
      burst(player.x, player.y, '#7ee081', 14, 160);
      break;
    case 'missionComplete': {
      const mission = ev.mission;
      player.cash += mission.reward;
      state.totalEarned += mission.reward;
      audio.missionJingle();
      burst(player.x, player.y, '#ffd60a', 24, 220);
      saveGame(snapshot());
      if (state.missions.index + 1 >= MISSIONS.length) {
        state.mode = 'storyDone';
      } else {
        startMission(state.missions, state.missions.index + 1);
      }
      break;
    }
    case 'missionFailed':
      audio.failBuzz();
      break;
    default:
      break;
  }
}

function snapshot() {
  return {
    seed: state.seed,
    cash: state.player.cash,
    health: state.player.health,
    missionIndex: state.missions.index,
    completedMissions: state.missions.completed,
    player: state.player,
    totalEarned: state.totalEarned,
  };
}

function respawn() {
  const spawn = state.world.landmarks.safehouse;
  state.player.x = spawn.x;
  state.player.y = spawn.y;
  state.player.health = 100;
  state.player.cash = Math.max(0, state.player.cash - 100);
  if (state.player.car) {
    state.player.car.driver = null;
    state.player.car = null;
  }
  state.player.onFoot = true;
  state.player.speed = 0;
  state.camera.x = state.player.x;
  state.camera.y = state.player.y;
  clearWanted(state.police);
  state.mode = 'playing';
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

function updateCamera(dt) {
  const targetZoom = state.player && !state.player.onFoot ? 0.82 : 1.0;
  state.camera.zoom = lerp(state.camera.zoom, targetZoom, dt * 2);
  const viewW = window.innerWidth;
  const viewH = window.innerHeight;
  state.camera.x = lerp(state.camera.x, state.player.x, dt * 5);
  state.camera.y = lerp(state.camera.y, state.player.y, dt * 5);
  state.camera.x = clamp(state.camera.x, viewW / 2 / state.camera.zoom, WORLD_W - viewW / 2 / state.camera.zoom);
  state.camera.y = clamp(state.camera.y, viewH / 2 / state.camera.zoom, WORLD_H - viewH / 2 / state.camera.zoom);
  const hw = viewW / 2 / state.camera.zoom;
  const hh = viewH / 2 / state.camera.zoom;
  state.camera.view = {
    x0: state.camera.x - hw - 60, y0: state.camera.y - hh - 60,
    x1: state.camera.x + hw + 60, y1: state.camera.y + hh + 60,
  };
}

function update(dt) {
  state.time += dt;
  if (state.mode === 'title') {
    // Gentle attract camera drifting over Palm Row.
    state.camera.x = 1600 + Math.sin(state.time * 0.08) * 200;
    state.camera.y = 1000 + Math.cos(state.time * 0.06) * 150;
    state.camera.zoom = 0.7;
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;
    const hw = viewW / 2 / state.camera.zoom;
    const hh = viewH / 2 / state.camera.zoom;
    state.camera.view = {
      x0: state.camera.x - hw - 60, y0: state.camera.y - hh - 60,
      x1: state.camera.x + hw + 60, y1: state.camera.y + hh + 60,
    };
    if (!state.player) {
      const spawn = state.world.landmarks.spawn;
      state.player = createPlayer(spawn.x, spawn.y);
      state.traffic = createTraffic(state.world, seed);
      state.police = createPolice(seed);
      state.missions = createMissions();
    }
    updateTraffic(state.traffic, dt, state.world, null, handleEvent);
    if (input.mouseClicked) {
      for (const b of state.titleButtons) {
        if (input.mouseX >= b.x && input.mouseX <= b.x + b.w && input.mouseY >= b.y && input.mouseY <= b.y + b.h) {
          audio.resume();
          if (b.action === 'continue') newGame(loadGame());
          else { clearSave(); newGame(null); }
          break;
        }
      }
    }
    return;
  }

  if (input.wasPressed('KeyP', 'Escape')) {
    if (state.mode === 'playing') { state.mode = 'paused'; audio.setEngine(0, false); audio.setSiren(false, 0); }
    else if (state.mode === 'paused') state.mode = 'playing';
  }
  if (input.wasPressed('KeyM')) audio.setMuted(!audio.muted);
  if (state.mode === 'paused') return;

  if (state.mode === 'busted' || state.mode === 'wasted' || state.mode === 'storyDone') {
    if (input.wasPressed('KeyR')) respawn();
    return;
  }

  // Playing.
  if (input.wasPressed('KeyE')) {
    if (state.player.onFoot) tryEnterCar(state.player, state.traffic.cars, handleEvent);
    else exitCar(state.player, state.world, handleEvent);
  }
  if (input.wasPressed('KeyT')) {
    if (!state.missions.active && state.missions.index < MISSIONS.length) retryMission(state.missions);
  }

  updatePlayer(state.player, dt, input, state.world, state.traffic.cars, handleEvent);
  // Staged screenshot cars keep cruising after the physics step.
  if (state.shotCruise && state.player.car) state.player.car.speed = state.shotCruise;
  resolvePunch(state.player, state.traffic.peds, state.police.cops, state.traffic.cars, handleEvent);
  updateTraffic(state.traffic, dt, state.world, state.player.car, handleEvent);
  checkPedCarHits(state.traffic, state.player.car, handleEvent);

  // Traffic cars can hurt Kit on foot.
  if (state.player.onFoot) {
    for (const car of state.traffic.cars) {
      if (car.parked || car.driver === 'player') continue;
      if (Math.abs(car.speed) > 80 && dist(car.x, car.y, state.player.x, state.player.y) < 26) {
        if (damagePlayer(state.player, 18)) {
          state.mode = 'wasted';
          audio.failBuzz();
          saveGame(snapshot());
        } else {
          audio.crash();
          const solved = collideCircle(state.world, state.player.x + (state.player.x - car.x), state.player.y + (state.player.y - car.y), 14);
          state.player.x = solved.x;
          state.player.y = solved.y;
        }
        break;
      }
    }
  }

  updatePolice(state.police, dt, state.player, state.world, handleEvent);
  // Step-start triggers: some steps begin with the world reacting — the
  // police arrive for a getaway, the bank alarm trips for the big job.
  const activeStep = currentStep(state.missions);
  if (state.missions.active && activeStep) {
    const stepKey = state.missions.index + '-' + state.missions.stepIndex;
    if (state.lastStepKey !== stepKey) {
      state.lastStepKey = stepKey;
      if (activeStep.type === 'wanted' && state.police.level < activeStep.level) {
        setWanted(state.police, activeStep.level);
        state.missions.message = 'The police are on you — wanted level ' + activeStep.level + '!';
        state.missions.messageTimer = 4;
      }
      if (activeStep.type === 'hold' && state.police.level < 3) {
        setWanted(state.police, 3);
        state.missions.message = 'The bank alarm is tripped — wanted level 3!';
        state.missions.messageTimer = 4;
      }
    }
  }
  updateMissions(state.missions, dt, state.player, state.world, state.police, handleEvent);
  if (state.player.health <= 0 && state.mode === 'playing') {
    state.mode = 'wasted';
    audio.failBuzz();
    saveGame(snapshot());
  }

  // Mission countdown display and target marker.
  const step = currentStep(state.missions);
  state.missions.countdown = 0;
  if (state.missions.active && step && step.type === 'checkpoint') {
    state.missions.countdown = Math.max(0, step.time - state.missions.timer);
  }
  state.missionTarget = state.missions.active ? stepTarget(state.missions, state.world) : null;

  // Particles.
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.life <= 0) state.particles.splice(i, 1);
  }

  audio.setSiren(state.police.level >= 2, dt);
  updateCamera(dt);

  state.saveTimer += dt;
  if (state.saveTimer > 15) {
    state.saveTimer = 0;
    saveGame(snapshot());
  }
}

// Deterministic screenshot staging: real gameplay states, set up from the
// seed, so each screenshot is a genuine render of the game running.
function applyShot(shot) {
  newGame(null);
  const world = state.world;
  const player = state.player;
  if (shot === 'cover') {
    const car = state.traffic.cars.find((c) => c.parked && Math.abs(c.x - 1500) < 400 && Math.abs(c.y - 1000) < 400)
      || state.traffic.cars.find((c) => c.parked);
    player.x = car.x; player.y = car.y;
    tryEnterCar(player, state.traffic.cars, handleEvent);
    player.car.speed = 420;
    player.car.angle = 0;
    player.car.x = 1500; player.car.y = 1000;
    setWanted(state.police, 3);
    updatePolice(state.police, 0.5, player, world, () => {});
    for (const cop of state.police.cars) {
      cop.x = player.x - 160 - state.rng.range(0, 120);
      cop.y = player.y + state.rng.range(-90, 90);
      cop.speed = 380;
    }
    startMission(state.missions, 0);
  } else if (shot === 'street') {
    player.x = 760; player.y = 720;
    startMission(state.missions, 1);
    let placed = 0;
    for (const car of state.traffic.cars) {
      if (placed >= 6) break;
      if (!car.parked) {
        car.x = 700 + state.rng.range(-24, 24);
        car.y = 500 + placed * 70;
        car.angle = placed % 2 === 0 ? Math.PI / 2 : -Math.PI / 2;
        car.speed = 90;
        placed++;
      }
    }
  } else if (shot === 'mission') {
    startMission(state.missions, 1);
    player.x = world.landmarks.marina.x + 40;
    player.y = world.landmarks.marina.y + 30;
    const car = state.traffic.cars.find((c) => c.parked);
    if (car) { car.x = player.x + 60; car.y = player.y + 40; }
  } else if (shot === 'chase') {
    const car = state.traffic.cars.find((c) => c.parked);
    player.x = car.x; player.y = car.y;
    tryEnterCar(player, state.traffic.cars, handleEvent);
    player.car.speed = 500;
    player.car.angle = Math.PI / 2;
    player.car.x = 2300; player.car.y = 650;
    setWanted(state.police, 4);
    updatePolice(state.police, 0.5, player, world, () => {});
    state.police.cars.forEach((cop, i) => {
      cop.x = player.x + state.rng.range(-120, 120);
      cop.y = player.y - 200 - i * 90;
      cop.speed = 430;
      cop.angle = Math.PI / 2;
    });
    startMission(state.missions, 4);
  }
  state.camera.x = player.x;
  state.camera.y = player.y;
  state.camera.zoom = player.onFoot ? 1 : 0.85;
  // Keep staged cars cruising so the screenshot catches them moving.
  state.shotCruise = (shot === 'cover' || shot === 'chase') ? (shot === 'cover' ? 420 : 500) : 0;
  updateCamera(0.016);
  state.missionTarget = state.missions.active ? stepTarget(state.missions, state.world) : null;
}

if (query.shot) {
  applyShot(query.shot);
}

// Test and automation hook: read-only state plus a few safe controls.
window.SOLMAR = {
  getState() {
    const mission = currentMission(state.missions);
    const step = currentStep(state.missions);
    return {
      mode: state.mode,
      seed: state.seed,
      x: Math.round(state.player ? state.player.x : 0),
      y: Math.round(state.player ? state.player.y : 0),
      angle: state.player ? Math.round(state.player.angle * 100) / 100 : 0,
      speed: Math.round(state.player ? state.player.speed : 0),
      inCar: state.player ? !state.player.onFoot : false,
      health: state.player ? state.player.health : 0,
      cash: state.player ? state.player.cash : 0,
      wanted: state.police ? state.police.level : 0,
      policeCars: state.police ? state.police.cars.length : 0,
      trafficCars: state.traffic ? state.traffic.cars.length : 0,
      peds: state.traffic ? state.traffic.peds.filter((p) => !p.down).length : 0,
      mission: mission ? mission.title : null,
      missionIndex: state.missions ? state.missions.index : 0,
      missionActive: state.missions ? state.missions.active : false,
      step: step ? step.text : null,
      stepIndex: state.missions ? state.missions.stepIndex : 0,
      completed: state.missions ? state.missions.completed.slice() : [],
      time: Math.round(state.time * 10) / 10,
      titleButtons: state.titleButtons ? state.titleButtons.map((b) => ({ x: b.x, y: b.y, w: b.w, h: b.h, action: b.action })) : [],
    };
  },
  startMission(index) {
    if (state.mode === 'playing') startMission(state.missions, index);
  },
  setWanted(level) {
    setWanted(state.police, level);
  },
  teleport(x, y) {
    if (!state.player) return;
    const solved = collideCircle(state.world, x, y, 14);
    state.player.x = solved.x;
    state.player.y = solved.y;
    if (state.player.car) {
      state.player.car.x = solved.x;
      state.player.car.y = solved.y;
    }
    state.camera.x = solved.x;
    state.camera.y = solved.y;
  },
  teleportToParked() {
    if (!state.player || !state.traffic) return null;
    let best = null;
    let bestD = Infinity;
    for (const car of state.traffic.cars) {
      if (!car.parked) continue;
      const d = dist(car.x, car.y, state.player.x, state.player.y);
      if (d < bestD) { bestD = d; best = car; }
    }
    if (!best) return null;
    const solved = collideCircle(state.world, best.x + 30, best.y, 14);
    state.player.x = solved.x;
    state.player.y = solved.y;
    state.camera.x = solved.x;
    state.camera.y = solved.y;
    return { x: Math.round(best.x), y: Math.round(best.y), dist: Math.round(bestD) };
  },
  newGame() { newGame(null); },
};

let last = performance.now();
function frame(now) {
  const dt = clamp((now - last) / 1000, 0.001, 0.05);
  last = now;
  try {
    update(dt);
  } catch (err) {
    console.error('Solmar Bay update error', err);
  }
  try {
    drawGame(ctx, state, window.innerWidth, window.innerHeight, state.time);
  } catch (err) {
    console.error('Solmar Bay draw error', err);
  }
  input.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
