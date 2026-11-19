// missions.js — the Solmar Bay story: five jobs for Rico Vega, handed out
// by fixer Marisol Reyes, plus taxi fares and Bay coins on the side.
// A mission is a list of steps; each step names a place or a condition and
// the game checks it every frame. Finish one to unlock the next.
export const MISSIONS = [
  {
    id: 'first-wheels',
    title: 'First Wheels',
    briefing: 'Marisol needs a driver. Steal any car on the street, then bring it to her garage. No cops, no fuss.',
    reward: 400,
    steps: [
      { type: 'steal', label: 'Steal a car (walk up to one and press E)' },
      { type: 'goto', x: 1000, y: 200, r: 90, label: "Drive to Marisol's Garage" },
    ],
  },
  {
    id: 'bayfront-pickup',
    title: 'Bayfront Pickup',
    briefing: 'A package waits at the Marina Pier. Grab it, then run it to the Harbor Docks. The pier is watched, expect heat.',
    reward: 700,
    steps: [
      { type: 'goto', x: 300, y: 600, r: 80, label: 'Pick up the package at Marina Pier' },
      { type: 'goto', x: 2800, y: 2100, r: 90, label: 'Deliver to the Harbor Docks' },
    ],
  },
  {
    id: 'getaway-driver',
    title: 'Getaway Driver',
    briefing: 'The crew is waiting at Solmar Plaza. Pick them up, then lose the cops: drop to zero stars before you park at the warehouse.',
    reward: 1000,
    steps: [
      { type: 'goto', x: 1590, y: 790, r: 90, label: 'Pick up the crew at Solmar Plaza' },
      { type: 'loseWanted', label: 'Lose the cops (wanted level 0)' },
      { type: 'goto', x: 2600, y: 1400, r: 90, label: 'Park at the Bay Warehouse' },
    ],
  },
  {
    id: 'harbor-heist',
    title: 'Harbor Heist',
    briefing: 'A Harbor Hauler full of goods sits at the docks. Take it and bring it to the warehouse in 90 seconds. Drive like the bay is on fire.',
    reward: 1500,
    steps: [
      { type: 'goto', x: 2800, y: 2100, r: 90, label: 'Reach the Harbor Docks' },
      { type: 'timed', seconds: 90, x: 2600, y: 1400, r: 100, label: 'Deliver the hauler to the Bay Warehouse (90s)' },
    ],
  },
  {
    id: 'king-of-the-bay',
    title: 'King of the Bay',
    briefing: 'One last run: take the package to the Hilltop Mansion. Every cop in Solmar Bay will be on you. Finish this and the bay is yours.',
    reward: 2500,
    steps: [
      { type: 'goto', x: 700, y: 2000, r: 100, label: 'Reach the Hilltop Mansion' },
      { type: 'survive', seconds: 20, label: 'Survive the heat for 20 seconds' },
    ],
  },
];

export class MissionRunner {
  constructor() {
    this.active = null;
    this.stepIndex = 0;
    this.stepTimer = 0;
    this.stepDoneFlash = 0;
    this.completed = [];
  }

  start(index, game) {
    const def = MISSIONS[index];
    if (!def) return false;
    this.active = { def, index };
    this.stepIndex = 0;
    this.stepTimer = 0;
    game.toast(`New job: ${def.title}`, def.briefing);
    game.audio.jingle();
    if (def.id === 'getaway-driver') game.police.addWanted(2, 'Crew pickup spotted');
    if (def.id === 'king-of-the-bay') game.police.addWanted(3, 'Mansion run');
    if (def.id === 'bayfront-pickup') game.police.addWanted(1, 'Pier watch');
    return true;
  }

  currentStep() {
    if (!this.active) return null;
    return this.active.def.steps[this.stepIndex] || null;
  }

  stepTarget() {
    const step = this.currentStep();
    if (!step || step.x === undefined) return null;
    return { x: step.x, y: step.y, r: step.r || 90 };
  }

  advance(game) {
    this.stepIndex++;
    this.stepDoneFlash = 1.4;
    game.audio.coin();
    if (this.stepIndex >= this.active.def.steps.length) {
      this.finish(game);
    } else {
      const step = this.currentStep();
      game.toast('Step done', step.label);
    }
  }

  finish(game) {
    const def = this.active.def;
    game.player.cash += def.reward;
    this.completed.push(def.id);
    game.toast(`Job complete: ${def.title}`, `+$${def.reward}. The next job is open.`);
    game.audio.jingle();
    game.saveProgress();
    this.active = null;
    this.stepIndex = 0;
  }

  fail(game, reason) {
    if (!this.active) return;
    game.toast('Job failed', reason);
    this.active = null;
    this.stepIndex = 0;
  }

  update(dt, game) {
    if (!this.active) return;
    this.stepDoneFlash = Math.max(0, this.stepDoneFlash - dt);
    const step = this.currentStep();
    if (!step) return;
    const p = game.player;
    if (step.type === 'goto') {
      const d = Math.hypot(p.x - step.x, p.y - step.y);
      if (d < step.r) this.advance(game);
    } else if (step.type === 'steal') {
      if (!p.onFoot) this.advance(game);
    } else if (step.type === 'loseWanted') {
      if (game.police.wanted === 0) this.advance(game);
    } else if (step.type === 'timed') {
      this.stepTimer += dt;
      const d = Math.hypot(p.x - step.x, p.y - step.y);
      if (d < step.r) this.advance(game);
      else if (this.stepTimer > step.seconds) this.fail(game, 'Out of time on the delivery.');
    } else if (step.type === 'survive') {
      this.stepTimer += dt;
      if (this.stepTimer > step.seconds) this.advance(game);
    }
  }

  objectiveText() {
    if (!this.active) return null;
    const step = this.currentStep();
    if (!step) return null;
    let label = step.label;
    if (step.type === 'timed') {
      const left = Math.max(0, Math.ceil(step.seconds - this.stepTimer));
      label += ` — ${left}s left`;
    }
    if (step.type === 'survive') {
      const left = Math.max(0, Math.ceil(step.seconds - this.stepTimer));
      label += ` — ${left}s`;
    }
    return { title: this.active.def.title, label };
  }
}

// Taxi fares: a side job that pays for quick driving.
export class TaxiJob {
  constructor() {
    this.active = false;
    this.pickup = null;
    this.dropoff = null;
    this.phase = 'pickup';
    this.timer = 0;
  }
  start(x, y, rng) {
    this.active = true;
    this.phase = 'pickup';
    this.pickup = { x, y };
    this.dropoff = { x: rng.range(400, 2900), y: rng.range(300, 2100) };
    this.timer = 0;
  }
  update(dt, game) {
    if (!this.active) return;
    this.timer += dt;
    const p = game.player;
    if (this.phase === 'pickup') {
      if (Math.hypot(p.x - this.pickup.x, p.y - this.pickup.y) < 70) {
        this.phase = 'dropoff';
        game.toast('Passenger aboard', 'Drive them to the yellow marker.');
      }
    } else if (Math.hypot(p.x - this.dropoff.x, p.y - this.dropoff.y) < 80) {
      this.active = false;
      const fare = 120 + Math.floor(this.timer);
      game.player.cash += fare;
      game.taxiDone = (game.taxiDone || 0) + 1;
      game.toast('Fare complete', `+$${fare} for the ride.`);
      game.audio.jingle();
      game.saveProgress();
    }
  }
  target() {
    if (!this.active) return null;
    return this.phase === 'pickup' ? this.pickup : this.dropoff;
  }
}
