// The story of Solmar Bay: three chapters for Mari Vega, each with steps, a
// map marker, a timer where the job demands one, and a cash payout. Missions
// are data plus a small state machine; the renderer reads the current step for
// its objective text and marker.

import { MISSION_REWARDS } from './config.js';

// Chapter list: id, title, briefing, and steps. A step points at a place (by
// key on the world) or at a condition the update function checks.
export const MISSIONS = [
  {
    id: 'first-wheels',
    title: 'Chapter 1: First Wheels',
    briefing: "Rico needs a clean car. Take any parked car on the street and bring it to his garage. Don't let the cops see you take it.",
    reward: MISSION_REWARDS[0],
    steps: [
      { kind: 'steal', text: 'Steal a car and drive it', place: null },
      { kind: 'goto', text: "Deliver the car to Rico's Garage", place: 'garage', radius: 90 },
    ],
  },
  {
    id: 'bay-run',
    title: 'Chapter 2: The Bay Run',
    briefing: 'A courier job across town. Hit every checkpoint before the clock runs out. The streets are yours, the timer is not.',
    reward: MISSION_REWARDS[1],
    steps: [
      { kind: 'checkpoint', text: 'Reach checkpoint 1 of 4', place: 'pier', radius: 80 },
      { kind: 'checkpoint', text: 'Reach checkpoint 2 of 4', place: 'plaza', radius: 80 },
      { kind: 'checkpoint', text: 'Reach checkpoint 3 of 4', place: 'hotel', radius: 80 },
      { kind: 'checkpoint', text: 'Reach checkpoint 4 of 4', place: 'depot', radius: 80 },
    ],
    timer: 150,
  },
  {
    id: 'harbor-heat',
    title: 'Chapter 3: Harbor Heat',
    briefing: 'Pick up the package at the Harbor Depot, then shake a two-star tail and bring it to the Old Pier. Lose the cops first or the drop is burned.',
    reward: MISSION_REWARDS[2],
    steps: [
      { kind: 'goto', text: 'Pick up the package at the Harbor Depot', place: 'depot', radius: 80 },
      { kind: 'lose-heat', text: 'Lose the police (get your wanted level to zero)', place: null },
      { kind: 'goto', text: 'Deliver the package to the Old Pier', place: 'pier', radius: 90 },
    ],
  },
];

// Fresh mission state: nothing started, no chapter active.
export function createMissionState() {
  return {
    index: 0,
    step: 0,
    active: false,
    done: false,
    timer: 0,
    startedAt: 0,
    message: '',
    messageAt: 0,
    completed: [],
  };
}

// Start the next chapter, or report that the story is finished.
export function startMission(state, now) {
  if (state.index >= MISSIONS.length) return null;
  const mission = MISSIONS[state.index];
  state.active = true;
  state.step = 0;
  state.done = false;
  state.timer = mission.timer || 0;
  state.startedAt = now;
  state.message = mission.title;
  state.messageAt = now;
  return mission;
}

// The chapter currently running, or null.
export function currentMission(state) {
  if (!state.active || state.index >= MISSIONS.length) return null;
  return MISSIONS[state.index];
}

// The step the player is on now, or null.
export function currentStep(state) {
  const mission = currentMission(state);
  if (!mission) return null;
  return mission.steps[state.step] || null;
}

// The world place a step points at, or null when the step is a condition.
export function stepTarget(state, world) {
  const step = currentStep(state);
  if (!step || !step.place) return null;
  return world[step.place] || null;
}

// Step the mission one frame. Returns 'complete' when the chapter pays out,
// 'failed' when its timer runs out, or null while it runs.
export function updateMission(state, player, world, dt, now, effects) {
  if (!state.active) return null;
  const mission = currentMission(state);
  if (!mission) return null;
  const step = currentStep(state);
  if (!step) return 'complete';

  if (mission.timer) {
    state.timer -= dt;
    if (state.timer <= 0) {
      state.active = false;
      state.message = 'Mission failed: out of time';
      state.messageAt = now;
      return 'failed';
    }
  }

  if (step.kind === 'steal') {
    // Only a car taken after the chapter started counts.
    if (state.stolenAtStart === undefined) state.stolenAtStart = player.carsStolen;
    if (player.carsStolen > state.stolenAtStart && !player.onFoot) advanceStep(state, now);
  } else if (step.kind === 'goto' || step.kind === 'checkpoint') {
    const target = stepTarget(state, world);
    if (target && Math.hypot(player.x - target.x, player.y - target.y) < step.radius) {
      if (step.kind === 'checkpoint') {
        effects.push({ kind: 'text', x: player.x, y: player.y - 40, text: 'Checkpoint!', life: 1.2, max: 1.2 });
      }
      advanceStep(state, now);
    }
  } else if (step.kind === 'lose-heat') {
    if (player.wanted === 0) advanceStep(state, now);
  }

  // Chapter 3's tail: the moment the package is picked up, the heat arrives.
  if (mission.id === 'harbor-heat' && state.step === 1 && state.stepJustAdvanced) {
    state.stepJustAdvanced = false;
    player.wanted = Math.max(player.wanted, 2);
    player.heat = Math.max(player.heat, 2);
    player.lastCrimeAt = now;
  }

  if (state.step >= mission.steps.length) {
    state.active = false;
    state.done = true;
    state.completed.push(mission.id);
    player.cash += mission.reward;
    player.missionsDone++;
    state.message = `${mission.title} complete: +$${mission.reward}`;
    state.messageAt = now;
    state.index++;
    return 'complete';
  }
  return null;
}

// Move to the next step and stamp the banner message.
function advanceStep(state, now) {
  state.step++;
  state.stepJustAdvanced = true;
  const mission = currentMission(state);
  const step = mission && mission.steps[state.step];
  if (step) {
    state.message = step.text;
    state.messageAt = now;
  }
}

// The objective line the HUD shows.
export function objectiveText(state) {
  const mission = currentMission(state);
  if (!mission) {
    if (state.index >= MISSIONS.length) return 'Story complete. Free roam: Solmar Bay is yours.';
    return 'Press N to start the next mission.';
  }
  const step = currentStep(state);
  return step ? step.text : mission.title;
}
