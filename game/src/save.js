// SOLMAR — save: the game state in localStorage, nothing else.
// Money, missions done, player position and health survive a reload.

const KEY = 'solmar-save-v1';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return {
      money: typeof data.money === 'number' ? data.money : 50,
      missionIndex: typeof data.missionIndex === 'number' ? data.missionIndex : 0,
      x: typeof data.x === 'number' ? data.x : -120,
      z: typeof data.z === 'number' ? data.z : 12,
      health: typeof data.health === 'number' ? data.health : 100,
    };
  } catch {
    return null;
  }
}

export function writeSave(state) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({
      money: Math.round(state.money),
      missionIndex: state.missionIndex,
      x: Math.round(state.x * 10) / 10,
      z: Math.round(state.z * 10) / 10,
      health: Math.round(state.health),
      savedAt: new Date().toISOString(),
    }));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // storage unavailable: nothing to clear
  }
}
