// Saving Solmar Bay: cash, health, ammo, missions finished and the player's
// last position, kept in localStorage so a session survives a closed tab.
// Nothing leaves the browser.

const SAVE_KEY = 'solmar-bay-save-v1';

// Write the player's progress. Returns true when the save landed.
export function saveGame(state) {
  try {
    const data = {
      version: 1,
      savedAt: Date.now(),
      cash: state.player.cash,
      health: state.player.health,
      ammo: state.player.ammo,
      missionsDone: state.player.missionsDone,
      carsStolen: state.player.carsStolen,
      missionIndex: state.missions.index,
      completed: state.missions.completed,
      x: state.player.x,
      y: state.player.y,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    return false;
  }
}

// Read the save back, or null when there is none or it does not parse.
export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch (err) {
    return null;
  }
}

// Apply a save to a fresh state: restore the numbers and the position.
export function applySave(state, data) {
  state.player.cash = data.cash;
  state.player.health = data.health;
  state.player.ammo = data.ammo;
  state.player.missionsDone = data.missionsDone;
  state.player.carsStolen = data.carsStolen;
  state.missions.index = data.missionIndex;
  state.missions.completed = data.completed || [];
  state.player.x = data.x;
  state.player.y = data.y;
}
