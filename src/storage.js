import { defaultCases, TEAM_MEMBERS } from './model.js';

const STORAGE_KEY_CASES = 'rosocenka_cases_v3';
const STORAGE_KEY_ACTIVE = 'rosocenka_active_case_id_v3';
const STORAGE_KEY_PROFILE = 'rosocenka_profile_v1';
const STORAGE_KEY_ACTIVITY = 'rosocenka_activity_v1';

function hasLocalStorage() {
  try {
    return typeof window !== 'undefined' && 'localStorage' in window && window.localStorage !== null;
  } catch {
    return false;
  }
}

export function toLocalDateStr(dateInput = new Date()) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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
            if (!c.assignedTo) {
              if (c.number === '21/0926-1') c.assignedTo = 'emp_lyuda';
              else if (c.number === '24/1105-3') c.assignedTo = 'emp_petya';
              else c.assignedTo = 'emp_anna';
              modified = true;
            }
            if (!c.checklist || typeof c.checklist !== 'object') {
              const isReady = c.status === 'Готов';
              c.checklist = {
                egrn: isReady,
                inspection: isReady,
                market: isReady,
                leifer: isReady,
                shares: isReady,
              };
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

/* ============================================================================
   Временный профиль (Руководитель / Оценщик)
   ============================================================================ */

export function getCurrentProfile() {
  const fallback = { role: 'manager', employeeId: 'emp_anna' };
  try {
    if (hasLocalStorage()) {
      const raw = window.localStorage.getItem(STORAGE_KEY_PROFILE);
      if (raw) {
        const p = JSON.parse(raw);
        if (p && (p.role === 'manager' || p.role === 'appraiser')) {
          const validEmp = TEAM_MEMBERS.find(m => m.id === p.employeeId);
          return {
            role: p.role,
            employeeId: validEmp ? validEmp.id : (p.role === 'manager' ? 'emp_anna' : 'emp_lyuda'),
          };
        }
      }
    }
  } catch {}
  return fallback;
}

export function setCurrentProfile(profile) {
  try {
    if (hasLocalStorage()) {
      window.localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(profile));
    }
  } catch {}
  return profile;
}

/* ============================================================================
   Умный трекинг активного времени (без простоя) и журнал действий отдела
   ============================================================================ */

function buildSeedActivityStore() {
  const now = new Date();
  const daysAgo = (d, hour = 10, min = 0) => {
    const dt = new Date(now.getFullYear(), now.getMonth(), now.getDate() - d, hour, min, 0);
    return dt;
  };
  const d0 = toLocalDateStr(daysAgo(0));
  const d1 = toLocalDateStr(daysAgo(1));
  const d3 = toLocalDateStr(daysAgo(3));
  const d5 = toLocalDateStr(daysAgo(5));
  const d12 = toLocalDateStr(daysAgo(12));
  const d18 = toLocalDateStr(daysAgo(18));

  const timeByDayEmp = {
    [d0]: {
      emp_lyuda: { activeSec: 7620, idleSec: 840 },   // 2ч 07м актив., 14м простоя
      emp_masha: { activeSec: 6480, idleSec: 540 },   // 1ч 48м актив., 9м простоя
      emp_sveta: { activeSec: 5100, idleSec: 1920 },  // 1ч 25м актив., 32м простоя
      emp_petya: { activeSec: 2340, idleSec: 4680 },  // 39м актив., 1ч 18м простоя (пылилась вкладка!)
      emp_anna: { activeSec: 3900, idleSec: 300 },
    },
    [d1]: {
      emp_lyuda: { activeSec: 11400, idleSec: 900 },
      emp_masha: { activeSec: 12600, idleSec: 780 },
      emp_sveta: { activeSec: 9840, idleSec: 1320 },
      emp_petya: { activeSec: 5400, idleSec: 3120 },
      emp_anna: { activeSec: 6900, idleSec: 420 },
    },
    [d3]: {
      emp_lyuda: { activeSec: 13200, idleSec: 1100 },
      emp_masha: { activeSec: 10800, idleSec: 660 },
      emp_sveta: { activeSec: 11520, idleSec: 960 },
      emp_petya: { activeSec: 7200, idleSec: 2400 },
    },
    [d5]: {
      emp_lyuda: { activeSec: 10200, idleSec: 840 },
      emp_masha: { activeSec: 14100, idleSec: 900 },
      emp_sveta: { activeSec: 8700, idleSec: 1080 },
    },
    [d12]: {
      emp_lyuda: { activeSec: 14400, idleSec: 1200 },
      emp_masha: { activeSec: 13500, idleSec: 950 },
      emp_sveta: { activeSec: 12000, idleSec: 1400 },
      emp_petya: { activeSec: 9600, idleSec: 2100 },
    },
    [d18]: {
      emp_anna: { activeSec: 12600, idleSec: 600 },
      emp_lyuda: { activeSec: 11800, idleSec: 900 },
      emp_masha: { activeSec: 12900, idleSec: 800 },
    },
  };

  const events = [
    {
      id: 'ev_1',
      timestamp: daysAgo(0, 11, 45).toISOString(),
      employeeId: 'emp_lyuda',
      caseId: 'case_21_0926',
      caseNumber: '21/0926-1',
      actionType: 'audit_formula',
      label: 'Сверка формул Лейфера',
      details: 'Проверила пошаговый расчёт поправок для 3 аналогов (V = 4,90% ≤ 33%)',
      isWarning: false,
    },
    {
      id: 'ev_2',
      timestamp: daysAgo(0, 11, 20).toISOString(),
      employeeId: 'emp_masha',
      caseId: 'case_24_1044',
      caseNumber: '24/1044-2',
      actionType: 'export_word',
      label: 'Выгружен официальный Word (.docx)',
      details: 'Отчёт сформирован и верифицирован по ФСО (качество 100%, 4 аналога со ссылками)',
      isWarning: false,
    },
    {
      id: 'ev_3',
      timestamp: daysAgo(0, 10, 50).toISOString(),
      employeeId: 'emp_petya',
      caseId: 'case_24_1105',
      caseNumber: '24/1105-3',
      actionType: 'status_blocked',
      label: 'Блокировка статуса «Готов»',
      details: 'Попытка закрыть сырой отчёт отклонена: нет аналогов, не пройден самоконтроль',
      isWarning: true,
    },
    {
      id: 'ev_4',
      timestamp: daysAgo(0, 10, 15).toISOString(),
      employeeId: 'emp_sveta',
      caseId: 'case_24_1081',
      caseNumber: '24/1081-1',
      actionType: 'add_analog',
      label: 'Добавлен аналог с Авито',
      details: 'Прикреплена прямая ссылка и пересчитаны веса выборки (V = 7,12%)',
      isWarning: false,
    },
    {
      id: 'ev_5',
      timestamp: daysAgo(1, 16, 40).toISOString(),
      employeeId: 'emp_masha',
      caseId: 'case_24_1044',
      caseNumber: '24/1044-2',
      actionType: 'status_ready',
      label: 'Отчёт переведён в «Готов»',
      details: 'Пройдены все 6 критериев качества ФСО №7 (100%)',
      isWarning: false,
    },
    {
      id: 'ev_6',
      timestamp: daysAgo(1, 14, 10).toISOString(),
      employeeId: 'emp_lyuda',
      caseId: 'case_21_0926',
      caseNumber: '21/0926-1',
      actionType: 'save_object',
      label: 'Обновлены данные ЕГРН',
      details: 'Сверены кадастровый номер, площадь 44,5 м² и доли собственности (100%)',
      isWarning: false,
    },
    {
      id: 'ev_7',
      timestamp: daysAgo(3, 15, 30).toISOString(),
      employeeId: 'emp_sveta',
      caseId: 'case_24_1019',
      caseNumber: '24/1019-4',
      actionType: 'export_word',
      label: 'Выгружен официальный Word (.docx)',
      details: 'Качество 100%, 4 аналога, однородность V = 6,34%',
      isWarning: false,
    },
    {
      id: 'ev_8',
      timestamp: daysAgo(5, 17, 5).toISOString(),
      employeeId: 'emp_lyuda',
      caseId: 'case_24_0998',
      caseNumber: '24/0998-1',
      actionType: 'export_word',
      label: 'Выгружен официальный Word (.docx)',
      details: 'Отчёт согласован (V = 5,10%), 3 правообладателя (100%)',
      isWarning: false,
    },
    {
      id: 'ev_9',
      timestamp: daysAgo(12, 13, 25).toISOString(),
      employeeId: 'emp_masha',
      caseId: 'case_24_0940',
      caseNumber: '24/0940-2',
      actionType: 'export_word',
      label: 'Выгружен официальный Word (.docx)',
      details: 'Качество 100%, полный пакет ФСО',
      isWarning: false,
    },
    {
      id: 'ev_10',
      timestamp: daysAgo(18, 16, 30).toISOString(),
      employeeId: 'emp_anna',
      caseId: 'case_anna_19_0826',
      caseNumber: '19/0826-2',
      actionType: 'export_word',
      label: 'Выгружен эталонный Word (.docx)',
      details: 'Дело № 19/0826-2 согласовано (3 506 000 ₽, V = 4,09%)',
      isWarning: false,
    },
  ];

  return { timeByDayEmp, events };
}

export function getActivityStore() {
  try {
    if (hasLocalStorage()) {
      const raw = window.localStorage.getItem(STORAGE_KEY_ACTIVITY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.events)) {
          return parsed;
        }
      }
    }
  } catch (e) {
    console.error('Error loading activity store:', e);
  }
  const seed = buildSeedActivityStore();
  saveActivityStore(seed);
  return seed;
}

export function saveActivityStore(store) {
  try {
    if (hasLocalStorage()) {
      window.localStorage.setItem(STORAGE_KEY_ACTIVITY, JSON.stringify(store));
    }
  } catch (e) {
    console.error('Error saving activity store:', e);
  }
}

export function logActivityEvent({ employeeId, caseId, caseNumber, actionType, label, details = '', isWarning = false }) {
  const store = getActivityStore();
  store.events.unshift({
    id: 'ev_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    timestamp: new Date().toISOString(),
    employeeId: employeeId || 'emp_anna',
    caseId: caseId || '',
    caseNumber: caseNumber || '—',
    actionType,
    label,
    details,
    isWarning: Boolean(isWarning),
  });
  // Ограничиваем историю 500 последними событиями
  if (store.events.length > 500) {
    store.events = store.events.slice(0, 500);
  }
  saveActivityStore(store);
  return store;
}

export function recordTimeTick(employeeId, isActive, secondsDelta = 5) {
  if (!employeeId) return;
  const store = getActivityStore();
  const day = toLocalDateStr(new Date());
  if (!store.timeByDayEmp[day]) store.timeByDayEmp[day] = {};
  if (!store.timeByDayEmp[day][employeeId]) {
    store.timeByDayEmp[day][employeeId] = { activeSec: 0, idleSec: 0 };
  }
  if (isActive) {
    store.timeByDayEmp[day][employeeId].activeSec += secondsDelta;
  } else {
    store.timeByDayEmp[day][employeeId].idleSec += secondsDelta;
  }
  saveActivityStore(store);
}

export function resetAllCases() {
  const initial = defaultCases();
  saveCases(initial);
  setActiveCaseId(initial[0].id);
  const seed = buildSeedActivityStore();
  saveActivityStore(seed);
  return initial;
}
