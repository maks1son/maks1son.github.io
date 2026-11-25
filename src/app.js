import { createIcons, icons } from 'lucide';
import {
  calculateValuation,
  calculateAnalogAudit,
  sumSharesFraction,
  getRemainingShareFraction,
  money,
  moneyWithCents,
  moneyPerSqm,
  sqm,
  percent,
  weightFmt,
  createNewCase,
  defaultAnalogs,
} from './model.js';
import {
  getStoredCases,
  saveCases,
  getActiveCaseId,
  setActiveCaseId,
  findCaseById,
  updateCase,
  deleteCaseById,
  resetAllCases,
  toggleCasePin,
} from './storage.js';
import { exportApartmentReport } from './report.js';
import '@fontsource-variable/onest';
import './styles.css';

// State
let cases = getStoredCases();
let activeCaseId = getActiveCaseId() || (cases[0] ? cases[0].id : null);
let currentView = 'dashboard'; // 'dashboard' | 'cabinet' | 'case'
let activeTab = 'analogs'; // 'object' | 'analogs' | 'calculation' | 'report'
let expandedAuditIds = new Set();
let analogCityFilter = 'all'; // 'all' | 'Тольятти' | 'Самара' | 'Сызрань'
let dashTableFilter = 'all'; // 'all' | 'pinned' | 'В работе' | 'Готов' | 'Черновик'
let dashChartView = 'chart'; // 'chart' | 'table'

// URL Query routing for direct tab/view access & screenshots
if (typeof window !== 'undefined' && window.location) {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('view')) currentView = urlParams.get('view');
    if (urlParams.get('tab')) activeTab = urlParams.get('tab');
    if (urlParams.get('case')) {
      activeCaseId = urlParams.get('case');
      setActiveCaseId(activeCaseId);
    }
  } catch (e) {}
}
let filterStatus = 'all';
let searchQuery = '';
let scrollObserver = null;
let isSidebarHovered = false;
let isSidebarPinned = typeof localStorage !== 'undefined' && localStorage.getItem('rosocenka_sidebar_pinned') === 'true';
let sidebarLeaveTimer = null;

// Glass Design System State
let glassSettings = {
  blur: 22,
  opacity: 0.35,
  saturation: 1.25,
  edge: 0.65,
  tint: '#ffffff',
};
let isGlassDrawerOpen = false;
let chartPeriod = 'month'; // 'week' | 'month' | 'year'

function applyGlassSettings() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--gw-blur', `${glassSettings.blur}px`);
  root.style.setProperty('--gw-opacity', glassSettings.opacity);
  root.style.setProperty('--gw-saturation', glassSettings.saturation);
  root.style.setProperty('--gw-edge', glassSettings.edge);
  root.style.setProperty('--gw-tint', glassSettings.tint);
}
applyGlassSettings();

const icon = name => `<i data-lucide="${name}"></i>`;
const CLOSE_ICON_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;

function renderRosocenkaCheckbox({ attrs = '', checked = false, title = '', asSpan = false } = {}) {
  const tag = asSpan ? 'span' : 'label';
  const titleAttr = title ? ` title="${title}"` : '';
  return `
    <${tag} class="ro-checkbox"${titleAttr}>
      <input type="checkbox" ${attrs} ${checked ? 'checked' : ''}>
      <span class="ro-checkbox-visual" aria-hidden="true">
        <svg viewBox="0 0 20 20" fill="none">
          <path class="ro-cb-check" pathLength="1" d="M5.2 10.3L8.4 13.5L14.8 6.8" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
    </${tag}>
  `;
}

function toast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('visible');
  setTimeout(() => el.classList.remove('visible'), 3500);
}

function getActiveCase() {
  return findCaseById(cases, activeCaseId) || cases[0] || null;
}

/**
 * Плавный переход между вкладками и представлениями (View Transitions API + Fallback)
 */
function transitionRender(actionFn) {
  if (typeof document !== 'undefined' && typeof document.startViewTransition === 'function') {
    document.startViewTransition(() => {
      if (actionFn) actionFn();
      render();
    });
  } else {
    if (actionFn) actionFn();
    render();
  }
}

/**
 * Непрерывное отслеживание курсора над боковой панелью, чтобы она не закрывалась при кликах
 */
function setupSidebarEvents(sidebar) {
  sidebar.addEventListener('mouseenter', () => {
    isSidebarHovered = true;
    if (sidebarLeaveTimer) {
      clearTimeout(sidebarLeaveTimer);
      sidebarLeaveTimer = null;
    }
    sidebar.classList.add('is-expanded');
  });

  sidebar.addEventListener('mousemove', () => {
    isSidebarHovered = true;
    if (sidebarLeaveTimer) {
      clearTimeout(sidebarLeaveTimer);
      sidebarLeaveTimer = null;
    }
    if (!sidebar.classList.contains('is-expanded')) {
      sidebar.classList.add('is-expanded');
    }
  });

  sidebar.addEventListener('mouseleave', () => {
    isSidebarHovered = false;
    if (sidebarLeaveTimer) {
      clearTimeout(sidebarLeaveTimer);
    }
    sidebarLeaveTimer = setTimeout(() => {
      if (!isSidebarHovered && !isSidebarPinned) {
        sidebar.classList.remove('is-expanded');
      }
    }, 200);
  });
}

/**
 * HTML содержимое боковой панели
 */
function renderSidebarContent(activeCase, inProgressCount, readyCount) {
  return `
    <div class="sidebar-header">
      <img class="brand-emblem-img" src="/images/rosocenka-emblem.png" alt="РусОценка">
      <div class="brand-title">
        <strong>РУСОЦЕНКА</strong>
        <span>Кабинет оценщика</span>
      </div>
      <button type="button" class="btn-sidebar-pin ${isSidebarPinned ? 'pinned' : ''}" id="btn-sidebar-pin" title="${isSidebarPinned ? 'Открепить боковую панель' : 'Закрепить боковую панель'}">
        ${icon(isSidebarPinned ? 'pin-off' : 'pin')}
      </button>
    </div>

    <div class="sidebar-cta">
      <button class="btn-create-case" id="btn-create-case-sidebar" title="Создать новый отчёт">
        ${icon('plus')} <span class="nav-label">Новый отчёт</span>
      </button>
    </div>

    <nav class="sidebar-nav">
      <button class="nav-item ${currentView === 'dashboard' ? 'active' : ''}" data-nav="dashboard" title="Главная">
        <span class="nav-icon">${icon('layout-dashboard')}</span>
        <span class="nav-label">Главная</span>
      </button>
      <button class="nav-item ${currentView === 'cabinet' && filterStatus === 'all' ? 'active' : ''}" data-nav="all-cases" title="Все дела (${cases.length})">
        <span class="nav-icon">${icon('folder')}</span>
        <span class="nav-label">Все дела</span>
        <span class="nav-badge">${cases.length}</span>
      </button>
      <button class="nav-item ${currentView === 'cabinet' && filterStatus === 'В работе' ? 'active' : ''}" data-nav="in-progress" title="В работе (${inProgressCount})">
        <span class="nav-icon">${icon('clock')}</span>
        <span class="nav-label">В работе</span>
        <span class="nav-badge">${inProgressCount}</span>
      </button>
      <button class="nav-item ${currentView === 'cabinet' && filterStatus === 'Готов' ? 'active' : ''}" data-nav="ready" title="Готовые отчёты (${readyCount})">
        <span class="nav-icon">${icon('check-circle')}</span>
        <span class="nav-label">Готовые отчёты</span>
        <span class="nav-badge">${readyCount}</span>
      </button>

      ${activeCase ? `
        <div class="sidebar-divider"></div>
        <button class="nav-item ${currentView === 'case' && activeTab === 'object' ? 'active' : ''}" data-tab="object" title="1. Объект оценки">
          <span class="nav-icon">${icon('home')}</span>
          <span class="nav-label">1. Объект оценки</span>
        </button>
        <button class="nav-item ${currentView === 'case' && activeTab === 'analogs' ? 'active' : ''}" data-tab="analogs" title="2. Аналоги и поправки">
          <span class="nav-icon">${icon('layers')}</span>
          <span class="nav-label">2. Аналоги и поправки</span>
        </button>
        <button class="nav-item ${currentView === 'case' && activeTab === 'calculation' ? 'active' : ''}" data-tab="calculation" title="3. Расчёт и доли">
          <span class="nav-icon">${icon('calculator')}</span>
          <span class="nav-label">3. Расчёт и доли</span>
        </button>
        <button class="nav-item ${currentView === 'case' && activeTab === 'report' ? 'active' : ''}" data-tab="report" title="4. Готовый документ">
          <span class="nav-icon">${icon('file-text')}</span>
          <span class="nav-label">4. Готовый документ</span>
        </button>
      ` : ''}
    </nav>

    <div class="sidebar-profile" title="Орлова Анна Александровна · Ведущий оценщик">
      <div class="profile-avatar">АО</div>
      <div class="profile-info">
        <span class="profile-name">Орлова Анна А.</span>
        <span class="profile-role">Ведущий оценщик</span>
      </div>
    </div>
  `;
}

/**
 * Живая диаграмма динамики цен за 1 м² и портфеля оценки
 */
function buildSmoothMonotonePath(pts) {
  if (pts.length < 2) return '';
  const n = pts.length;
  const dx = [];
  const slope = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1][0] - pts[i][0]);
    slope.push((pts[i + 1][1] - pts[i][1]) / (dx[i] || 1));
  }
  const m = [slope[0]];
  for (let i = 1; i < n - 1; i++) {
    m.push(
      slope[i - 1] * slope[i] <= 0
        ? 0
        : (3 * (dx[i - 1] + dx[i])) /
            ((2 * dx[i] + dx[i - 1]) / slope[i - 1] + (dx[i] + 2 * dx[i - 1]) / slope[i])
    );
  }
  m.push(slope[n - 2]);
  let d = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const h = dx[i] / 3;
    d += ` C ${(x0 + h).toFixed(2)} ${(y0 + m[i] * h).toFixed(2)}, ${(x1 - h).toFixed(2)} ${(y1 - m[i + 1] * h).toFixed(2)}, ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  }
  return d;
}

function renderSparklineSvg(values, strokeColor = '#0066cc', uid = 'sp') {
  const w = 78;
  const h = 32;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pts = values.map((v, i) => [
    (i / Math.max(1, values.length - 1)) * (w - 6) + 3,
    h - 4 - ((v - min) / (max - min || 1)) * (h - 8),
  ]);
  const d = buildSmoothMonotonePath(pts);
  const last = pts[pts.length - 1];
  return `
    <svg class="kpi-sparkline" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">
      <defs>
        <linearGradient id="spark-grad-${uid}" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="${strokeColor}" stop-opacity="0.16" />
          <stop offset="100%" stop-color="${strokeColor}" stop-opacity="0" />
        </linearGradient>
      </defs>
      <path d="${d} L ${last[0].toFixed(2)} ${h} L ${pts[0][0].toFixed(2)} ${h} Z" fill="url(#spark-grad-${uid})" />
      <path d="${d}" fill="none" stroke="${strokeColor}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" opacity="0.7" />
      <circle cx="${last[0].toFixed(2)}" cy="${last[1].toFixed(2)}" r="2.8" fill="${strokeColor}" stroke="#ffffff" stroke-width="1.5" />
    </svg>
  `;
}

function getDashboardChartPoints(period) {
  if (period === 'week') {
    return [
      { label: 'Пн', price: 53800, prev: 53100 },
      { label: 'Вт', price: 54000, prev: 53250 },
      { label: 'Ср', price: 54150, prev: 53400 },
      { label: 'Чт', price: 54300, prev: 53550 },
      { label: 'Пт', price: 54380, prev: 53620 },
      { label: 'Сб', price: 54450, prev: 53700 },
      { label: 'Вс', price: 54500, prev: 53800 },
    ];
  }
  if (period === 'year') {
    return [
      { label: 'Янв', price: 48500, prev: 46200 },
      { label: 'Мар', price: 49800, prev: 47100 },
      { label: 'Май', price: 51200, prev: 48400 },
      { label: 'Июл', price: 52500, prev: 49600 },
      { label: 'Сен', price: 53600, prev: 50900 },
      { label: 'Ноя', price: 54380, prev: 52100 },
    ];
  }
  return [
    { label: '01 ноя', price: 52900, prev: 51600 },
    { label: '06 ноя', price: 53300, prev: 51900 },
    { label: '11 ноя', price: 53700, prev: 52250 },
    { label: '16 ноя', price: 54100, prev: 52600 },
    { label: '21 ноя', price: 54380, prev: 52950 },
    { label: '26 ноя', price: 54650, prev: 53200 },
    { label: '30 ноя', price: 54900, prev: 53500 },
  ];
}

function renderGlassChart(period) {
  const points = getDashboardChartPoints(period);

  if (dashChartView === 'table') {
    return `
      <div class="dash-chart-table-wrap">
        <table class="dash-mini-table">
          <thead>
            <tr>
              <th>Период</th>
              <th style="text-align: right;">Текущий</th>
              <th style="text-align: right;">Прошлый</th>
              <th style="text-align: right;">Динамика</th>
            </tr>
          </thead>
          <tbody>
            ${points.map(p => {
              const delta = ((p.price - p.prev) / p.prev) * 100;
              return `
                <tr>
                  <td>${p.label}</td>
                  <td style="text-align: right; font-weight: 650;">${moneyPerSqm(p.price)}</td>
                  <td style="text-align: right; color: var(--text-muted);">${moneyPerSqm(p.prev)}</td>
                  <td style="text-align: right; color: #059669; font-weight: 600;">+${delta.toFixed(1).replace('.', ',')}%</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  const minPrice = period === 'year' ? 45000 : 49000;
  const maxPrice = 56000;
  const width = 680;
  const height = 196;
  const padLeft = 10;
  const padRight = 10;
  const padTop = 18;
  const padBottom = 14;
  const usableW = width - padLeft - padRight;
  const usableH = height - padTop - padBottom;

  const getX = i => padLeft + (i * usableW) / Math.max(1, points.length - 1);
  const getY = val => padTop + usableH - ((val - minPrice) / (maxPrice - minPrice)) * usableH;

  const curPts = points.map((p, i) => [getX(i), getY(p.price)]);
  const prevPts = points.map((p, i) => [getX(i), getY(p.prev)]);
  const lineD = buildSmoothMonotonePath(curPts);
  const prevD = buildSmoothMonotonePath(prevPts);

  const baselineY = height - padBottom;
  const areaD = `${lineD} L ${curPts[curPts.length - 1][0].toFixed(2)} ${baselineY} L ${curPts[0][0].toFixed(2)} ${baselineY} Z`;

  const activeIndex = points.findIndex(p => p.price === 54380) !== -1
    ? points.findIndex(p => p.price === 54380)
    : points.length - 1;
  const activeCoord = curPts[activeIndex];
  const activePoint = points[activeIndex];
  const activePctX = ((activeCoord[0] / width) * 100).toFixed(2);

  const ticks = period === 'year' ? [56000, 52000, 48000, 45000] : [56000, 52500, 49000];

  return `
    <div class="gw-chart-wrap" data-chart-interactive="true">
      <div class="gw-chart-labels">
        ${ticks.map(t => `<span>${(t / 1000).toFixed(1).replace('.0', '')} тыс. ₽</span>`).join('')}
      </div>
      <div class="gw-chart-canvas-wrap">
        <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
          <defs>
            <linearGradient id="gw-chart-grad-${period}" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#0066cc" stop-opacity="0.20" />
              <stop offset="75%" stop-color="#0066cc" stop-opacity="0.03" />
              <stop offset="100%" stop-color="#0066cc" stop-opacity="0.0" />
            </linearGradient>
          </defs>

          ${ticks.map(t => {
            const ty = getY(t).toFixed(1);
            return `<line x1="0" y1="${ty}" x2="${width}" y2="${ty}" stroke="#e2e8f0" stroke-dasharray="3 4" stroke-width="1" />`;
          }).join('')}

          <line x1="${activeCoord[0].toFixed(1)}" y1="${padTop}" x2="${activeCoord[0].toFixed(1)}" y2="${baselineY}" stroke="#cbd5e1" stroke-width="1" stroke-dasharray="3 3" id="chart-crosshair-line" />

          <path d="${prevD}" fill="none" stroke="#94a3b8" stroke-width="1.6" stroke-dasharray="4 4" stroke-linecap="round" opacity="0.75" />
          <path d="${areaD}" fill="url(#gw-chart-grad-${period})" />
          <path d="${lineD}" fill="none" stroke="#0066cc" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />

          ${curPts.map((c, idx) => `
            <circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="${idx === activeIndex ? '4.5' : '3'}" fill="${idx === activeIndex ? '#0066cc' : '#ffffff'}" stroke="#0066cc" stroke-width="${idx === activeIndex ? '2' : '1.6'}" class="chart-dot" data-point-idx="${idx}" />
          `).join('')}
        </svg>

        <div class="gw-chart-pin-badge" id="chart-pin-badge" style="left: ${activePctX}%; top: ${activeCoord[1].toFixed(1)}px;">
          ${activePoint.price.toLocaleString('ru-RU')} ₽
        </div>
      </div>
      <div class="gw-chart-months">
        ${points.map(p => `<span>${p.label}</span>`).join('')}
      </div>
    </div>
  `;
}

/**
 * Панель настроек стекла (Glass Appearance Adjuster)
 */
function renderGlassSettingsDrawer() {
  return '';
}

/**
 * Плавающий стеклянный док навигации внизу экрана
 */
function renderFloatingDock() {
  return '';
}

/**
 * HTML содержимое верхней панели
 */
function renderTopbarContent(activeCase) {
  return `
    <div class="topbar-left">
      <div class="breadcrumb">
        ${currentView === 'dashboard' ? `
          <strong>Главная страница</strong>
        ` : currentView === 'cabinet' ? `
          <a href="#" id="crumb-dashboard">Главная</a>
          <span>/</span>
          <strong>Личный кабинет</strong>
        ` : `
          <a href="#" id="crumb-dashboard">Главная</a>
          <span>/</span>
          <a href="#" id="crumb-cabinet">Личный кабинет</a>
          <span>/</span>
          <strong>Дело № ${activeCase ? activeCase.number : '—'}</strong>
          ${activeCase ? `<span>(${activeCase.objectData.rooms}-к. кв., ${sqm(activeCase.objectData.area)})</span>` : ''}
        `}
      </div>
    </div>

    <div class="topbar-right">
      <span class="save-status-badge">
        ${icon('check')} Сохранено
      </span>
      ${currentView === 'case' && activeCase ? `
        <button class="btn btn-secondary btn-sm" id="btn-top-print">
          ${icon('printer')} Печать
        </button>
        <button class="btn btn-primary btn-sm" id="btn-top-word">
          ${icon('file-text')} Скачать Word (.docx)
        </button>
      ` : `
        <button class="btn btn-secondary btn-sm" id="btn-reset-demo" title="Восстановить эталонные дела">
          ${icon('rotate-ccw')} Сброс демо-дел
        </button>
        <button class="btn btn-primary btn-sm" id="btn-top-new-case">
          ${icon('plus')} Добавить объект
        </button>
      `}
    </div>
  `;
}

function render() {
  const app = document.getElementById('app');
  let sidebar = document.getElementById('app-sidebar');
  let topbar = document.getElementById('app-topbar');
  let pageContainer = document.getElementById('page-container');

  // Создаем постоянный каркас приложения один раз, чтобы сайдбар не пересоздавался и не захлопывался
  if (!sidebar || !topbar || !pageContainer) {
    app.innerHTML = `
      <!-- Atmospheric Room Background & Ambient Shade -->
      <div class="gw-room" style="background-image: url('/images/dashboard-hero.jpg');"></div>
      <div class="gw-room-shade"></div>

      <!-- Chrome-like Expandable Sidebar (White & Light Blue) -->
      <aside class="app-sidebar ${isSidebarPinned ? 'is-pinned is-expanded' : ''}" id="app-sidebar"></aside>

      <!-- Main Content Area -->
      <div class="app-main">
        <header class="app-topbar gw-glass" id="app-topbar"></header>
        <main class="page-container" id="page-container"></main>
      </div>

      <div id="toast" role="status" aria-live="polite"></div>
      <dialog id="modal-dialog"></dialog>
    `;
    sidebar = document.getElementById('app-sidebar');
    topbar = document.getElementById('app-topbar');
    pageContainer = document.getElementById('page-container');
    setupSidebarEvents(sidebar);
  }

  // Сохраняем состояние раскрытия/закрепления при перерисовке
  if (isSidebarPinned) {
    sidebar.classList.add('is-pinned');
    sidebar.classList.add('is-expanded');
  } else if (isSidebarHovered) {
    sidebar.classList.add('is-expanded');
  }

  const activeCase = getActiveCase();
  const inProgressCount = cases.filter(c => c.status === 'В работе').length;
  const readyCount = cases.filter(c => c.status === 'Готов').length;

  sidebar.innerHTML = renderSidebarContent(activeCase, inProgressCount, readyCount);
  topbar.innerHTML = renderTopbarContent(activeCase);
  pageContainer.innerHTML = `
    <div class="view-pane" data-view-pane="${currentView}">
      ${currentView === 'dashboard'
        ? renderDashboardView()
        : (currentView === 'cabinet' ? renderCabinetView() : renderCaseWorkspaceView(activeCase))}
    </div>
  `;

  createIcons({ icons });
  bindEvents();
}

/**
 * Очистка адреса от префикса «Самарская область» для лаконичного отображения
 */
function cleanDisplayAddress(addr) {
  if (!addr) return '';
  return addr.replace(/^(Самарская область|Самарская обл\.),?\s*/i, '');
}

/**
 * Карточка дела для отображения на Главной и в Личном кабинете
 * Ультра-минималистичная, крупная, без визуального шума
 */
function renderCaseDashboardCard(c) {
  const res = calculateValuation(c.objectData, c.analogs, c.objectData.tradeAdjustment);
  const statusClass = c.status === 'Готов' ? 'ready' : (c.status === 'В работе' ? 'in-progress' : 'draft');
  const displayTotal = res.total
    ? money(res.total)
    : money(Math.round((c.objectData.area * 47000) / 1000) * 1000);
  const displayPerSqm = res.pricePerSqm
    ? moneyPerSqm(res.pricePerSqm)
    : '~47 000 ₽/м²';
  const displayAddr = cleanDisplayAddress(c.objectData.address);

  return `
    <div class="case-card ${c.isPinned ? 'is-pinned-card' : ''}">
      <div class="case-card-main">
        <div class="case-card-header">
          <button class="btn-star ${c.isPinned ? 'pinned' : ''}" data-action="toggle-pin" data-id="${c.id}" title="${c.isPinned ? 'Открепить дело' : 'Закрепить дело на главной'}">
            ${icon('star')}
          </button>
          <span class="case-num">Дело № ${c.number}</span>
          <span class="badge-status ${statusClass}">${c.status}</span>
          <span class="case-date-tag">${c.objectData.valuationDate}</span>
        </div>
        <div class="case-addr">${displayAddr}</div>
        <div class="case-tags">
          <span class="case-tag">${sqm(c.objectData.area)}</span>
          <span class="case-tag">${c.objectData.floor}/${c.objectData.totalFloors} эт.</span>
          <span class="case-tag">${c.objectData.client}</span>
        </div>
      </div>

      <div class="case-card-side">
        <div class="case-price-box">
          <div class="case-val-amount">${displayTotal}</div>
          <div class="case-val-sub">${displayPerSqm}</div>
        </div>
        <div class="case-actions">
          ${c.status === 'Готов' ? `
            <button class="btn btn-secondary btn-sm" data-action="export-word" data-id="${c.id}" title="Скачать официальный Word (.docx)">
              ${icon('file-text')} Word
            </button>
          ` : ''}
          <button class="btn btn-danger btn-sm btn-icon-only" data-action="delete-case" data-id="${c.id}" title="Удалить дело">
            ${icon('trash-2')}
          </button>
          <button class="btn btn-primary btn-sm" data-action="${c.status === 'Готов' ? 'open-case' : 'continue-case'}" data-id="${c.id}">
            ${icon('arrow-right')} ${c.status === 'Готов' ? 'Открыть' : (c.status === 'Черновик' ? 'Заполнить' : 'Продолжить')}
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Рендер Главной страницы (Executive Overview Dashboard)
 */
function renderDashboardView() {
  const inProgressCases = cases.filter(c => c.status === 'В работе');
  const readyCases = cases.filter(c => c.status === 'Готов');
  const draftCases = cases.filter(c => c.status === 'Черновик');
  const pinnedCases = cases.filter(c => c.isPinned);
  const unfinishedCases = cases.filter(c => c.status === 'В работе' || c.status === 'Черновик');

  // Суммарная стоимость портфеля
  let totalValuation = 0;
  cases.forEach(c => {
    const res = calculateValuation(c.objectData, c.analogs, c.objectData.tradeAdjustment);
    if (res.total) {
      totalValuation += res.total;
    } else {
      totalValuation += Math.round((c.objectData.area * 47000) / 1000) * 1000;
    }
  });

  const avgPricePerSqm = 54380;
  const variationCoeff = 4.1;
  const totalCount = cases.length || 1;
  const readyPct = Math.round((readyCases.length / totalCount) * 100);
  const withAnalogsCount = cases.filter(c => c.analogs && c.analogs.length >= 3).length;
  const withAnalogsPct = Math.round((withAnalogsCount / totalCount) * 100);
  const leiferReadyCount = cases.filter(c => c.analogs && c.analogs.filter(a => a.selected).length >= 3).length;
  const leiferReadyPct = Math.round((leiferReadyCount / totalCount) * 100);
  const pipelineOverallPct = Math.round((100 + withAnalogsPct + leiferReadyPct + readyPct + readyPct) / 5);
  const gaugeCirc = 150.8;
  const gaugeOffset = (gaugeCirc * (1 - pipelineOverallPct / 100)).toFixed(1);

  const spotlightCase = findCaseById(cases, 'case_anna_19_0826') || readyCases[0] || cases[0];
  const spotlightRes = spotlightCase
    ? calculateValuation(spotlightCase.objectData, spotlightCase.analogs, spotlightCase.objectData.tradeAdjustment)
    : null;
  const spotlightAmount = spotlightRes && spotlightRes.total ? money(spotlightRes.total) : '3 539 000 ₽';
  const spotlightSharesCount = (spotlightCase && spotlightCase.objectData.shares && spotlightCase.objectData.shares.length) || 5;

  // Разбивка портфеля по городам/локациям
  const locationMap = new Map();
  cases.forEach(c => {
    const res = calculateValuation(c.objectData, c.analogs, c.objectData.tradeAdjustment);
    const val = res.total || Math.round((c.objectData.area * 47000) / 1000) * 1000;
    const addr = (c.objectData.address || '').toLowerCase();
    let city = 'Другие локации';
    if (addr.includes('тольятти')) city = 'г. Тольятти';
    else if (addr.includes('самара')) city = 'г. Самара';
    else if (addr.includes('сызрань')) city = 'г. Сызрань';
    locationMap.set(city, (locationMap.get(city) || 0) + val);
  });
  const locations = Array.from(locationMap.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
  const maxLocVal = Math.max(1, ...locations.map(l => l.value));

  const tableCases = cases.filter(c => {
    if (dashTableFilter === 'pinned') return c.isPinned;
    if (dashTableFilter === 'В работе' || dashTableFilter === 'Готов' || dashTableFilter === 'Черновик') {
      return c.status === dashTableFilter;
    }
    return true;
  });

  return `
    <!-- Top Executive Header Row (21st.dev composition in Onest + Rosocenka Blue) -->
    <section class="dash-top-row anim-fade-up">
      <div>
        <h1 class="welcome-title">Здравствуйте, Анна Александровна!</h1>
        <p class="dash-subtitle">Портфель оценки жилой недвижимости · Ноябрь 2026</p>
      </div>
      <div class="dash-top-controls">
        <div class="gw-segment" role="group" aria-label="Период графика">
          <button type="button" class="${chartPeriod === 'week' ? 'active' : ''}" data-period="week">Неделя</button>
          <button type="button" class="${chartPeriod === 'month' ? 'active' : ''}" data-period="month">Месяц</button>
          <button type="button" class="${chartPeriod === 'year' ? 'active' : ''}" data-period="year">Год</button>
        </div>
        <button class="btn btn-primary" id="btn-hero-new">
          ${icon('plus')} Добавить объект
        </button>
      </div>
    </section>

    <!-- Tier 1: 4-Column KPI Strip with Smooth Sparklines -->
    <section class="kpi-strip-grid anim-fade-up anim-delay-1" aria-label="Ключевые показатели">
      <article class="kpi-card">
        <div class="kpi-card-label">Портфель в оценке</div>
        <div class="kpi-card-body">
          <div class="kpi-card-main">
            <div class="kpi-card-val">${money(totalValuation)}</div>
            <div class="kpi-card-meta">
              <span class="kpi-delta pos">↗ +12,0%</span>
              <span class="kpi-sub">к прошлому мес.</span>
            </div>
          </div>
          ${renderSparklineSvg([11.2, 11.8, 12.1, 12.9, 13.4, 14.0, 14.48], '#0066cc', 'portfolio')}
        </div>
      </article>

      <article class="kpi-card">
        <div class="kpi-card-label">Средняя цена 1 м²</div>
        <div class="kpi-card-body">
          <div class="kpi-card-main">
            <div class="kpi-card-val">${moneyPerSqm(avgPricePerSqm)}</div>
            <div class="kpi-card-meta">
              <span class="kpi-delta pos">↗ +2,4%</span>
              <span class="kpi-sub">по рынку</span>
            </div>
          </div>
          ${renderSparklineSvg([52900, 53300, 53700, 54100, 54380, 54650, 54900], '#059669', 'sqm')}
        </div>
      </article>

      <article class="kpi-card" style="cursor: pointer;" data-nav="all-cases" title="Открыть все дела">
        <div class="kpi-card-label">Дела в работе / Готово</div>
        <div class="kpi-card-body">
          <div class="kpi-card-main">
            <div class="kpi-card-val">${inProgressCases.length} <span style="font-size: 16px; color: var(--text-muted); font-weight: 500;">/ ${readyCases.length}</span></div>
            <div class="kpi-card-meta">
              <span class="kpi-delta neutral">Всего ${cases.length}</span>
              <span class="kpi-sub">в архиве</span>
            </div>
          </div>
          ${renderSparklineSvg([2, 3, 2, 4, 3, 5, cases.length], '#2563eb', 'cases')}
        </div>
      </article>

      <article class="kpi-card">
        <div class="kpi-card-label">Однородность ФСО (V)</div>
        <div class="kpi-card-body">
          <div class="kpi-card-main">
            <div class="kpi-card-val">V = ${variationCoeff.toFixed(1).replace('.', ',')}%</div>
            <div class="kpi-card-meta">
              <span class="kpi-delta pos">≤ 33% норма</span>
              <span class="kpi-sub">Лейфер</span>
            </div>
          </div>
          ${renderSparklineSvg([5.2, 4.9, 4.7, 4.4, 4.3, 4.1, 4.1], '#059669', 'fso')}
        </div>
      </article>
    </section>

    <!-- Tier 2: Asymmetric Main Analytics (Chart + Breakdown/Standards) -->
    <div class="dash-analytics-grid anim-fade-up anim-delay-2">
      <!-- Left: Dual-line Market Chart + Table Toggle -->
      <section class="gw-panel dash-chart-panel">
        <div class="dash-chart-head">
          <div>
            <h2 class="gw-cashflow-title">Динамика рынка и портфеля</h2>
            <div class="dash-chart-kpi-line">
              <strong>${moneyPerSqm(avgPricePerSqm)}</strong>
              <span>+2,4% к прошлому периоду · контроль V = ${variationCoeff.toFixed(1).replace('.', ',')}%</span>
            </div>
          </div>
          <div class="dash-chart-tools">
            <ul class="chart-legend" aria-label="Легенда">
              <li><span class="legend-line cur"></span> Текущий</li>
              <li><span class="legend-line prev"></span> Прошлый</li>
            </ul>
            <div class="view-toggle-group" role="group" aria-label="Вид данных">
              <button type="button" class="view-toggle-btn ${dashChartView === 'chart' ? 'active' : ''}" data-chart-view="chart" title="График">
                ${icon('trending-up')}
              </button>
              <button type="button" class="view-toggle-btn ${dashChartView === 'table' ? 'active' : ''}" data-chart-view="table" title="Таблица">
                ${icon('table-2')}
              </button>
            </div>
          </div>
        </div>

        ${renderGlassChart(chartPeriod)}
      </section>

      <!-- Right: Portfolio Breakdown by Location + Monthly Plan -->
      <section class="gw-panel dash-breakdown-panel">
        <div class="panel-head-flex" style="margin-bottom: 16px;">
          <h2 class="gw-cashflow-title">Портфель по локациям</h2>
          <span class="breakdown-total">${money(totalValuation)}</span>
        </div>

        <ul class="breakdown-list">
          ${locations.map((loc, idx) => {
            const sharePct = Math.round((loc.value / Math.max(1, totalValuation)) * 100);
            const barWidth = Math.round((loc.value / maxLocVal) * 100);
            const opacity = Math.max(0.45, 1 - idx * 0.2);
            return `
              <li class="breakdown-item">
                <div class="breakdown-row">
                  <span class="breakdown-name">${loc.label}</span>
                  <span class="breakdown-vals">${money(loc.value)} <span class="breakdown-pct">${sharePct}%</span></span>
                </div>
                <div class="breakdown-track">
                  <div class="breakdown-fill" style="width: ${barWidth}%; opacity: ${opacity};"></div>
                </div>
              </li>
            `;
          }).join('')}
        </ul>

        <div class="breakdown-footer">
          <div class="breakdown-goal-row">
            <span>План выпуска отчётов (ноябрь)</span>
            <strong>8 из 10 · 80%</strong>
          </div>
          <div class="breakdown-track" style="margin-top: 6px;">
            <div class="breakdown-fill" style="width: 80%; background: #059669;"></div>
          </div>
          <div class="breakdown-banks">Аккредитация: <b>Сбер, ВТБ, ДОМ.РФ</b></div>
        </div>
      </section>
    </div>

    <!-- Tier 3: Full-Width Filterable Cases Table -->
    <section class="gw-panel dash-table-panel anim-fade-up anim-delay-3" style="padding: 0; overflow: hidden;">
      <div class="dash-table-header">
        <div class="dash-table-title-wrap">
          <h2 class="gw-cashflow-title">Реестр дел и объектов оценки</h2>
          <span class="dash-count-pill" id="dash-table-count">${tableCases.length}</span>
        </div>

        <div class="dash-filter-pills" role="group" aria-label="Фильтр дел">
          ${[
            { id: 'all', label: 'Все', count: cases.length, dot: null },
            { id: 'pinned', label: 'Закреплённые', count: pinnedCases.length, dot: '#eab308' },
            { id: 'В работе', label: 'В работе', count: inProgressCases.length, dot: '#d97706' },
            { id: 'Готов', label: 'Готов', count: readyCases.length, dot: '#059669' },
            { id: 'Черновик', label: 'Черновик', count: draftCases.length, dot: '#94a3b8' },
          ].map(f => `
            <button type="button" class="dash-filter-pill ${dashTableFilter === f.id ? 'active' : ''}" data-dash-filter="${f.id}">
              ${f.dot ? `<span class="filter-dot" style="background: ${f.dot};"></span>` : ''}
              <span>${f.label}</span>
              <span class="filter-count">${f.count}</span>
            </button>
          `).join('')}
        </div>
      </div>

      <div class="table-wrap" style="border: none; border-radius: 0;">
        <table class="dash-registry-table">
          <thead>
            <tr>
              <th style="width: 44px; text-align: center;"></th>
              <th>Дело</th>
              <th>Объект и адрес</th>
              <th>Статус</th>
              <th>Дата</th>
              <th style="text-align: right;">Стоимость</th>
              <th style="text-align: right; width: 156px;">Действия</th>
            </tr>
          </thead>
          <tbody>
            ${tableCases.map(c => {
              const res = calculateValuation(c.objectData, c.analogs, c.objectData.tradeAdjustment);
              const valText = res.total ? money(res.total) : 'Расчёт...';
              const statusClass = c.status === 'Готов' ? 'ready' : (c.status === 'В работе' ? 'in-progress' : 'draft');
              return `
                <tr class="dash-registry-row" data-case-row="${c.id}">
                  <td style="text-align: center;">
                    <button type="button" class="btn-pin-star ${c.isPinned ? 'pinned' : ''}" data-action="toggle-pin" data-id="${c.id}" title="${c.isPinned ? 'Открепить' : 'Закрепить'}">
                      ${icon('star')}
                    </button>
                  </td>
                  <td class="reg-num-cell">
                    <strong>№ ${c.number}</strong>
                    <span>${c.objectData.client.split(' ').slice(0, 2).join(' ')}</span>
                  </td>
                  <td class="reg-addr-cell">
                    <strong>${cleanDisplayAddress(c.objectData.address)}</strong>
                    <span>${c.objectData.area} м² · ${c.objectData.floor}/${c.objectData.totalFloors} эт. · ${c.objectData.wallMaterial}</span>
                  </td>
                  <td>
                    <span class="badge-status ${statusClass}">${c.status}</span>
                  </td>
                  <td class="reg-date-cell">${c.objectData.valuationDate}</td>
                  <td class="reg-price-cell">${valText}</td>
                  <td style="text-align: right;">
                    <div class="reg-actions-wrap">
                      <button type="button" class="btn btn-primary btn-xs" data-action="open-case" data-id="${c.id}">
                        Открыть
                      </button>
                      <button type="button" class="btn btn-secondary btn-xs" data-action="export-word" data-id="${c.id}" title="Скачать Word (.docx)">
                        ${icon('file-text')}
                      </button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </section>

    <!-- Bottom Compact Row: Recent Activity + Spotlight Case -->
    <div class="dash-main-grid anim-fade-up anim-delay-3" style="margin-top: 16px;">
      <div class="dash-left-col">
        <div class="activity-card reveal-on-scroll">
          <div class="activity-head">
            ${icon('activity')}
            <h3>Журнал недавних действий</h3>
          </div>

          <div class="activity-timeline">
            <div class="timeline-entry">
              <div class="timeline-dot dot-blue dot-pulse"></div>
              <div class="timeline-body">
                <div class="timeline-time">Сегодня, 10:45</div>
                <div class="timeline-text">Сформирован Word-отчёт <strong>№ 19/0826-2</strong> (${spotlightAmount}, ${spotlightSharesCount} сособств.).</div>
              </div>
            </div>

            <div class="timeline-entry">
              <div class="timeline-dot dot-indigo"></div>
              <div class="timeline-body">
                <div class="timeline-time">Сегодня, 09:20</div>
                <div class="timeline-text">Рассчитана матрица Лейфера для <strong>№ 21/0926-1</strong>: 3 аналога, торг −6%.</div>
              </div>
            </div>

            <div class="timeline-entry">
              <div class="timeline-dot dot-green"></div>
              <div class="timeline-body">
                <div class="timeline-time">Вчера, 17:30</div>
                <div class="timeline-text">Создан черновик <strong>№ 24/1105-3</strong> (ул. Мира, 42, 52.4 м²).</div>
              </div>
            </div>

            <div class="timeline-entry">
              <div class="timeline-dot dot-emerald"></div>
              <div class="timeline-body">
                <div class="timeline-time">Вчера, 14:10</div>
                <div class="timeline-text">Контроль однородности выборки: <strong>V = 4,1%</strong> (норма ФСО ≤ 33%).</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <aside class="dash-right-col">
        ${spotlightCase ? `
          <div class="spotlight-card reveal-on-scroll">
            <div class="spotlight-image-wrap">
              <img src="/images/report-showcase.jpg" alt="Эталонный отчёт ООО РусОценка">
              <span class="spotlight-float-badge">${icon('shield-check')} Готовый отчёт ФСО</span>
            </div>
            <div class="spotlight-body">
              <div class="spotlight-title">Дело № ${spotlightCase.number}</div>
              <div class="spotlight-desc">
                ${cleanDisplayAddress(spotlightCase.objectData.address)}<br>
                Стоимость: <strong>${spotlightAmount}</strong> · ${spotlightSharesCount} сособственников
              </div>
              <div class="spotlight-actions">
                <button class="btn btn-primary btn-sm" data-action="open-case" data-id="${spotlightCase.id}">
                  ${icon('arrow-right')} Открыть
                </button>
                <button class="btn btn-secondary btn-sm" data-action="export-word" data-id="${spotlightCase.id}">
                  ${icon('file-text')} Word (.docx)
                </button>
              </div>
            </div>
          </div>
        ` : ''}
      </aside>
    </div>

    <!-- ENLARGED VISUAL SHOWCASE DASHBOARDS (Scroll Down!) -->
    <div class="showcase-stack">
      <!-- Showcase 1: Аналитика цен 1 м² по районам и регионам -->
      <section class="showcase-panel reveal-on-scroll">
        <div class="panel-head-flex">
          <h3 class="panel-head-title">${icon('building')} Аналитика стоимости 1 м² по районам и регионам</h3>
          <span class="badge-status ready">Ноябрь 2026</span>
        </div>

        <div class="analytics-showcase-body">
          <div class="analytics-data-col">
            <div class="district-stat-pills">
              <div class="dstat-chip dstat-chip-blue">
                <span class="dstat-val">54 380 ₽/м²</span>
                <span class="dstat-lbl">Средняя по выборке</span>
              </div>
              <div class="dstat-chip">
                <span class="dstat-val">65 566 ₽/м²</span>
                <span class="dstat-lbl">Максимум (Центральный)</span>
              </div>
              <div class="dstat-chip dstat-chip-emerald">
                <span class="dstat-val">−6,0%</span>
                <span class="dstat-lbl">Поправка на торг</span>
              </div>
            </div>

            <div class="district-list">
              <div class="district-item">
                <div class="district-head">
                  <span class="district-name"><strong>Центральный район</strong> · Мегаполис</span>
                  <span class="district-price">65 566 ₽/м² <small class="text-green">+4.2%</small></span>
                </div>
                <div class="district-bar-bg">
                  <div class="district-bar-fill" style="width: 94%; background: linear-gradient(90deg, #1d4ed8, #3b82f6, #60a5fa);"></div>
                </div>
              </div>

              <div class="district-item">
                <div class="district-head">
                  <span class="district-name"><strong>Октябрьский район</strong> · Престиж</span>
                  <span class="district-price">58 900 ₽/м² <small class="text-blue">+1.9%</small></span>
                </div>
                <div class="district-bar-bg">
                  <div class="district-bar-fill" style="width: 84%; background: linear-gradient(90deg, #4f46e5, #6366f1, #818cf8);"></div>
                </div>
              </div>

              <div class="district-item">
                <div class="district-head">
                  <span class="district-name"><strong>Прибрежный район</strong> · Комфорт</span>
                  <span class="district-price">52 973 ₽/м² <small class="text-amber">эталон</small></span>
                </div>
                <div class="district-bar-bg">
                  <div class="district-bar-fill" style="width: 75%; background: linear-gradient(90deg, #059669, #10b981, #34d399);"></div>
                </div>
              </div>

              <div class="district-item">
                <div class="district-head">
                  <span class="district-name"><strong>Перспективный микрорайон</strong></span>
                  <span class="district-price">50 630 ₽/м² <small class="text-muted">база</small></span>
                </div>
                <div class="district-bar-bg">
                  <div class="district-bar-fill" style="width: 70%; background: linear-gradient(90deg, #3b82f6, #93c5fd);"></div>
                </div>
              </div>
            </div>

            <div class="trend-chart-card">
              <div class="trend-chart-head">
                <span>Индекс средней стоимости 1 м² (Июн — Ноя 2026)</span>
                <span class="kpi-pill kpi-pill-green">+4,8% за 6 мес.</span>
              </div>
              <svg class="trend-svg" viewBox="0 0 560 90" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="togliattiTrendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#2563eb" stop-opacity="0.22"/>
                    <stop offset="100%" stop-color="#2563eb" stop-opacity="0.0"/>
                  </linearGradient>
                </defs>
                <path d="M 10 72 C 95 66, 175 56, 265 44 C 355 34, 455 24, 550 14 L 550 86 L 10 86 Z" fill="url(#togliattiTrendGrad)"/>
                <path d="M 10 72 C 95 66, 175 56, 265 44 C 355 34, 455 24, 550 14" fill="none" stroke="#2563eb" stroke-width="3.2" stroke-linecap="round"/>
                <circle cx="10" cy="72" r="4.5" fill="#ffffff" stroke="#2563eb" stroke-width="2.5"/>
                <circle cx="118" cy="61" r="4.5" fill="#ffffff" stroke="#2563eb" stroke-width="2.5"/>
                <circle cx="226" cy="49" r="4.5" fill="#ffffff" stroke="#2563eb" stroke-width="2.5"/>
                <circle cx="334" cy="36" r="4.5" fill="#ffffff" stroke="#2563eb" stroke-width="2.5"/>
                <circle cx="442" cy="24" r="4.5" fill="#ffffff" stroke="#2563eb" stroke-width="2.5"/>
                <circle cx="550" cy="14" r="5.5" fill="#2563eb" stroke="#ffffff" stroke-width="2.5"/>
              </svg>
            </div>
          </div>

          <div class="visual-stage-box">
            <img src="/images/togliatti-skyline-widget.jpg" alt="Аналитика рынка недвижимости" class="visual-stage-img">
            <div class="district-avg-footer" style="width: 100%; margin-top: 0;">
              <span>Рынок жилой недвижимости РФ</span>
              <strong>54 380 ₽/м²</strong>
            </div>
          </div>
        </div>
      </section>

      <!-- Showcase 2: Конвейер подготовки отчётов по ФСО -->
      <section class="showcase-panel reveal-on-scroll">
        <div class="panel-head-flex">
          <h3 class="panel-head-title">${icon('layers')} Конвейер подготовки отчётов по ФСО</h3>
          <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
            <span class="kpi-pill kpi-pill-green">−4,5 ч на отчёт</span>
            <span class="badge-status in-progress">100% авто</span>
          </div>
        </div>

        <div class="pipeline-showcase-body">
          <div class="visual-stage-box">
            <img src="/images/fso-pipeline-widget.jpg" alt="Конвейер подготовки отчётов ФСО" class="visual-stage-img">
            <div class="pipeline-gauge-row">
              <div class="gauge-ring-wrap">
                <svg class="gauge-svg" viewBox="0 0 60 60">
                  <circle cx="30" cy="30" r="24" fill="none" stroke="#e2e8f0" stroke-width="6"/>
                  <circle cx="30" cy="30" r="24" fill="none" stroke="#10b981" stroke-width="6"
                    stroke-linecap="round"
                    stroke-dasharray="${gaugeCirc}"
                    stroke-dashoffset="${gaugeOffset}"/>
                </svg>
                <div class="gauge-info">
                  <strong>${pipelineOverallPct}%</strong>
                  <span>Прогресс по реестру</span>
                </div>
              </div>
              <span class="kpi-pill kpi-pill-blue">${cases.length} дела</span>
            </div>
          </div>

          <div class="funnel-steps">
            <div class="funnel-step">
              <span class="step-num">1</span>
              <span class="step-title">Реквизиты объекта и выписка ЕГРН</span>
              <div class="step-bar"><div class="step-bar-fill" style="width: 100%; background: linear-gradient(90deg, #2563eb, #60a5fa);"></div></div>
              <span class="step-count">${cases.length} из ${cases.length} (100%)</span>
            </div>

            <div class="funnel-step">
              <span class="step-num">2</span>
              <span class="step-title">Подбор 3–5 аналогов (Авито, Циан)</span>
              <div class="step-bar"><div class="step-bar-fill" style="width: ${withAnalogsPct}%; background: linear-gradient(90deg, #4f46e5, #818cf8);"></div></div>
              <span class="step-count">${withAnalogsCount} из ${cases.length} (${withAnalogsPct}%)</span>
            </div>

            <div class="funnel-step">
              <span class="step-num">3</span>
              <span class="step-title">Расчёт корректировок Лейфера</span>
              <div class="step-bar"><div class="step-bar-fill" style="width: ${leiferReadyPct}%; background: linear-gradient(90deg, #0ea5e9, #38bdf8);"></div></div>
              <span class="step-count">${leiferReadyCount} из ${cases.length} (${leiferReadyPct}%)</span>
            </div>

            <div class="funnel-step">
              <span class="step-num">4</span>
              <span class="step-title">Контроль вариации V ≤ 33% и долей</span>
              <div class="step-bar"><div class="step-bar-fill" style="width: ${readyPct}%; background: linear-gradient(90deg, #10b981, #34d399);"></div></div>
              <span class="step-count">${readyCases.length} из ${cases.length} (${readyPct}%)</span>
            </div>

            <div class="funnel-step">
              <span class="step-num">5</span>
              <span class="step-title">Формирование Word-документа (.docx)</span>
              <div class="step-bar"><div class="step-bar-fill" style="width: ${readyPct}%; background: linear-gradient(90deg, #059669, #10b981);"></div></div>
              <span class="step-count">${readyCases.length} из ${cases.length} (${readyPct}%)</span>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- Bottom Section: Матрица поправок (Compact, Clean, Without Small Descriptive Text) -->
    <section class="leifer-panel reveal-on-scroll">
      <div class="panel-head-flex">
        <h3 class="panel-head-title">${icon('sliders')} Матрица поправок Лейфера 2026</h3>
        <span class="kpi-pill kpi-pill-blue">ФСО I-VI, ФСО № 7</span>
      </div>

      <div class="leifer-matrix-grid">
        <div class="leifer-card leifer-card-blue">
          <div class="leifer-card-top">
            <span class="leifer-tag">Торг</span>
            <span class="leifer-badge">−6,0%</span>
          </div>
          <div class="leifer-title">Рынок предложений</div>
          <div class="leifer-mini-track">
            <div class="leifer-mini-fill" style="width: 65%; background: linear-gradient(90deg, #2563eb, #60a5fa);"></div>
          </div>
        </div>

        <div class="leifer-card leifer-card-purple">
          <div class="leifer-card-top">
            <span class="leifer-tag">Этажность</span>
            <span class="leifer-badge">+5% / +4%</span>
          </div>
          <div class="leifer-title">Первый и последний этаж</div>
          <div class="leifer-mini-track">
            <div class="leifer-mini-fill" style="width: 78%; background: linear-gradient(90deg, #7c3aed, #a78bfa);"></div>
          </div>
        </div>

        <div class="leifer-card leifer-card-emerald">
          <div class="leifer-card-top">
            <span class="leifer-tag">Отделка</span>
            <span class="leifer-badge">+6,0%</span>
          </div>
          <div class="leifer-title">Простая и улучшенная</div>
          <div class="leifer-mini-track">
            <div class="leifer-mini-fill" style="width: 82%; background: linear-gradient(90deg, #059669, #34d399);"></div>
          </div>
        </div>

        <div class="leifer-card leifer-card-amber">
          <div class="leifer-card-top">
            <span class="leifer-tag">Однородность</span>
            <span class="leifer-badge">V ≤ 33%</span>
          </div>
          <div class="leifer-title">Эталон выборки: 4,1%</div>
          <div class="leifer-mini-track">
            <div class="leifer-mini-fill" style="width: 90%; background: linear-gradient(90deg, #d97706, #fbbf24);"></div>
          </div>
        </div>
      </div>
    </section>
  `;
}

/**
 * Рендер списка всех дел (Личный кабинет)
 */
function renderCabinetView() {
  const filtered = cases.filter(c => {
    const matchStatus = filterStatus === 'all' || c.status === filterStatus;
    const matchQuery = !searchQuery.trim() ||
      c.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.objectData.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.objectData.client.toLowerCase().includes(searchQuery.toLowerCase());
    return matchStatus && matchQuery;
  });

  const totalValuation = cases.reduce((sum, c) => {
    const res = calculateValuation(c.objectData, c.analogs, c.objectData.tradeAdjustment);
    return sum + (res.total || 0);
  }, 0);

  return `
    <div class="dashboard-heading">
      <div>
        <h2>Личный кабинет оценщика</h2>
        <p>Реестр экспертных дел, отчётов и расчётов жилой недвижимости</p>
      </div>
      <button class="btn btn-primary" id="btn-new-case-head">
        ${icon('plus')} Добавить новый объект оценки
      </button>
    </div>

    <!-- Stat Cards Ribbon -->
    <div class="stat-cards-ribbon">
      <div class="stat-card">
        <span class="stat-card-title">Всего дел в реестре</span>
        <div class="stat-card-value">${cases.length}</div>
        <span class="stat-card-sub">Локальный архив специалиста</span>
      </div>
      <div class="stat-card">
        <span class="stat-card-title">Дела в работе</span>
        <div class="stat-card-value" style="color: var(--amber);">${cases.filter(c => c.status === 'В работе').length}</div>
        <span class="stat-card-sub">Требуют подбора или проверки</span>
      </div>
      <div class="stat-card">
        <span class="stat-card-title">Готовые отчёты</span>
        <div class="stat-card-value" style="color: var(--green);">${cases.filter(c => c.status === 'Готов').length}</div>
        <span class="stat-card-sub">Согласованы и выгружены</span>
      </div>
      <div class="stat-card">
        <span class="stat-card-title">Портфель объектов</span>
        <div class="stat-card-value">${money(totalValuation)}</div>
        <span class="stat-card-sub">Суммарная рыночная стоимость</span>
      </div>
    </div>

    <!-- Toolbar: Search & Status Filters -->
    <div class="toolbar-card">
      <div class="search-field">
        ${icon('search')}
        <input type="text" id="search-cases-input" placeholder="Поиск по адресу, номеру или клиенту..." value="${searchQuery}">
      </div>

      <div class="filter-pills">
        <button class="filter-pill ${filterStatus === 'all' ? 'active' : ''}" data-filter="all">Все (${cases.length})</button>
        <button class="filter-pill ${filterStatus === 'В работе' ? 'active' : ''}" data-filter="В работе">В работе (${cases.filter(c=>c.status==='В работе').length})</button>
        <button class="filter-pill ${filterStatus === 'Готов' ? 'active' : ''}" data-filter="Готов">Готовы (${cases.filter(c=>c.status==='Готов').length})</button>
      </div>
    </div>

    <!-- Cases List Grid -->
    <div class="cases-grid">
      ${filtered.length ? filtered.map(c => renderCaseDashboardCard(c)).join('') : `
        <div style="background: #ffffff; border: 1px dashed var(--border); border-radius: 10px; padding: 48px; text-align: center; color: var(--text-muted);">
          <div style="font-size: 16px; font-weight: 600; margin-bottom: 6px;">Дел не найдено</div>
          <p style="font-size: 13px; margin-bottom: 16px;">Попробуйте изменить параметры поиска или создайте новое дело.</p>
          <button class="btn btn-primary" id="btn-empty-create">${icon('plus')} Добавить объект оценки</button>
        </div>
      `}
    </div>
  `;
}

/**
 * Рендер рабочего места по открытому делу
 */
function renderCaseWorkspaceView(activeCase) {
  if (!activeCase) return '<div class="notice">Дело не выбрано</div>';

  const res = calculateValuation(activeCase.objectData, activeCase.analogs, activeCase.objectData.tradeAdjustment);

  return `
    <!-- Case Sub-Tabs Navigation -->
    <div class="case-tabs-nav">
      <button class="case-tab-btn ${activeTab === 'object' ? 'active' : ''}" data-tab="object">
        ${icon('home')} 1. Объект оценки
      </button>
      <button class="case-tab-btn ${activeTab === 'analogs' ? 'active' : ''}" data-tab="analogs">
        ${icon('layers')} 2. Аналоги и поправки (${activeCase.analogs.length})
      </button>
      <button class="case-tab-btn ${activeTab === 'calculation' ? 'active' : ''}" data-tab="calculation">
        ${icon('calculator')} 3. Расчёт и доли
      </button>
      <button class="case-tab-btn ${activeTab === 'report' ? 'active' : ''}" data-tab="report">
        ${icon('file-text')} 4. Готовый документ
      </button>
      <div style="margin-left: auto; display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 12px; color: var(--text-muted);">Статус:</span>
        <select id="case-status-select" style="padding: 4px 8px; border-radius: 6px; font-size: 12px; border: 1px solid var(--border);">
          <option value="В работе" ${activeCase.status === 'В работе' ? 'selected' : ''}>В работе</option>
          <option value="Готов" ${activeCase.status === 'Готов' ? 'selected' : ''}>Готов</option>
          <option value="Черновик" ${activeCase.status === 'Черновик' ? 'selected' : ''}>Черновик</option>
        </select>
      </div>
    </div>

    <!-- Active Tab Body with smooth slide-fade entrance -->
    <div class="case-tab-pane" data-tab-pane="${activeTab}" id="case-tab-pane">
      ${activeTab === 'object' ? renderTabObject(activeCase) : ''}
      ${activeTab === 'analogs' ? renderTabAnalogs(activeCase, res) : ''}
      ${activeTab === 'calculation' ? renderTabCalculation(activeCase, res) : ''}
      ${activeTab === 'report' ? renderTabReport(activeCase, res) : ''}
    </div>
  `;
}

/**
 * Вкладка 1: Параметры объекта оценки
 */
function renderTabObject(activeCase) {
  const o = activeCase.objectData;
  const shares = o.shares || [];
  const sharesSum = sumSharesFraction(shares);
  const remShare = getRemainingShareFraction(shares);
  const isFull100 = sharesSum.num === sharesSum.den && sharesSum.den > 0;

  return `
    <div class="object-flow">
      <div class="object-flow-top">
        <div>
          <h3>Параметры объекта оценки</h3>
          <p>Последовательное заполнение данных по договору, выписке ЕГРН и акту осмотра</p>
        </div>
        <button class="btn btn-primary btn-sm" id="btn-save-obj">${icon('check')} Сохранить изменения</button>
      </div>

      <form id="form-case-object" class="object-steps">
        <!-- Шаг 1: Реквизиты дела и договора -->
        <section class="obj-step-card">
          <div class="obj-step-head">
            <span class="obj-step-num">1</span>
            <div>
              <h4>Дело и договор</h4>
              <p>Основные реквизиты отчёта и заказчика</p>
            </div>
          </div>
          <div class="form-grid-2">
            <div class="form-field">
              <label>Номер отчёта / дела</label>
              <input type="text" name="reportNumber" value="${o.reportNumber}" required>
            </div>
            <div class="form-field">
              <label>Дата оценки</label>
              <input type="date" name="valuationDate" value="${o.valuationDate}" required>
            </div>
            <div class="form-field">
              <label>Заказчик оценки</label>
              <input type="text" name="client" value="${o.client}" required>
            </div>
            <div class="form-field">
              <label>Цель оценки</label>
              <input type="text" name="purpose" value="${o.purpose}">
            </div>
          </div>
        </section>

        <!-- Шаг 2: Характеристики из ЕГРН -->
        <section class="obj-step-card">
          <div class="obj-step-head">
            <span class="obj-step-num">2</span>
            <div>
              <h4>Адрес и характеристики объекта</h4>
              <p>Сведения из выписки ЕГРН и ГИС ЖКХ</p>
            </div>
          </div>
          <div class="form-field" style="margin-bottom: 14px;">
            <label>Полный адрес объекта оценки</label>
            <input type="text" name="address" value="${o.address}" required>
          </div>
          <div class="form-grid-2" style="margin-bottom: 14px;">
            <div class="form-field">
              <label>Кадастровый номер</label>
              <input type="text" name="cadastralNumber" value="${o.cadastralNumber}" required>
            </div>
            <div class="form-field">
              <label>Материал стен здания</label>
              <select name="wallMaterial">
                <option value="панель" ${o.wallMaterial === 'панель' ? 'selected' : ''}>Панель</option>
                <option value="кирпич" ${o.wallMaterial === 'кирпич' ? 'selected' : ''}>Кирпич</option>
                <option value="монолит" ${o.wallMaterial === 'монолит' ? 'selected' : ''}>Монолит</option>
              </select>
            </div>
          </div>
          <div class="form-grid-3">
            <div class="form-field">
              <label>Общая площадь (м²)</label>
              <input type="number" step="0.1" name="area" value="${o.area}" required>
            </div>
            <div class="form-field">
              <label>Этаж</label>
              <input type="number" name="floor" value="${o.floor}" required>
            </div>
            <div class="form-field">
              <label>Этажность дома</label>
              <input type="number" name="totalFloors" value="${o.totalFloors}" required>
            </div>
          </div>
        </section>

        <!-- Шаг 3: Акт осмотра -->
        <section class="obj-step-card">
          <div class="obj-step-head">
            <span class="obj-step-num">3</span>
            <div>
              <h4>Состояние и отделка</h4>
              <p>По результатам натурного осмотра оценщика</p>
            </div>
          </div>
          <div class="form-grid-2">
            <div class="form-field">
              <label for="field-finish">Тип внутренней отделки</label>
              <select name="finish" id="field-finish">
                <option value="улучшенная" ${o.finish === 'улучшенная' ? 'selected' : ''}>Улучшенная (современный ремонт)</option>
                <option value="простая" ${o.finish === 'простая' ? 'selected' : ''}>Простая (типовой ремонт)</option>
              </select>
            </div>
            <div class="form-field">
              <label for="field-condition">Физическое состояние</label>
              <select name="condition" id="field-condition">
                <option value="хорошее" ${o.condition === 'хорошее' ? 'selected' : ''}>Хорошее (дефекты отсутствуют)</option>
                <option value="отличное" ${o.condition === 'отличное' ? 'selected' : ''}>Отличное (евроремонт)</option>
                <option value="требует ремонта" ${o.condition === 'требует ремонта' ? 'selected' : ''}>Требует ремонта</option>
              </select>
            </div>
          </div>
        </section>
      </form>

      <!-- Шаг 4: Долевая собственность -->
      <section class="obj-step-card">
        <div class="obj-step-head" style="justify-content: space-between; flex-wrap: wrap; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span class="obj-step-num">4</span>
            <div>
              <h4>Долевая собственность</h4>
              <p>Единица (100%) распределяется между собственниками</p>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span class="share-total-badge ${isFull100 ? 'ok' : 'warn'}">
              ${isFull100
                ? `${icon('check-circle')} Сумма: 100% (1/1)`
                : `${icon('alert-circle')} Сумма: ${sharesSum.percent.toFixed(1).replace('.', ',')}% · Остаток ${remShare.num}/${remShare.den}`
              }
            </span>
            ${shares.length > 1 ? `
              <button type="button" class="btn btn-secondary btn-sm" id="btn-equal-shares" title="Разделить 100% поровну на всех">
                Поровну (1/${shares.length})
              </button>
            ` : ''}
            <button type="button" class="btn btn-secondary btn-sm" id="btn-add-share">
              ${icon('plus')} Добавить собственника
            </button>
          </div>
        </div>

        <div class="shares-list">
          ${shares.map((s, idx) => {
            const pct = ((Number(s.num) || 0) / Math.max(1, Number(s.den) || 1) * 100).toFixed(1).replace('.', ',');
            return `
              <div class="share-row">
                <span class="share-idx">${idx + 1}</span>
                <input type="text" data-share-holder="${idx}" value="${s.holder}" placeholder="ФИО собственника" class="share-holder-input">
                <div class="share-fraction-box">
                  <input type="number" min="0" data-share-num="${idx}" value="${s.num}" title="Числитель доли">
                  <span>/</span>
                  <input type="number" min="1" data-share-den="${idx}" value="${s.den}" title="Знаменатель доли">
                </div>
                <span class="share-pct">${pct}%</span>
                <button type="button" class="btn btn-danger btn-sm" data-action="delete-share" data-index="${idx}" title="Удалить собственника" ${shares.length <= 1 ? 'disabled style="opacity:0.4;pointer-events:none;"' : ''}>
                  ${icon('trash-2')}
                </button>
              </div>
            `;
          }).join('')}
        </div>
      </section>
    </div>
  `;
}

/**
 * Вкладка 2: Таблица аналогов и поправок (Таблица 12.2)
 */
/**
 * Пошаговая карточка аудита вычислений по аналогу (для возрастных оценщиков и проверки на калькуляторе)
 */
function renderAnalogAuditDrawer(a, audit, o, analogNum) {
  return `
    <div class="analog-audit-card">
      <div class="audit-card-top">
        <div class="audit-card-title">
          <div class="audit-tag">${icon('calculator')} Формульный аудит расчёта (ФСО №7 + Лейфер)</div>
          <h4>Аналог №${analogNum}: ${a.address}</h4>
        </div>
        <div class="audit-card-badge">
          ${icon('check-circle')} Верификация: Citizen / Excel (округление шагов до 0,01 ₽)
        </div>
      </div>

      <div class="audit-steps-grid">
        <!-- Шаг 1: Исходная цена 1 м² -->
        <div class="audit-step-card">
          <div class="step-badge">Шаг 1</div>
          <div class="step-title">Исходная удельная цена</div>
          <div class="step-math">
            <code>Цена / S_общ = ${money(audit.price)} / ${sqm(audit.area)}</code>
          </div>
          <div class="step-value">
            <span class="exact-val">${moneyWithCents(audit.rawPricePerSqm)}</span>
            <span class="round-val">(в таблице: ${moneyPerSqm(audit.initialPricePerSqm)})</span>
          </div>
          <div class="step-note">Базовая цена предложения до внесения рыночных корректировок.</div>
        </div>

        <!-- Шаг 2: Торг -->
        <div class="audit-step-card">
          <div class="step-badge">Шаг 2</div>
          <div class="step-title">Поправка на торг (ФСО №7)</div>
          <div class="step-math">
            <code>P₁ = P_исх × (1 + Торг%) = ${audit.rawPricePerSqm.toFixed(2)} × (1 ${audit.tradeAdj >= 0 ? '+' : '-'} ${(Math.abs(audit.tradeAdj)/100).toFixed(4)})</code>
          </div>
          <div class="step-value">
            <span class="exact-val">${moneyWithCents(audit.pTrade)}</span>
            <span class="round-val">(в таблице: ${moneyPerSqm(audit.priceAfterTrade)})</span>
          </div>
          <div class="step-note">Скидка на уторгование ${percent(audit.tradeAdj)} по п. 11 ФСО №7 для открытого рынка.</div>
        </div>

        <!-- Шаг 3: Отделка -->
        <div class="audit-step-card">
          <div class="step-badge">Шаг 3</div>
          <div class="step-title">Поправка на отделку (Лейфер)</div>
          <div class="step-math">
            <code>P₂ = P₁ × (1 + Отделка%) = ${audit.pTrade.toFixed(2)} × (1 ${audit.finishAdj >= 0 ? '+' : '-'} ${(Math.abs(audit.finishAdj)/100).toFixed(4)})</code>
          </div>
          <div class="step-value">
            <span class="exact-val">${moneyWithCents(audit.pFinish)}</span>
            <span class="round-val">(в таблице: ${moneyPerSqm(audit.priceAfterFinish)})</span>
          </div>
          <div class="step-note">Объект: «${audit.objFinish}» vs Аналог: «${audit.analogFinish}» (${percent(audit.finishAdj)}, Лейфер).</div>
        </div>

        <!-- Шаг 4: Этаж -->
        <div class="audit-step-card">
          <div class="step-badge">Шаг 4</div>
          <div class="step-title">Поправка на этаж (Лейфер)</div>
          <div class="step-math">
            <code>P₃ = P₂ × (1 + Этаж%) = ${audit.pFinish.toFixed(2)} × (1 ${audit.floorAdj >= 0 ? '+' : '-'} ${(Math.abs(audit.floorAdj)/100).toFixed(4)})</code>
          </div>
          <div class="step-value">
            <span class="exact-val">${moneyWithCents(audit.pFloor)}</span>
            <span class="round-val">(в таблице: ${moneyPerSqm(audit.priceAfterFloor)})</span>
          </div>
          <div class="step-note">Объект: ${audit.objFloor}/${audit.objTotalFloors} эт. vs Аналог: ${audit.analogFloor}/${audit.analogTotalFloors} эт. (${percent(audit.floorAdj)}, Лейфер).</div>
        </div>

        <!-- Шаг 5: Масштаб -->
        <div class="audit-step-card">
          <div class="step-badge">Шаг 5</div>
          <div class="step-title">Поправка на масштаб площади (Лейфер)</div>
          <div class="step-math">
            <code>K_s = (${audit.analogArea} / ${audit.objArea})^0,10 - 1 = ${percent(audit.areaAdj)}</code>
          </div>
          <div class="step-value">
            <span class="exact-val">${moneyWithCents(audit.pArea)}</span>
            <span class="round-val">(в таблице: ${moneyPerSqm(audit.priceAfterArea)})</span>
          </div>
          <div class="step-note">Степенная функция масштабирования Лейфера для многоквартирных домов.</div>
        </div>

        <!-- Шаг 6: Вес в выборке -->
        <div class="audit-step-card highlight">
          <div class="step-badge">Шаг 6</div>
          <div class="step-title">Взвешивание в выборке (wi)</div>
          <div class="step-math">
            <code>w = (Σk - ki) / ((N - 1) × Σk) = (${audit.totalCorrections} - ${audit.correctionsCount}) / (${(audit.selectedCount - 1) * audit.totalCorrections || 1})</code>
          </div>
          <div class="step-value">
            <span class="exact-val" style="color: var(--primary);">${weightFmt(audit.weight)}</span>
            <span class="round-val">(поправок Ki = ${audit.correctionsCount} из 4)</span>
          </div>
          <div class="step-note">Принцип обратных весов: чем меньше корректировок, тем выше вес аналога.</div>
        </div>
      </div>

      <div class="audit-card-footer">
        ${icon('shield-check')} <span>Формулы сверены. Промежуточные результаты округлены до сотых по правилам финансовой математики. Оценщик может сверить результат на калькуляторе.</span>
      </div>
    </div>
  `;
}

function renderTabAnalogs(activeCase, res) {
  const o = activeCase.objectData;
  const allAnalogs = activeCase.analogs || [];
  const cityOptions = ['Все города', 'Тольятти', 'Самара', 'Сызрань'];
  const cityCounts = {
    'Все города': allAnalogs.length,
    'Тольятти': allAnalogs.filter(a => (a.address || '').includes('Тольятти')).length,
    'Самара': allAnalogs.filter(a => (a.address || '').includes('Самара')).length,
    'Сызрань': allAnalogs.filter(a => (a.address || '').includes('Сызрань')).length,
  };
  const filteredAnalogs = allAnalogs.filter(a => {
    if (!analogCityFilter || analogCityFilter === 'all' || analogCityFilter === 'Все города') return true;
    return (a.address || '').toLowerCase().includes(analogCityFilter.toLowerCase());
  });

  return `
    <div class="panel">
      <div class="panel-header" style="flex-wrap: wrap; gap: 14px;">
        <div class="panel-title">
          <h3>Подбор аналогов и матрица корректировок</h3>
          <p>Таблица 12.2 отчёта: сравнительный подход к оценке рыночной стоимости</p>
        </div>
        <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
          <div class="trade-bar" title="Поправка на торг к ценам предложений">
            <label for="case-trade-slider">Торг:</label>
            <input type="range" id="case-trade-slider" min="-15" max="0" step="0.5" value="${o.tradeAdjustment}">
            <output id="case-trade-output">${percent(o.tradeAdjustment)}</output>
          </div>
          <button class="btn btn-primary btn-sm" id="btn-add-analog-modal">
            ${icon('plus')} Добавить аналог
          </button>
        </div>
      </div>

      <!-- Быстрый фильтр аналогов по городам -->
      <div class="city-filter-bar">
        <span class="city-filter-label">${icon('map-pin')} Локация:</span>
        ${cityOptions.map(city => {
          const isActive = (city === 'Все города' && (analogCityFilter === 'all' || analogCityFilter === 'Все города')) || analogCityFilter === city;
          const count = cityCounts[city] || 0;
          return `
            <button type="button" class="city-pill ${isActive ? 'active' : ''}" data-city-filter="${city === 'Все города' ? 'all' : city}">
              ${city} <span style="opacity: 0.8; font-size: 11px;">(${count})</span>
            </button>
          `;
        }).join('')}
      </div>

      <div class="banner-calc-info">
        <span class="banner-calc-icon">${icon('info')}</span>
        <div>
          <strong>Методология расчёта по ФСО:</strong>
          <span><b>Программный расчёт:</b> автоматический расчёт скидки на торг (-6%), поправок Лейфера (этаж, площадь, отделка), скорректированных цен и весовых коэффициентов $w_i$.</span>
          <span style="margin-left: 12px;"><b>Оценщик:</b> выборка проверенных объектов-аналогов из открытого рынка и подтверждение класса отделки по акту осмотра.</span>
        </div>
      </div>

      <div class="table-wrap">
        <table class="calc-table">
          <thead>
            <tr>
              <th style="width: 58px; text-align: center;">Выбор</th>
              <th>Предложение и адрес</th>
              <th style="text-align: center;">Источник</th>
              <th>Цена предложения</th>
              <th>Торг</th>
              <th>Отделка</th>
              <th>Этаж</th>
              <th>Масштаб</th>
              <th>Скоррект. 1 м²</th>
              <th>Число поправок (Ki)</th>
              <th>Вес в итоге</th>
              <th style="text-align: center; width: 130px;">Ход расчёта</th>
              <th style="width: 40px;"></th>
            </tr>
          </thead>
          <tbody>
            ${filteredAnalogs.map((a, idx) => {
              const row = res.rows.find(r => r.id === a.id);
              const isSelected = a.selected;
              const rawPerSqm = Math.round(a.price / a.area);
              const isExpanded = expandedAuditIds.has(a.id);
              const audit = (row && row.audit) ? row.audit : calculateAnalogAudit(a, o, o.tradeAdjustment, res.totalCorrections, res.selectedCount);

              return `
                <tr class="${isSelected ? 'active-row' : 'inactive-row'}" data-analog-row="${a.id}">
                  <td style="text-align: center;">
                    ${renderRosocenkaCheckbox({
                      attrs: `data-analog-toggle="${a.id}"`,
                      checked: isSelected,
                      title: 'Включить аналог в расчёт'
                    })}
                  </td>
                  <td>
                    <div class="analog-desc">
                      <span class="analog-address">№${idx+1}. ${a.address.replace('г. Тольятти, Комсомольский район, мкрн Поволжский, ', '')}</span>
                      <div class="analog-meta">
                        <span>${a.area} м²</span>
                        <span>·</span>
                        <span>${a.floor}/${a.totalFloors} эт.</span>
                        <span>·</span>
                        <span>${a.finish}</span>
                      </div>
                    </div>
                  </td>
                  <td style="text-align: center;">
                    ${a.url ? `
                      <a class="btn-source-link" href="${a.url}" target="_blank" rel="noopener noreferrer" title="Открыть объявление на ${a.source || 'сайте'}">
                        <span>${a.source || 'Ссылка'}</span>
                        ${icon('external-link')}
                      </a>
                    ` : `
                      <span class="btn-source-link empty" title="Ссылка на объявление не указана">—</span>
                    `}
                  </td>
                  <td class="price-cell">
                    ${money(a.price)}
                    <span class="price-sub">${moneyPerSqm(rawPerSqm)}</span>
                  </td>
                  <td>
                    <span class="adj-chip neg">${percent(o.tradeAdjustment)}</span>
                  </td>
                  <td>
                    <span class="adj-chip ${a.finishAdj > 0 ? 'pos' : (a.finishAdj < 0 ? 'neg' : 'neutral')}">${percent(a.finishAdj)}</span>
                  </td>
                  <td>
                    <span class="adj-chip ${a.floorAdj > 0 ? 'pos' : (a.floorAdj < 0 ? 'neg' : 'neutral')}">${percent(a.floorAdj)}</span>
                  </td>
                  <td>
                    <span class="adj-chip ${a.areaAdj > 0 ? 'pos' : (a.areaAdj < 0 ? 'neg' : 'neutral')}">${percent(a.areaAdj)}</span>
                  </td>
                  <td class="price-cell" style="color: var(--primary);" data-cell="adj-price">
                    ${isSelected && row ? moneyPerSqm(row.finalAdjustedPrice) : '—'}
                  </td>
                  <td style="text-align: center;" data-cell="ki">
                    <b>${isSelected && row ? row.correctionsCount : '—'}</b>
                  </td>
                  <td data-cell="weight">
                    ${isSelected && row ? `
                      <div class="weight-bar-wrap">
                        <div class="weight-track"><div class="weight-fill" style="width: ${row.weight * 100 * 3}%;"></div></div>
                        <span class="weight-label">${weightFmt(row.weight)}</span>
                      </div>
                    ` : '<span style="color: var(--text-dim);">0%</span>'}
                  </td>
                  <td style="text-align: center;">
                    <button type="button" class="btn-audit-toggle ${isExpanded ? 'expanded' : ''}" data-action="toggle-audit" data-id="${a.id}" title="Пошаговая сверка на калькуляторе Citizen / Excel">
                      ${icon(isExpanded ? 'chevron-up' : 'calculator')}
                      <span>${isExpanded ? 'Скрыть ход' : 'Ход расчёта'}</span>
                    </button>
                  </td>
                  <td>
                    <button class="btn btn-danger btn-sm" data-action="delete-analog" data-id="${a.id}" title="Удалить аналог">${icon('x')}</button>
                  </td>
                </tr>
                ${isExpanded ? `
                  <tr class="audit-drawer-row" data-audit-row="${a.id}">
                    <td colspan="13">
                      ${renderAnalogAuditDrawer(a, audit, o, idx + 1)}
                    </td>
                  </tr>
                ` : ''}
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/**
 * Вкладка 3: Итоговый расчет и согласование (Таблица 12.5 и 22)
 */
function renderTabCalculation(activeCase, res) {
  return `
    <div style="display: grid; grid-template-columns: 1fr 340px; gap: 24px; align-items: start;">
      <div style="display: flex; flex-direction: column; gap: 24px;">
        <!-- Valuation Card -->
        <div style="background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%); color: #ffffff; border-radius: 12px; padding: 28px; box-shadow: 0 4px 14px rgba(30, 64, 175, 0.2);">
          <span style="font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #bfdbfe; font-weight: 600;">Итоговая рыночная стоимость объекта (100% доля)</span>
          <div style="font-size: 42px; font-weight: 750; letter-spacing: -1.2px; margin: 8px 0 4px; font-variant-numeric: tabular-nums;">
            ${res.total ? money(res.total) : '—'}
          </div>
          <div style="font-size: 15px; color: #e0e7ff; display: flex; gap: 14px;">
            <span>Удельная цена: <b>${res.pricePerSqm ? moneyPerSqm(res.pricePerSqm) : '—'}</b></span>
            <span>·</span>
            <span>Выборка: <b>${res.selectedCount} аналогов</b></span>
          </div>
        </div>

        <!-- Shares Distribution -->
        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">
              <h3>Распределение стоимости по долям (Таблица 12.5)</h3>
              <p>Определение рыночной стоимости прав собственности каждого правообладателя</p>
            </div>
          </div>

          <div style="display: grid; gap: 10px;">
            ${res.shares.map(s => `
              <div style="display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--border); padding: 12px 16px; border-radius: 8px;">
                <div>
                  <strong style="font-size: 14px; color: var(--text-dark);">${s.holder}</strong>
                  <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                    Доля: <b>${s.shareFraction}</b> (${s.percentOfTotal}%)
                  </div>
                </div>
                <div style="text-align: right;">
                  <div style="font-size: 17px; font-weight: 700; color: var(--primary); font-variant-numeric: tabular-nums;">
                    ${money(s.rounded)}
                  </div>
                  <small style="font-size: 11px; color: var(--text-muted);">номинал: ${money(s.nominal)}</small>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- Right Column: Variation Statistics -->
      <div style="display: flex; flex-direction: column; gap: 20px;">
        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">
              <h3>Контроль качества выборки</h3>
              <p>Таблица 22 отчёта</p>
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 12px; font-size: 13px;">
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-light); padding-bottom: 8px;">
              <span style="color: var(--text-muted);">Средняя цена (Pср)</span>
              <b>${res.meanPrice ? moneyPerSqm(res.meanPrice) : '—'}</b>
            </div>
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-light); padding-bottom: 8px;">
              <span style="color: var(--text-muted);">Стандартное отклонение (σ)</span>
              <b>${res.stdDev ? `±${res.stdDev} ₽/м²` : '—'}</b>
            </div>
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--border-light); padding-bottom: 8px;">
              <span style="color: var(--text-muted);">Коэффициент вариации (V)</span>
              <b style="font-size: 15px; color: ${res.variationPass ? 'var(--green)' : 'var(--amber)'};">
                ${res.variationCoeff != null ? res.variationCoeff.toFixed(2) + '%' : '—'}
              </b>
            </div>
            <div style="margin-top: 8px;">
              ${res.variationPass ? `
                <div style="background: var(--green-light); color: #065f46; border: 1px solid var(--green-border); padding: 8px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 6px;">
                  ${icon('check-circle')} Допуск соблюдён: V ≤ 33% (выборка однородна)
                </div>
              ` : `
                <div style="background: var(--amber-light); color: #92400e; border: 1px solid var(--amber-border); padding: 8px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 6px;">
                  ${icon('alert-triangle')} Внимание: V > 33%
                </div>
              `}
            </div>
          </div>
        </div>

        <div class="panel">
          <h4 style="font-size: 13px; font-weight: 700; margin-bottom: 8px;">Формула весов аналогов:</h4>
          <p style="font-size: 12px; color: var(--text-muted); line-height: 1.5; margin-bottom: 8px;">
            Взвешивание выполняется по правилу минимального вмешательства:
          </p>
          <code style="display: block; background: #f8fafc; border: 1px solid var(--border); padding: 8px; border-radius: 4px; font-size: 11px; color: var(--primary);">
            Вес = (ΣK - Ki) / (ΣK × (N - 1))
          </code>
        </div>
      </div>
    </div>
  `;
}

/**
 * Вкладка 4: Готовый документ и предпросмотр
 */
function renderTabReport(activeCase, res) {
  const o = activeCase.objectData;
  const cl = activeCase.checklist || {
    egrn: activeCase.status === 'Готов',
    inspection: activeCase.status === 'Готов',
    market: activeCase.status === 'Готов',
    leifer: activeCase.status === 'Готов',
    shares: activeCase.status === 'Готов',
  };
  const checkedCount = [cl.egrn, cl.inspection, cl.market, cl.leifer, cl.shares].filter(Boolean).length;
  const allChecked = checkedCount === 5;
  return `
    <div style="display: grid; grid-template-columns: 1fr 380px; gap: 24px; align-items: start;">
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">
            <h3>Официальный отчёт об оценке № ${o.reportNumber}</h3>
            <p>Фирменный официальный документ по утверждённому стандарту ООО «РусОценка» и требованиям ФСО</p>
          </div>
          <button class="btn btn-primary btn-sm" id="btn-export-word-tab">
            ${icon('download')} Скачать Word (.docx)
          </button>
        </div>

        <div style="background: #ffffff; border: 1px solid var(--border); border-radius: 8px; padding: 24px; font-size: 13px; line-height: 1.6; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 1px solid var(--border-light); padding-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <img src="/images/rosocenka-emblem.png" style="width: 32px; height: 32px; object-fit: contain;">
              <div>
                <strong style="color: var(--primary); font-size: 14px;">ООО «РусОценка»</strong><br>
                <span style="font-size: 11px; color: var(--text-muted);">г. Тольятти, ул. Гидростроевская, д. 12 · ro63.ru</span>
              </div>
            </div>
            <div style="text-align: right; font-size: 12px; color: var(--text-muted);">
              <strong>УТВЕРЖДАЮ</strong><br>
              Директор ООО «РусОценка»<br>
              ___________ А.А. Орлова
            </div>
          </div>

          <h3 style="font-size: 16px; font-weight: 700; color: var(--text-dark); margin-bottom: 6px;">
            ОТЧЕТ ОБ ОЦЕНКЕ № ${o.reportNumber}
          </h3>
          <p style="margin-bottom: 12px; color: var(--text-body);">
            Объект: ${o.propertyType}, кадастровый номер <b>${o.cadastralNumber}</b>, общая площадь <b>${sqm(o.area)}</b>, адрес: <b>${o.address}</b>
          </p>

          <div style="background: var(--primary-light); border: 1px solid var(--primary-border); border-radius: 8px; padding: 14px 18px; margin: 16px 0; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: 12px; color: var(--text-muted);">Итоговая рыночная стоимость полного права:</div>
              <div style="font-size: 20px; font-weight: 750; color: var(--primary);">${money(res.total)}</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 12px; color: var(--text-muted);">Цена за 1 кв.м:</div>
              <div style="font-size: 16px; font-weight: 650; color: var(--text-dark);">${moneyPerSqm(res.pricePerSqm)}</div>
            </div>
          </div>

          <div style="margin-top: 18px; border-top: 1px solid var(--border); padding-top: 14px;">
            <div style="font-size: 12px; font-weight: 650; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
              Состав сформированного официального Word-документа (.docx):
            </div>
            <ul style="margin-left: 18px; color: var(--text-body); font-size: 12.5px; display: grid; gap: 4px;">
              <li>Титульный лист с реквизитами ООО «РусОценка», печатью и грифом утверждения директора</li>
              <li>Раздел 1: Основные факты и выводы (Сводная таблица 1.1 и расчет долей Таблица 1.2)</li>
              <li>Раздел 2: Задание на оценку в строгом соответствии с требованиями ФСО IV (Таблица 2.1)</li>
              <li>Раздел 3: Сведения о заказчике оценки, об оценщике Орловой А.А. и оценочной компании</li>
              <li>Раздел 4: Нормативная база стандартов оценки (135-ФЗ, ФСО I-VI № 200, ФСО № 7)</li>
              <li>Раздел 5: Описание и характеристики объекта оценки (Таблица 5.1 с пометками для осмотра)</li>
              <li>Раздел 6: Анализ рынка жилой недвижимости г. Тольятти и обоснование скидки на уторгование</li>
              <li>Раздел 7: Сравнительный подход (Таблица 7.1 аналогов, Таблица 7.2 матрицы поправок Лейфера, Таблица 7.3 контроля вариации V ≤ 33%)</li>
              <li>Раздел 8: Реестр источников информации и ссылок на открытые объявления-аналоги</li>
              <li>Раздел 9: Заключение эксперта-оценщика, итоговая сумма цифрами и прописью, подписи и М.П.</li>
              <li>Раздел 10: Приложения к отчету (квалификационные документы, выписка ЕГРН, скриншоты, фототаблица)</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Right Column: Audit & Responsibilities -->
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <!-- Зона самоконтроля оценщика перед выгрузкой (Чеклист) -->
        <div class="checklist-panel">
          <div class="checklist-panel-header">
            <div class="checklist-panel-title">
              <span class="checklist-tag">${icon('shield-alert')} Зона контроля оценщика</span>
              <h4>Самоконтроль перед выгрузкой</h4>
              <p>Обязательная персональная верификация данных перед печатью отчёта</p>
            </div>
            <div class="checklist-status-badge ${allChecked ? 'verified' : 'pending'}" id="checklist-status-badge">
              ${icon(allChecked ? 'check-circle-2' : 'shield-check')}
              <span id="checklist-status-text">${allChecked ? 'Отчёт полностью проверен (5 из 5)' : `Самоконтроль: пройдено ${checkedCount} из 5`}</span>
            </div>
          </div>

          <div class="checklist-items-wrap">
            <label class="checklist-item ${cl.egrn ? 'checked' : ''}">
              ${renderRosocenkaCheckbox({ attrs: 'data-checklist-key="egrn"', checked: !!cl.egrn, asSpan: true })}
              <span class="checklist-text">
                <strong>1. Сверка с ЕГРН:</strong> кадастровый номер <b>${o.cadastralNumber}</b>, площадь <b>${o.area} м²</b>, этаж <b>${o.floor}/${o.totalFloors}</b> сверены с выпиской.
              </span>
            </label>

            <label class="checklist-item ${cl.inspection ? 'checked' : ''}">
              ${renderRosocenkaCheckbox({ attrs: 'data-checklist-key="inspection"', checked: !!cl.inspection, asSpan: true })}
              <span class="checklist-text">
                <strong>2. Акт осмотра:</strong> класс отделки <b>«${o.finish}»</b> и состояние подтверждены актом натурного осмотра.
              </span>
            </label>

            <label class="checklist-item ${cl.market ? 'checked' : ''}">
              ${renderRosocenkaCheckbox({ attrs: 'data-checklist-key="market"', checked: !!cl.market, asSpan: true })}
              <span class="checklist-text">
                <strong>3. Чистота аналогов:</strong> объявления проверены на открытом рынке (цены без скрытых условий и комиссии, ссылки активны).
              </span>
            </label>

            <label class="checklist-item ${cl.leifer ? 'checked' : ''}">
              ${renderRosocenkaCheckbox({ attrs: 'data-checklist-key="leifer"', checked: !!cl.leifer, asSpan: true })}
              <span class="checklist-text">
                <strong>4. Таблица 12.2:</strong> поправки Лейфера (торг ${percent(o.tradeAdjustment)}, этаж, площадь, отделка) и веса согласованы.
              </span>
            </label>

            <label class="checklist-item ${cl.shares ? 'checked' : ''}">
              ${renderRosocenkaCheckbox({ attrs: 'data-checklist-key="shares"', checked: !!cl.shares, asSpan: true })}
              <span class="checklist-text">
                <strong>5. Таблица 12.5:</strong> доли правообладателей (${(o.shares || []).length} чел.) проверены по документам собственности.
              </span>
            </label>
          </div>

          <div class="checklist-disclaimer">
            ${icon('info')}
            <span>Программный комплекс гарантирует точность математических расчётов по методике ФСО №7 и Лейфера. Оценщик несёт персональную ответственность за достоверность первичных данных осмотра и отбор аналогов.</span>
          </div>
        </div>

        <!-- Large Action Button -->
        <button class="btn btn-primary" id="btn-export-word-sidebar" style="width: 100%; justify-content: center; padding: 13px; font-size: 14px; font-weight: 700; gap: 10px; box-shadow: 0 2px 8px rgba(30, 64, 175, 0.25);">
          ${icon('download')} Скачать официальный Word (.docx)
        </button>
      </div>
    </div>
  `;
}

/**
 * Обработчики событий UI
 */
function bindEvents() {
  // Glass Appearance Adjuster Toggle & Close
  document.getElementById('btn-toggle-glass')?.addEventListener('click', e => {
    e.stopPropagation();
    isGlassDrawerOpen = !isGlassDrawerOpen;
    render();
  });
  document.getElementById('btn-close-glass')?.addEventListener('click', () => {
    isGlassDrawerOpen = false;
    render();
  });

  // Glass Sliders
  document.getElementById('range-blur')?.addEventListener('input', e => {
    glassSettings.blur = Number(e.target.value);
    applyGlassSettings();
    const out = document.getElementById('out-blur');
    if (out) out.textContent = `${glassSettings.blur} px`;
  });
  document.getElementById('range-opacity')?.addEventListener('input', e => {
    glassSettings.opacity = Number(e.target.value);
    applyGlassSettings();
    const out = document.getElementById('out-opacity');
    if (out) out.textContent = `${Math.round(glassSettings.opacity * 100)}%`;
  });
  document.getElementById('range-edge')?.addEventListener('input', e => {
    glassSettings.edge = Number(e.target.value);
    applyGlassSettings();
    const out = document.getElementById('out-edge');
    if (out) out.textContent = `${Math.round(glassSettings.edge * 100)}%`;
  });
  document.getElementById('picker-tint')?.addEventListener('input', e => {
    glassSettings.tint = e.target.value;
    applyGlassSettings();
  });

  // Glass Presets
  document.querySelectorAll('[data-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.preset;
      if (preset === 'clear') {
        glassSettings = { blur: 8, opacity: 0.15, saturation: 1.1, edge: 0.8, tint: '#ffffff' };
      } else if (preset === 'frosted') {
        glassSettings = { blur: 22, opacity: 0.35, saturation: 1.25, edge: 0.65, tint: '#ffffff' };
      } else if (preset === 'solid') {
        glassSettings = { blur: 32, opacity: 0.85, saturation: 1.0, edge: 0.35, tint: '#ffffff' };
      }
      applyGlassSettings();
      render();
      toast(`Применён стиль стекла: ${btn.textContent}`);
    });
  });

  document.getElementById('btn-reset-glass')?.addEventListener('click', () => {
    glassSettings = { blur: 22, opacity: 0.35, saturation: 1.25, edge: 0.65, tint: '#ffffff' };
    applyGlassSettings();
    render();
    toast('Свойства стекла сброшены по умолчанию');
  });

  // Chart Period Switcher (Week / Month / Year)
  document.querySelectorAll('[data-period]').forEach(btn => {
    btn.addEventListener('click', () => {
      chartPeriod = btn.dataset.period;
      render();
    });
  });

  // Chart / Table View Toggle
  document.querySelectorAll('[data-chart-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      dashChartView = btn.dataset.chartView;
      render();
    });
  });

  // Interactive Chart Point Hover
  document.querySelectorAll('[data-point-idx]').forEach(dot => {
    dot.addEventListener('mouseenter', () => {
      const idx = Number(dot.dataset.pointIdx);
      const pts = getDashboardChartPoints(chartPeriod);
      const p = pts[idx];
      if (!p) return;
      const badge = document.getElementById('chart-pin-badge');
      const line = document.getElementById('chart-crosshair-line');
      const cx = dot.getAttribute('cx');
      const cy = dot.getAttribute('cy');
      if (badge && cx && cy) {
        const pctX = ((Number(cx) / 680) * 100).toFixed(2);
        badge.style.left = `${pctX}%`;
        badge.style.top = `${cy}px`;
        badge.textContent = `${p.price.toLocaleString('ru-RU')} ₽`;
      }
      if (line && cx) {
        line.setAttribute('x1', cx);
        line.setAttribute('x2', cx);
      }
    });
  });

  // Dashboard Registry Table Filter Pills
  document.querySelectorAll('[data-dash-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      dashTableFilter = btn.dataset.dashFilter;
      render();
    });
  });

  // Закрепление боковой панели (Pin toggle)
  document.getElementById('btn-sidebar-pin')?.addEventListener('click', e => {
    e.stopPropagation();
    isSidebarPinned = !isSidebarPinned;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('rosocenka_sidebar_pinned', String(isSidebarPinned));
    }
    const sb = document.getElementById('app-sidebar');
    if (sb) {
      if (isSidebarPinned) {
        sb.classList.add('is-pinned');
        sb.classList.add('is-expanded');
      } else {
        sb.classList.remove('is-pinned');
      }
    }
    toast(isSidebarPinned ? 'Боковая панель закреплена' : 'Боковая панель откреплена');
    render();
  });

  // Navigation: Sidebar items with smooth view transition
  document.querySelectorAll('[data-nav]').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.nav;
      transitionRender(() => {
        if (target === 'dashboard') {
          currentView = 'dashboard';
        } else {
          currentView = 'cabinet';
          if (target === 'all-cases') filterStatus = 'all';
          if (target === 'in-progress') filterStatus = 'В работе';
          if (target === 'ready') filterStatus = 'Готов';
        }
      });
    });
  });

  // Breadcrumbs navigation with smooth transition
  document.getElementById('crumb-dashboard')?.addEventListener('click', e => {
    e.preventDefault();
    transitionRender(() => {
      currentView = 'dashboard';
    });
  });
  document.getElementById('crumb-cabinet')?.addEventListener('click', e => {
    e.preventDefault();
    transitionRender(() => {
      currentView = 'cabinet';
    });
  });

  // Open case tab with smooth tab transition
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;
      transitionRender(() => {
        currentView = 'case';
        activeTab = targetTab;
      });
    });
  });

  // Create new case buttons
  const openNewCaseModal = () => openCreateCaseModal();
  document.getElementById('btn-create-case-sidebar')?.addEventListener('click', openNewCaseModal);
  document.getElementById('btn-new-case-head')?.addEventListener('click', openNewCaseModal);
  document.getElementById('btn-empty-create')?.addEventListener('click', openNewCaseModal);
  document.getElementById('btn-hero-new')?.addEventListener('click', openNewCaseModal);
  document.getElementById('btn-top-new-case')?.addEventListener('click', openNewCaseModal);

  // Search cases input
  const searchInput = document.getElementById('search-cases-input');
  if (searchInput) {
    searchInput.addEventListener('input', e => {
      searchQuery = e.target.value;
      render();
      const input = document.getElementById('search-cases-input');
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    });
  }

  // Filter status pills
  document.querySelectorAll('[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      filterStatus = btn.dataset.filter;
      render();
    });
  });

  // Case card actions (open, continue, toggle-pin, delete, export)
  document.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', async e => {
      const action = btn.dataset.action;
      const id = btn.dataset.id;

      if (action === 'toggle-pin') {
        e.stopPropagation();
        cases = toggleCasePin(cases, id);
        const c = findCaseById(cases, id);
        toast(c && c.isPinned ? `Дело № ${c.number} закреплено на главной` : `Дело № ${c.number} откреплено`);
        render();
      } else if (action === 'open-case') {
        transitionRender(() => {
          activeCaseId = id;
          setActiveCaseId(id);
          currentView = 'case';
          activeTab = 'analogs';
        });
      } else if (action === 'continue-case') {
        transitionRender(() => {
          activeCaseId = id;
          setActiveCaseId(id);
          currentView = 'case';
          const c = findCaseById(cases, id);
          activeTab = (c && c.status === 'Черновик' && c.analogs.length === 0) ? 'analogs' : 'analogs';
        });
      } else if (action === 'delete-case') {
        if (confirm('Вы уверены, что хотите удалить это дело?')) {
          cases = deleteCaseById(cases, id);
          if (activeCaseId === id) {
            activeCaseId = cases[0] ? cases[0].id : null;
            setActiveCaseId(activeCaseId);
          }
          render();
          toast('Дело удалено из базы');
        }
      } else if (action === 'export-word') {
        const c = findCaseById(cases, id);
        if (c) {
          toast('Формирование официального отчёта Word по стандарту ООО «РусОценка»...');
          try {
            await exportApartmentReport(c.objectData, c.analogs);
            toast('Отчёт сформирован и загружен');
          } catch (err) {
            console.error(err);
            toast('Ошибка при формировании отчёта Word: ' + err.message);
          }
        }
      }
    });
  });

  // Case status select
  const statusSelect = document.getElementById('case-status-select');
  if (statusSelect) {
    statusSelect.addEventListener('change', e => {
      const c = getActiveCase();
      if (c) {
        c.status = e.target.value;
        cases = updateCase(cases, c);
        render();
        toast('Статус дела изменён: ' + c.status);
      }
    });
  }

  // Topbar print & word
  document.getElementById('btn-top-print')?.addEventListener('click', () => window.print());
  const handleExportWord = async () => {
    const c = getActiveCase();
    if (c) {
      toast('Формирование официального отчёта Word по стандарту ООО «РусОценка»...');
      try {
        await exportApartmentReport(c.objectData, c.analogs);
        toast('Отчёт успешно сформирован и загружен');
      } catch (err) {
        console.error(err);
        toast('Ошибка при формировании отчёта: ' + err.message);
      }
    }
  };
  document.getElementById('btn-top-word')?.addEventListener('click', handleExportWord);
  document.getElementById('btn-export-word-tab')?.addEventListener('click', handleExportWord);
  document.getElementById('btn-export-word-sidebar')?.addEventListener('click', handleExportWord);

  // Reset demo cases
  document.getElementById('btn-reset-demo')?.addEventListener('click', () => {
    if (confirm('Сбросить реестр дел к исходным демонстрационным примерам Анны?')) {
      cases = resetAllCases();
      activeCaseId = cases[0].id;
      render();
      toast('Реестр дел восстановлен');
    }
  });

  // Case trade slider in tab analogs
  const tradeSlider = document.getElementById('case-trade-slider');
  if (tradeSlider) {
    tradeSlider.addEventListener('input', e => {
      const c = getActiveCase();
      if (c) {
        c.objectData.tradeAdjustment = parseFloat(e.target.value);
        cases = updateCase(cases, c);
        render();
      }
    });
  }

  // City filter in analogs tab
  document.querySelectorAll('[data-city-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      analogCityFilter = btn.dataset.cityFilter;
      render();
    });
  });

  // Toggle calculation audit drawer
  document.querySelectorAll('[data-action="toggle-audit"]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.dataset.id;
      if (expandedAuditIds.has(id)) {
        expandedAuditIds.delete(id);
      } else {
        expandedAuditIds.add(id);
      }
      render();
    });
  });

  // Interactive self-control checklist in tab 4 (in-place DOM update, no page jump)
  document.querySelectorAll('[data-checklist-key]').forEach(cb => {
    cb.addEventListener('change', e => {
      const key = e.target.dataset.checklistKey;
      const c = getActiveCase();
      if (!c) return;
      if (!c.checklist) {
        c.checklist = { egrn: false, inspection: false, market: false, leifer: false, shares: false };
      }
      c.checklist[key] = e.target.checked;
      cases = updateCase(cases, c);

      const itemEl = e.target.closest('.checklist-item');
      if (itemEl) {
        itemEl.classList.toggle('checked', e.target.checked);
      }

      const count = Object.values(c.checklist).filter(Boolean).length;
      const allOk = count === 5;
      const badgeEl = document.getElementById('checklist-status-badge');
      const textEl = document.getElementById('checklist-status-text');
      if (badgeEl) {
        badgeEl.classList.toggle('verified', allOk);
        badgeEl.classList.toggle('pending', !allOk);
      }
      if (textEl) {
        textEl.textContent = allOk
          ? 'Отчёт полностью проверен (5 из 5)'
          : `Самоконтроль: пройдено ${count} из 5`;
      }
      if (allOk) {
        toast('Все 5 пунктов самоконтроля подтверждены! Отчёт готов.');
      }
    });
  });

  // Toggle analog checkbox (in-place recalculation, no page jump or animation replay)
  document.querySelectorAll('[data-analog-toggle]').forEach(cb => {
    cb.addEventListener('change', e => {
      const id = e.target.dataset.analogToggle;
      const c = getActiveCase();
      if (!c) return;
      const item = c.analogs.find(a => a.id === id);
      if (!item) return;

      item.selected = e.target.checked;
      cases = updateCase(cases, c);

      const res = calculateValuation(c.objectData, c.analogs, c.objectData.tradeAdjustment);
      c.analogs.forEach((a, idx) => {
        const rowEl = document.querySelector(`[data-analog-row="${a.id}"]`);
        if (!rowEl) return;
        const row = res.rows.find(r => r.id === a.id);
        const isSelected = a.selected;

        rowEl.classList.toggle('active-row', isSelected);
        rowEl.classList.toggle('inactive-row', !isSelected);

        const adjPriceCell = rowEl.querySelector('[data-cell="adj-price"]');
        if (adjPriceCell) {
          adjPriceCell.textContent = isSelected && row ? moneyPerSqm(row.finalAdjustedPrice) : '—';
        }
        const kiCell = rowEl.querySelector('[data-cell="ki"]');
        if (kiCell) {
          kiCell.innerHTML = `<b>${isSelected && row ? row.correctionsCount : '—'}</b>`;
        }
        const weightCell = rowEl.querySelector('[data-cell="weight"]');
        if (weightCell) {
          weightCell.innerHTML = isSelected && row
            ? `<div class="weight-bar-wrap"><div class="weight-track"><div class="weight-fill" style="width: ${row.weight * 100 * 3}%;"></div></div><span class="weight-label">${weightFmt(row.weight)}</span></div>`
            : '<span style="color: var(--text-dim);">0%</span>';
        }

        const auditRow = document.querySelector(`[data-audit-row="${a.id}"] td`);
        if (auditRow) {
          const audit = (row && row.audit) ? row.audit : calculateAnalogAudit(a, c.objectData, c.objectData.tradeAdjustment, res.totalCorrections, res.selectedCount);
          auditRow.innerHTML = renderAnalogAuditDrawer(a, audit, c.objectData, idx + 1);
          createIcons({ icons });
        }
      });
    });
  });

  // Delete analog button
  document.querySelectorAll('[data-action="delete-analog"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const c = getActiveCase();
      if (c) {
        c.analogs = c.analogs.filter(a => a.id !== id);
        cases = updateCase(cases, c);
        render();
        toast('Аналог удалён из таблицы');
      }
    });
  });

  // Add analog modal button
  document.getElementById('btn-add-analog-modal')?.addEventListener('click', () => openAddAnalogModal());

  // Save object form
  document.getElementById('btn-save-obj')?.addEventListener('click', () => {
    const form = document.getElementById('form-case-object');
    if (!form || !form.reportValidity()) return;
    const fd = new FormData(form);
    const c = getActiveCase();
    if (c) {
      c.objectData.reportNumber = fd.get('reportNumber');
      c.objectData.cadastralNumber = fd.get('cadastralNumber');
      c.objectData.valuationDate = fd.get('valuationDate');
      c.objectData.address = fd.get('address');
      c.objectData.area = parseFloat(fd.get('area'));
      c.objectData.floor = parseInt(fd.get('floor'));
      c.objectData.totalFloors = parseInt(fd.get('totalFloors'));
      c.objectData.finish = fd.get('finish');
      c.objectData.wallMaterial = fd.get('wallMaterial');
      c.objectData.condition = fd.get('condition');
      c.objectData.client = fd.get('client');
      c.objectData.purpose = fd.get('purpose');
      c.number = c.objectData.reportNumber;
      cases = updateCase(cases, c);
      render();
      toast('Параметры объекта успешно сохранены');
    }
  });

  // Add share button (строго <= 100%: остаток или деление 1 поровну на всех)
  document.getElementById('btn-add-share')?.addEventListener('click', () => {
    const c = getActiveCase();
    if (c) {
      if (!c.objectData.shares) c.objectData.shares = [];
      const shares = c.objectData.shares;
      const rem = getRemainingShareFraction(shares);

      if (rem.num > 0) {
        shares.push({
          id: 's_' + Date.now(),
          holder: 'Новый собственник',
          num: rem.num,
          den: rem.den,
        });
      } else {
        shares.push({
          id: 's_' + Date.now(),
          holder: 'Новый собственник',
          num: 1,
          den: 1,
        });
        const totalOwners = shares.length;
        shares.forEach(s => {
          s.num = 1;
          s.den = totalOwners;
        });
      }
      cases = updateCase(cases, c);
      render();
      toast('Собственник добавлен, доли распределены на 100%');
    }
  });

  // Equal shares button (разделить 100% поровну)
  document.getElementById('btn-equal-shares')?.addEventListener('click', () => {
    const c = getActiveCase();
    if (c && c.objectData.shares && c.objectData.shares.length > 0) {
      const n = c.objectData.shares.length;
      c.objectData.shares.forEach(s => {
        s.num = 1;
        s.den = n;
      });
      cases = updateCase(cases, c);
      render();
      toast(`Единица разделена поровну (по 1/${n})`);
    }
  });

  // Delete share button
  document.querySelectorAll('[data-action="delete-share"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index);
      const c = getActiveCase();
      if (c && c.objectData.shares && c.objectData.shares.length > 1) {
        c.objectData.shares.splice(idx, 1);
        const shares = c.objectData.shares;
        if (shares.length === 1) {
          shares[0].num = 1;
          shares[0].den = 1;
        } else {
          const first = shares[0];
          const allEqual = shares.every(s => s.num === first.num && s.den === first.den);
          if (allEqual) {
            shares.forEach(s => {
              s.num = 1;
              s.den = shares.length;
            });
          }
        }
        cases = updateCase(cases, c);
        render();
        toast('Собственник удалён');
      }
    });
  });

  // Live edit shares with strict <= 100% cap
  const applyShareChange = (idx, nextNum, nextDen) => {
    const c = getActiveCase();
    if (!c || !c.objectData.shares[idx]) return;
    const shares = c.objectData.shares;
    const safeDen = Math.max(1, Math.round(nextDen) || 1);
    const safeNum = Math.max(0, Math.round(nextNum) || 0);
    const rem = getRemainingShareFraction(shares, idx);

    if (safeNum * rem.den > rem.num * safeDen) {
      shares[idx].num = rem.num;
      shares[idx].den = rem.den;
      toast('Сумма долей не может превышать 100%. Установлен доступный остаток.');
    } else {
      shares[idx].num = safeNum;
      shares[idx].den = safeDen;
    }
    cases = updateCase(cases, c);
    render();
  };

  document.querySelectorAll('[data-share-holder]').forEach(inp => {
    inp.addEventListener('change', e => {
      const idx = parseInt(e.target.dataset.shareHolder);
      const c = getActiveCase();
      if (c && c.objectData.shares[idx]) {
        c.objectData.shares[idx].holder = e.target.value;
        cases = updateCase(cases, c);
      }
    });
  });
  document.querySelectorAll('[data-share-num]').forEach(inp => {
    inp.addEventListener('change', e => {
      const idx = parseInt(e.target.dataset.shareNum);
      const c = getActiveCase();
      if (c && c.objectData.shares[idx]) {
        applyShareChange(idx, parseInt(e.target.value), c.objectData.shares[idx].den);
      }
    });
  });
  document.querySelectorAll('[data-share-den]').forEach(inp => {
    inp.addEventListener('change', e => {
      const idx = parseInt(e.target.dataset.shareDen);
      const c = getActiveCase();
      if (c && c.objectData.shares[idx]) {
        applyShareChange(idx, c.objectData.shares[idx].num, parseInt(e.target.value));
      }
    });
  });

  setupScrollReveal();
}

/**
 * Плавная анимация появления блоков и графиков при прокрутке вниз
 */
function setupScrollReveal() {
  if (scrollObserver) {
    scrollObserver.disconnect();
    scrollObserver = null;
  }

  const els = document.querySelectorAll('.reveal-on-scroll');
  if (!els.length) return;

  if (typeof IntersectionObserver === 'undefined') {
    els.forEach(el => el.classList.add('is-visible'));
    return;
  }

  scrollObserver = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.08,
    rootMargin: '0px 0px -30px 0px',
  });

  const scheduleVisible = el => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => el.classList.add('is-visible'));
    } else {
      el.classList.add('is-visible');
    }
  };

  els.forEach(el => {
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.94) {
      scheduleVisible(el);
    } else {
      scrollObserver.observe(el);
    }
  });
}

/**
 * Модальное окно создания нового дела
 */
function openCreateCaseModal() {
  const dialog = document.getElementById('modal-dialog');
  const nextNumber = `24/${String(Date.now()).slice(-4)}-1`;

  dialog.innerHTML = `
    <div class="modal-header">
      <h3>Новый объект оценки (Квартира)</h3>
      <button type="button" class="btn btn-secondary btn-sm" id="modal-close" aria-label="Закрыть">${CLOSE_ICON_SVG}</button>
    </div>
    <form id="form-new-case" class="modal-form">
      <div class="form-row">
        <div class="form-group">
          <label>Номер отчёта / дела</label>
          <input type="text" name="number" value="${nextNumber}" required>
        </div>
        <div class="form-group">
          <label>Дата оценки</label>
          <input type="date" name="valuationDate" value="${new Date().toISOString().slice(0, 10)}" required>
        </div>
      </div>

      <div class="form-group">
        <label>Адрес объекта оценки (Любой регион РФ)</label>
        <input type="text" name="address" placeholder="г. Москва / Санкт-Петербург / Самара / Казань / Тольятти, ул. ..." required>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Кадастровый номер</label>
          <input type="text" name="cadastralNumber" placeholder="63:09:..." value="63:09:0102030:1042" required>
        </div>
        <div class="form-group">
          <label>Общая площадь (м²)</label>
          <input type="number" step="0.1" name="area" placeholder="54.0" value="54.0" required>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Этаж / Этажность</label>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; min-width: 0;">
            <input type="number" name="floor" placeholder="Этаж" value="4" required>
            <input type="number" name="totalFloors" placeholder="Всего" value="9" required>
          </div>
        </div>
        <div class="form-group">
          <label>Тип отделки</label>
          <select name="finish">
            <option value="улучшенная">Улучшенная</option>
            <option value="простая">Простая</option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label>Заказчик оценки (ФИО)</label>
        <input type="text" name="client" placeholder="Петров Сергей Александрович" value="Петров Сергей Александрович" required>
      </div>

      <div style="background: #f8fafc; border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; font-size: 13px; color: var(--text-muted); display: flex; align-items: center; gap: 10px;">
        <input type="checkbox" id="check-include-sample-analogs" checked style="width: 16px; height: 16px; flex-shrink: 0;">
        <label for="check-include-sample-analogs" style="cursor: pointer;">
          Загрузить типовую выборку рыночных аналогов
        </label>
      </div>

      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" id="modal-cancel">Отмена</button>
        <button type="submit" class="btn btn-primary">Создать дело и открыть</button>
      </div>
    </form>
  `;
  dialog.showModal();

  dialog.querySelector('#modal-close').onclick = () => dialog.close();
  dialog.querySelector('#modal-cancel').onclick = () => dialog.close();
  dialog.querySelector('#form-new-case').onsubmit = e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const includeAnalogs = dialog.querySelector('#check-include-sample-analogs').checked;

    const newCase = createNewCase({
      number: fd.get('number'),
      valuationDate: fd.get('valuationDate'),
      address: fd.get('address'),
      cadastralNumber: fd.get('cadastralNumber'),
      area: parseFloat(fd.get('area')),
      floor: parseInt(fd.get('floor')),
      totalFloors: parseInt(fd.get('totalFloors')),
      finish: fd.get('finish'),
      client: fd.get('client'),
      analogs: includeAnalogs ? defaultAnalogs() : [],
    });

    cases.unshift(newCase);
    saveCases(cases);
    activeCaseId = newCase.id;
    setActiveCaseId(activeCaseId);
    currentView = 'case';
    activeTab = 'analogs';
    dialog.close();
    render();
    toast(`Дело № ${newCase.number} успешно создано`);
  };
}

/**
 * Модальное окно добавления аналога
 */
function openAddAnalogModal() {
  const dialog = document.getElementById('modal-dialog');
  const c = getActiveCase();
  if (!c) return;

  dialog.innerHTML = `
    <div class="modal-header">
      <h3>Добавить аналог в расчёт</h3>
      <button type="button" class="btn btn-secondary btn-sm" id="modal-close" aria-label="Закрыть">${CLOSE_ICON_SVG}</button>
    </div>
    <form id="form-add-analog" class="modal-form">
      <div class="form-group">
        <label>Адрес предложения (аналога)</label>
        <input type="text" name="address" placeholder="Любой город РФ, ул. ..." required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Цена предложения (руб.)</label>
          <input type="number" name="price" placeholder="3600000" required>
        </div>
        <div class="form-group">
          <label>Площадь (м²)</label>
          <input type="number" step="0.1" name="area" placeholder="68.0" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Этаж / Этажность</label>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; min-width: 0;">
            <input type="number" name="floor" placeholder="Этаж" value="3" required>
            <input type="number" name="totalFloors" placeholder="Всего" value="5" required>
          </div>
        </div>
        <div class="form-group">
          <label>Отделка</label>
          <select name="finish">
            <option value="улучшенная">Улучшенная</option>
            <option value="простая">Простая</option>
          </select>
        </div>
      </div>
      <div class="form-group highlighted">
        <label>Ссылка на объявление (Авито / Циан / ДомКлик) <span class="badge-source">Обязательно для ФСО</span></label>
        <input type="url" name="url" placeholder="https://www.avito.ru/..." required>
        <small style="color: var(--primary); font-size: 11px; margin-top: 4px; display: block;">Прямая ссылка для верификации цены и параметров оценщиком («Где взял?»)</small>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" id="modal-cancel">Отмена</button>
        <button type="submit" class="btn btn-primary">Добавить в таблицу</button>
      </div>
    </form>
  `;
  dialog.showModal();

  dialog.querySelector('#modal-close').onclick = () => dialog.close();
  dialog.querySelector('#modal-cancel').onclick = () => dialog.close();
  dialog.querySelector('#form-add-analog').onsubmit = e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const rawUrl = (fd.get('url') || '').trim();
    let srcName = 'Открытый рынок';
    if (rawUrl.includes('avito')) srcName = 'Авито';
    else if (rawUrl.includes('cian')) srcName = 'Циан';
    else if (rawUrl.includes('volga')) srcName = 'Волга-Инфо';
    else if (rawUrl.includes('domclick')) srcName = 'ДомКлик';

    const newAnalog = {
      id: 'a_' + Date.now(),
      number: c.analogs.length + 1,
      selected: true,
      address: fd.get('address'),
      price: parseFloat(fd.get('price')),
      area: parseFloat(fd.get('area')),
      floor: parseInt(fd.get('floor')),
      totalFloors: parseInt(fd.get('totalFloors')),
      wallMaterial: 'панель',
      finish: fd.get('finish'),
      condition: 'хорошее',
      balcony: 'да',
      furniture: 'да',
      source: srcName,
      url: rawUrl,
      published: 'текущий месяц',
      floorAdj: 0.0,
      finishAdj: 0.0,
      areaAdj: 0.0,
    };
    c.analogs.push(newAnalog);
    cases = updateCase(cases, c);
    dialog.close();
    render();
    toast('Аналог добавлен в сравнительную таблицу');
  };
}

// Initial render
render();
