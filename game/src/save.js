// save.js — localStorage persistence for Solmar Bay.
// The save holds cash, mission progress, coins and the player's last spot,
// so a session survives a closed tab.
const KEY = 'solmar-bay-save-v1';

export function saveGame(state) {
  try {
    const data = {
      cash: state.cash,
      missionIndex: state.missionIndex,
      missionsDone: state.missionsDone,
      coinsTaken: state.coinsTaken,
      taxiDone: state.taxiDone,
      playerX: state.playerX,
      playerY: state.playerY,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number') return null;
    return data;
  } catch (err) {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}

export function clearSave() {
  try { window.localStorage.removeItem(KEY); } catch (err) { /* ignore */ }
}
