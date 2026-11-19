// Missions and story. Five jobs from Mama Sol and Vex, each a chain of
// steps: go somewhere, steal a car, drive through checkpoints, lose the
// police, grab the cash and run. Completing a job pays cash and unlocks the
// next; the story ends when the Big Score is done.
import { MISSIONS } from './config.js';
import { dist } from './random.js';

export class MissionManager {
  constructor() {
    this.index = 0;
    this.stepIndex = 0;
    this.active = null;
    this.done = false;
    this.failed = false;
    this.failReason = '';
    this.timer = 0;
    this.stepTimer = 0;
    this.message = '';
    this.messageTimer = 0;
  }

  get current() {
    return MISSIONS[this.index] || null;
  }

  get step() {
    const m = this.current;
    return m ? m.steps[this.stepIndex] : null;
  }

  get objective() {
    if (this.done) return 'Story complete — Solmar Bay is yours, Dana.';
    if (!this.current) return '';
    const s = this.step;
    return s ? s.label : '';
  }

  start(index) {
    this.index = index;
    this.stepIndex = 0;
    this.done = false;
    this.failed = false;
    this.timer = 0;
    this.stepTimer = 0;
    const m = this.current;
    if (m && m.steps[0] && m.steps[0].time) this.stepTimer = m.steps[0].time;
    this.showMessage(`${m.title} — ${m.giver}: ${m.brief}`, 6);
  }

  showMessage(text, seconds) {
    this.message = text;
    this.messageTimer = seconds || 4;
  }

  advance(game) {
    const m = this.current;
    this.stepIndex += 1;
    if (this.stepIndex >= m.steps.length) {
      game.player.addCash(m.reward);
      game.audio.cash();
      this.showMessage(`Job done: ${m.title} — paid $${m.reward}.`, 5);
      game.saveGame();
      this.index += 1;
      if (this.index >= MISSIONS.length) {
        this.done = true;
        this.active = null;
        this.showMessage('THE BIG SCORE is done. Solmar Bay is yours.', 8);
        return;
      }
      this.stepIndex = 0;
      const next = this.current;
      this.showMessage(`New job: ${next.title} — ${next.giver}: ${next.brief}`, 7);
    }
    const s = this.step;
    this.stepTimer = s && s.time ? s.time : 0;
  }

  fail(reason) {
    this.failed = true;
    this.failReason = reason;
    this.showMessage(`Job failed: ${reason}. Press R to retry the job.`, 6);
  }

  retry() {
    this.failed = false;
    this.failReason = '';
    this.start(this.index);
  }

  update(dt, game) {
    if (this.messageTimer > 0) this.messageTimer -= dt;
    if (this.done || !this.current || this.failed) return;
    const m = this.current;
    const s = this.step;
    if (!s) return;
    this.timer += dt;
    const p = game.player;
    if (s.time) {
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.fail('Out of time.');
        return;
      }
    }
    if (s.kind === 'goto' || s.kind === 'driveTo') {
      const needCar = s.kind === 'driveTo';
      if (needCar && !p.inCar) return;
      if (dist(p.x, p.y, s.x, s.y) < s.radius) {
        this.advance(game);
      }
    } else if (s.kind === 'steal') {
      // Stealing is completed by the game's steal handler calling completeStep.
      if (dist(p.x, p.y, s.x, s.y) < s.radius && p.inCar) this.advance(game);
    } else if (s.kind === 'escape') {
      // Mission 4: the escape step is set up by the game (wanted 3). It
      // completes when the wanted level has fully decayed.
      if (game.police.stars === 0 && this.timer > 4) {
        this.advance(game);
      }
    }
  }

  // Called by the game when the player steals the mission car.
  completeStep(game) {
    const s = this.step;
    if (s && s.kind === 'steal') this.advance(game);
  }

  // Mission 4 setup: called when the job starts.
  isEscapeMission() {
    const m = this.current;
    return m && m.id === 4;
  }
}
