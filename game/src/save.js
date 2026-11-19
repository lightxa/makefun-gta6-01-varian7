// Save and load. Progress (completed missions, cash, health, position and
// the seed) lives in localStorage under one key, so the game can be
// continued after the browser closes. Saving never touches the network.
const SAVE_KEY = 'solmar-bay-save-v1';

export function saveGame(state) {
  try {
    const data = {
      version: 1,
      savedAt: Date.now(),
      seed: state.seed,
      cash: state.cash,
      health: state.health,
      missionIndex: state.missionIndex,
      completedMissions: state.completedMissions,
      playerX: state.player.x,
      playerY: state.player.y,
      totalEarned: state.totalEarned,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage unavailable; nothing to clear.
  }
}

export function hasSave() {
  return loadGame() !== null;
}
