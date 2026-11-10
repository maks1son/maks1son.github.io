import { defaultCases, createNewCase } from './model.js';

const STORAGE_KEY_CASES = 'rosocenka_cases_v3';
const STORAGE_KEY_ACTIVE = 'rosocenka_active_case_id_v3';

function hasLocalStorage() {
  try {
    return typeof window !== 'undefined' && 'localStorage' in window && window.localStorage !== null;
  } catch {
    return false;
  }
}

export function getStoredCases() {
  try {
    if (hasLocalStorage()) {
      const raw = window.localStorage.getItem(STORAGE_KEY_CASES);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          let modified = false;
          parsed.forEach(c => {
            if (typeof c.isPinned !== 'boolean') {
              c.isPinned = c.number === '19/0826-2';
              modified = true;
            }
            if (c.progress == null) {
              c.progress = c.status === 'Готов' ? 100 : (c.status === 'Черновик' ? 25 : 75);
              modified = true;
            }
          });
          if (modified) saveCases(parsed);
          return parsed;
        }
      }
    }
  } catch (e) {
    console.error('Error loading cases:', e);
  }
  const initial = defaultCases();
  saveCases(initial);
  return initial;
}

export function saveCases(cases) {
  try {
    if (hasLocalStorage()) {
      window.localStorage.setItem(STORAGE_KEY_CASES, JSON.stringify(cases));
    }
  } catch (e) {
    console.error('Error saving cases:', e);
  }
}

export function toggleCasePin(cases, id) {
  const c = cases.find(item => item.id === id);
  if (c) {
    c.isPinned = !c.isPinned;
    c.updatedAt = new Date().toISOString();
    saveCases(cases);
  }
  return cases;
}

export function getActiveCaseId() {
  try {
    if (hasLocalStorage()) {
      return window.localStorage.getItem(STORAGE_KEY_ACTIVE) || null;
    }
    return null;
  } catch {
    return null;
  }
}

export function setActiveCaseId(id) {
  try {
    if (hasLocalStorage()) {
      if (id) {
        window.localStorage.setItem(STORAGE_KEY_ACTIVE, id);
      } else {
        window.localStorage.removeItem(STORAGE_KEY_ACTIVE);
      }
    }
  } catch {}
}

export function findCaseById(cases, id) {
  return cases.find(c => c.id === id) || null;
}

export function updateCase(cases, updatedCase) {
  updatedCase.updatedAt = new Date().toISOString();
  const idx = cases.findIndex(c => c.id === updatedCase.id);
  if (idx >= 0) {
    cases[idx] = updatedCase;
  } else {
    cases.unshift(updatedCase);
  }
  saveCases(cases);
  return cases;
}

export function deleteCaseById(cases, id) {
  const filtered = cases.filter(c => c.id !== id);
  saveCases(filtered);
  return filtered;
}

export function resetAllCases() {
  const initial = defaultCases();
  saveCases(initial);
  setActiveCaseId(initial[0].id);
  return initial;
}
