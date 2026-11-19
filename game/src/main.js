// Solmar Bay: the game loop, the screen state machine, combat wiring and the
// screenshot scenes. The loop runs at a fixed step so the game plays the same
// on any machine; the ?shot= parameter stages a scene for the maker's own
// screenshots and skips the title screen.

import { VIEW, WORLD, WORLD_SEED, PLAYER } from './config.js';
import { mulberry32 } from './random.js';
import { buildWorld } from './world.js';
import { createPlayer, updatePlayer, enterCar, exitCar, punch, shoot, hurtPlayer } from './player.js';
import { spawnTraffic, spawnPeds, updateTraffic, updatePeds } from './traffic.js';
import { updatePolice, makePolice } from './police.js';
import { createMissionState, startMission, updateMission } from './missions.js';
import { render } from './render.js';
import { SoundEngine } from './audio.js';
import { createInput, wasPressed, endFrame } from './input.js';
import { saveGame, loadGame, applySave } from './save.js';

// Boot the game: build the city, spawn the traffic, wire the canvas.
export function boot() {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const world = buildWorld(WORLD_SEED);
  const rng = mulberry32(WORLD_SEED + 303);
  const state = {
    world,
    rng,
    player: createPlayer(world.spawn),
    cars: spawnTraffic(world, WORLD_SEED),
    peds: spawnPeds(world, WORLD_SEED),
    police: [],
    missions: createMissionState(),
    effects: [],
    camera: { x: 0, y: 0 },
    screen: 'title',
    now: 0,
    sound: new SoundEngine(),
    input: createInput(canvas),
    save: null,
    shot: null,
  };
  state.save = loadGame();
  if (state.save) applySave(state, state.save);

  // A ?shot= parameter stages a scene for screenshots: the game starts at
  // once, already driving, already wanted, already on a mission.
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (shot) {
    state.shot = shot;
    stageShot(state, shot);
  }

  let last = performance.now();
  function frame(time) {
    const dt = Math.min(0.05, (time - last) / 1000);
    last = time;
    state.now += dt;
    step(state, dt);
    render(ctx, state);
    endFrame(state.input);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return state;
}

// One frame of game logic, by screen.
function step(state, dt) {
  const { input, player } = state;
  state.sound.update(player.speed, player.wanted, dt);

  // Expire short-lived effects.
  for (let i = state.effects.length - 1; i >= 0; i--) {
    const fx = state.effects[i];
    fx.life -= dt;
    if (fx.life <= 0) state.effects.splice(i, 1);
  }

  if (state.screen === 'title') {
    if (wasPressed(input, 'Enter') || input.clicked) {
      state.sound.ensure();
      state.screen = 'playing';
      if (!state.missions.active && state.missions.index === 0) startMission(state.missions, state.now);
    }
    return;
  }

  if (state.screen === 'paused') {
    if (wasPressed(input, 'KeyP') || wasPressed(input, 'Escape')) state.screen = 'playing';
    if (wasPressed(input, 'KeyS')) saveGame(state);
    return;
  }

  if (state.screen === 'busted' || state.screen === 'wasted') {
    if (wasPressed(input, 'KeyR') || wasPressed(input, 'Enter')) respawn(state);
    return;
  }

  // Playing.
  state.sound.ensure();
  if (wasPressed(input, 'KeyP') || wasPressed(input, 'Escape')) {
    state.screen = 'paused';
    return;
  }
  if (wasPressed(input, 'KeyN')) {
    if (!state.missions.active) startMission(state.missions, state.now);
  }
  if (wasPressed(input, 'KeyM')) {
    const mission = currentMission(state.missions);
    state.missions.message = mission
      ? `${mission.title}: ${mission.steps[state.missions.step]?.text || ''}`
      : 'No mission active. Press N to start the next chapter.';
    state.missions.messageAt = state.now;
  }
  if (wasPressed(input, 'KeyE')) {
    if (player.onFoot) enterCar(player, state.cars, state.now, state.effects);
    else exitCar(player);
  }

  updatePlayer(player, input, state.world, state.cars, dt, state.effects, state.now);
  updateTraffic(state.cars, state.world, dt, state.rng);
  updatePeds(state.peds, state.world, player, dt, state.rng);

  // Combat: punches and shots, and the police answer.
  if (wasPressed(input, 'KeyF') || input.clicked) {
    if (player.onFoot) {
      const hit = input.clicked ? shoot(player, state.peds, mouseWorld(state), state.now) : punch(player, state.peds, dt);
      if (hit) {
        hit.dead = true;
        player.kills++;
        state.sound.thud();
        state.effects.push({ kind: 'text', x: hit.x, y: hit.y - 20, text: 'Down!', life: 1, max: 1 });
      } else if (input.clicked && player.ammo > 0) {
        state.sound.shot();
        const mx = state.camera.x + input.mouseX;
        const my = state.camera.y + input.mouseY;
        state.effects.push({ kind: 'spark', x: player.x + (mx - player.x) * 0.1, y: player.y + (my - player.y) * 0.1, life: 0.15, max: 0.15 });
      }
    }
  }

  // Running over a pedestrian at speed is a crime and a death.
  if (!player.onFoot && Math.abs(player.speed) > 120) {
    for (const ped of state.peds) {
      if (ped.dead) continue;
      if (Math.hypot(ped.x - player.x, ped.y - player.y) < 26) {
        ped.dead = true;
        player.kills++;
        player.wanted = Math.min(5, player.wanted + 2);
        player.heat = Math.max(player.heat, player.wanted);
        player.lastCrimeAt = state.now;
        state.sound.thud();
      }
    }
  }

  // Bumping traffic cars slows both and makes a noise.
  for (const car of state.cars) {
    if (car.driver !== 'traffic') continue;
    if (Math.hypot(car.x - player.x, car.y - player.y) < 42 && !player.onFoot) {
      car.speed *= 0.5;
      player.car.speed *= 0.8;
      state.sound.thud();
    }
  }

  const busted = updatePolice(state.police, player, state.world, dt, state.rng, state.effects);
  if (busted === 'busted') {
    state.screen = 'busted';
    player.wanted = 0;
    player.heat = 0;
    return;
  }

  const result = updateMission(state.missions, player, state.world, dt, state.now, state.effects);
  if (result === 'complete') {
    state.sound.chime();
    saveGame(state);
  } else if (result === 'failed') {
    state.sound.thud();
  }

  // Police cars ramming the player on foot hurt her.
  if (player.onFoot) {
    for (const cruiser of state.police) {
      if (Math.hypot(cruiser.x - player.x, cruiser.y - player.y) < 30) {
        if (hurtPlayer(player, 25)) {
          state.screen = 'wasted';
          return;
        }
      }
    }
  }
}

// The mouse position in world coordinates, for aiming.
function mouseWorld(state) {
  return { x: state.camera.x + state.input.mouseX, y: state.camera.y + state.input.mouseY };
}

// Back on the street after being busted or wasted: health restored, a fine
// paid, the car kept where it was, and the heat cleared.
function respawn(state) {
  const { player } = state;
  player.health = PLAYER.health;
  player.cash = Math.max(0, player.cash - 150);
  player.wanted = 0;
  player.heat = 0;
  state.police.length = 0;
  player.x = state.world.spawn.x;
  player.y = state.world.spawn.y;
  if (player.car) {
    player.car.driver = null;
    player.car = null;
    player.onFoot = true;
    player.driving = false;
  }
  state.screen = 'playing';
}

// Stage a scene for a screenshot: put Mari in a car downtown with a tail, or
// on foot at the marina, or mid-mission at a checkpoint, and start playing.
function stageShot(state, shot) {
  const { world, player } = state;
  state.screen = 'playing';
  state.missions.message = '';
  if (shot === 'cover') {
    startMission(state.missions, state.now);
    const car = state.cars.find((c) => c.owner === 'parked') || state.cars[0];
    car.owner = 'player';
    car.driver = 'player';
    player.car = car;
    player.onFoot = false;
    player.driving = true;
    player.x = car.x = world.avenues[3];
    player.y = car.y = world.streets[2];
    car.angle = Math.PI / 2;
    car.speed = 380;
    player.wanted = 2;
    player.heat = 2;
    player.lastCrimeAt = state.now;
    // Two cruisers already on her tail, so the chase is in the frame at once.
    const tail1 = makePolice(car.x - 40, car.y - 320);
    tail1.angle = Math.PI / 2;
    tail1.speed = 420;
    const tail2 = makePolice(car.x + 60, car.y - 480);
    tail2.angle = Math.PI / 2;
    tail2.speed = 430;
    state.police.push(tail1, tail2);
    state.missions.message = 'Chapter 1: First Wheels — deliver the car to Rico\'s Garage';
    state.missions.messageAt = state.now;
  } else if (shot === 'street') {
    player.x = WORLD.seaWidth + WORLD.beachWidth + 60;
    player.y = world.streets[1];
    player.angle = 0;
    player.cash = 640;
    state.missions.message = 'Solmar Bay — Marina Row, on foot';
    state.missions.messageAt = state.now;
  } else if (shot === 'mission') {
    state.missions.index = 1;
    startMission(state.missions, state.now);
    state.missions.step = 1;
    const car = state.cars.find((c) => c.owner === 'parked') || state.cars[0];
    car.owner = 'player';
    car.driver = 'player';
    player.car = car;
    player.onFoot = false;
    player.driving = true;
    player.x = car.x = world.plaza.x;
    player.y = car.y = world.plaza.y;
    car.angle = 0;
    car.speed = 420;
    player.cash = 1040;
    state.missions.message = 'Chapter 2: The Bay Run — checkpoint 2 of 4';
    state.missions.messageAt = state.now;
  } else if (shot === 'chase') {
    const car = state.cars.find((c) => c.owner === 'parked') || state.cars[0];
    car.owner = 'player';
    car.driver = 'player';
    player.car = car;
    player.onFoot = false;
    player.driving = true;
    player.x = car.x = world.avenues[4];
    player.y = car.y = world.streets[3];
    car.angle = -Math.PI / 2;
    car.speed = 460;
    player.wanted = 4;
    player.heat = 4;
    player.lastCrimeAt = state.now;
    player.cash = 1520;
    // Three cruisers closing in from behind and the side.
    const chase1 = makePolice(car.x - 50, car.y + 300);
    chase1.angle = -Math.PI / 2;
    chase1.speed = 470;
    const chase2 = makePolice(car.x + 240, car.y + 180);
    chase2.angle = Math.PI;
    chase2.speed = 450;
    const chase3 = makePolice(car.x - 60, car.y + 520);
    chase3.angle = -Math.PI / 2;
    chase3.speed = 480;
    state.police.push(chase1, chase2, chase3);
    state.missions.message = 'Four stars — lose the SBPD tail';
    state.missions.messageAt = state.now;
  }
  // Centre the camera on the staged scene at once, no drift-in.
  state.camera.x = player.x - 640;
  state.camera.y = player.y - 400;
}

boot();
