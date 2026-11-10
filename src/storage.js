import { defaultCases, createNewCase } from './model.js';

const STORAGE_KEY_CASES = 'rosocenka_cases_v2';
const STORAGE_KEY_ACTIVE = 'rosocenka_active_case_id_v2';

export function getStoredCases() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CASES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
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
    localStorage.setItem(STORAGE_KEY_CASES, JSON.stringify(cases));
  } catch (e) {
    console.error('Error saving cases:', e);
  }
}

export function getActiveCaseId() {
  try {
    return localStorage.getItem(STORAGE_KEY_ACTIVE) || null;
  } catch {
    return null;
  }
}

export function setActiveCaseId(id) {
  try {
    if (id) {
      localStorage.setItem(STORAGE_KEY_ACTIVE, id);
    } else {
      localStorage.removeItem(STORAGE_KEY_ACTIVE);
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
