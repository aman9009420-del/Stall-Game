// Tiny localStorage wrapper (settings + personal records).

const KEY = 'stall-racer-save-v1';

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    const data = raw ? JSON.parse(raw) : {};
    return typeof data === 'object' && data ? data : {};
  } catch {
    return {};
  }
}

export function writeSave(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* storage may be unavailable (private mode) */
  }
}
