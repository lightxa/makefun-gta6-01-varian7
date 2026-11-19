// Save and load. Progress (mission, cash, health, ammo, position) is kept
// in localStorage under one key, so the game can be continued after the
// browser closes. Saving never touches the network.
const SAVE_KEY = 'solmar-bay-save-v1';

export function saveGameState(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function loadGameState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data.missionIndex !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadGameState() !== null;
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}
