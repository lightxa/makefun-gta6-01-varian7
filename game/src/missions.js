// Missions and story for Solmar Bay.
// Five jobs from Rosa Marlin and Dario Sol, each a chain of steps: take a
// car, pick up and deliver, lose the police, beat the clock through
// checkpoints, then hold the bank plaza and run. Completing a job pays cash
// and unlocks the next; finishing the fifth ends the story arc.
import { MISSIONS } from './config.js';
import { dist } from './random.js';

export function createMissions() {
  return {
    index: 0,
    stepIndex: 0,
    active: false,
    done: false,
    completed: [],
    timer: 0,
    holdTimer: 0,
    message: '',
    messageTimer: 0,
  };
}

export function currentMission(missions) {
  if (missions.index >= MISSIONS.length) return null;
  return MISSIONS[missions.index];
}

export function currentStep(missions) {
  const mission = currentMission(missions);
  if (!mission) return null;
  return mission.steps[missions.stepIndex] || null;
}

export function startMission(missions, index) {
  missions.index = index;
  missions.stepIndex = 0;
  missions.active = true;
  missions.done = false;
  missions.timer = 0;
  missions.holdTimer = 0;
  const mission = MISSIONS[index];
  missions.message = mission.title + ' — ' + mission.giver;
  missions.messageTimer = 4;
  return mission;
}

export function stepTarget(missions, world) {
  const step = currentStep(missions);
  if (!step || !step.at) return null;
  const spot = world.landmarks[step.at];
  return spot ? { x: spot.x, y: spot.y, label: spot.label } : null;
}

function advanceStep(missions, onEvent) {
  const mission = currentMission(missions);
  missions.stepIndex += 1;
  missions.holdTimer = 0;
  missions.timer = 0;
  if (missions.stepIndex >= mission.steps.length) {
    missions.active = false;
    missions.done = true;
    missions.completed.push(mission.id);
    missions.message = 'Job done: ' + mission.title + ' — $' + mission.reward;
    missions.messageTimer = 5;
    onEvent({ type: 'missionComplete', mission });
  } else {
    const next = mission.steps[missions.stepIndex];
    missions.message = next.text;
    missions.messageTimer = 3.5;
    onEvent({ type: 'stepComplete', mission, step: next });
  }
}

export function updateMissions(missions, dt, player, world, police, onEvent) {
  if (missions.messageTimer > 0) missions.messageTimer -= dt;
  if (!missions.active) return;
  const mission = currentMission(missions);
  if (!mission) return;
  const step = currentStep(missions);
  if (!step) return;

  if (step.type === 'enterCar') {
    if (!player.onFoot) advanceStep(missions, onEvent);
    return;
  }
  if (step.type === 'wanted') {
    if (police.level >= step.level) advanceStep(missions, onEvent);
    return;
  }
  if (step.type === 'loseHeat') {
    if (police.level === 0) advanceStep(missions, onEvent);
    return;
  }
  if (step.type === 'pickup' || step.type === 'reach' || step.type === 'hold' || step.type === 'checkpoint') {
    const target = stepTarget(missions, world);
    if (!target) return;
    const d = dist(player.x, player.y, target.x, target.y);
    if (step.type === 'checkpoint') {
      missions.timer += dt;
      if (d < 70) {
        advanceStep(missions, onEvent);
        return;
      }
      if (missions.timer >= step.time) {
        missions.active = false;
        missions.message = 'Too slow — the checkpoint closed. Talk to Dario to retry.';
        missions.messageTimer = 5;
        onEvent({ type: 'missionFailed', mission, reason: 'checkpoint timeout' });
      }
      return;
    }
    if (step.type === 'hold') {
      if (d < 90) {
        missions.holdTimer += dt;
        if (missions.holdTimer >= step.seconds) advanceStep(missions, onEvent);
      } else {
        missions.holdTimer = Math.max(0, missions.holdTimer - dt);
      }
      return;
    }
    if (d < 70) advanceStep(missions, onEvent);
  }
}

export function failMission(missions, reason) {
  missions.active = false;
  missions.message = 'Job failed: ' + reason + '. The job is still open — start it again.';
  missions.messageTimer = 5;
}

export function retryMission(missions) {
  missions.stepIndex = 0;
  missions.active = true;
  missions.done = false;
  missions.timer = 0;
  missions.holdTimer = 0;
  const mission = currentMission(missions);
  if (mission) {
    missions.message = mission.title + ' — try again';
    missions.messageTimer = 3;
  }
}
