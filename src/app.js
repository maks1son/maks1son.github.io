import { createIcons, icons } from 'lucide';
import {
  calculateValuation,
  money,
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
let filterStatus = 'all';
let searchQuery = '';
let scrollObserver = null;

const icon = name => `<i data-lucide="${name}"></i>`;
const CLOSE_ICON_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;

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

function render() {
  const app = document.getElementById('app');
  const activeCase = getActiveCase();

  // Sidebar counters
  const inProgressCount = cases.filter(c => c.status === 'В работе').length;
  const readyCount = cases.filter(c => c.status === 'Готов').length;

  app.innerHTML = `
    <!-- Chrome-like Expandable Sidebar (White & Light Blue) -->
    <aside class="app-sidebar" id="app-sidebar">
      <div class="sidebar-header">
        <img class="brand-emblem-img" src="/images/rosocenka-emblem.png" alt="РусОценка">
        <div class="brand-title">
          <strong>РУСОЦЕНКА</strong>
          <span>Кабинет оценщика</span>
        </div>
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
    </aside>

    <!-- Main Content Area -->
    <div class="app-main">
      <!-- Topbar -->
      <header class="app-topbar">
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
      </header>

      <!-- View Content -->
      <main class="page-container">
        ${currentView === 'dashboard'
          ? renderDashboardView()
          : (currentView === 'cabinet' ? renderCabinetView() : renderCaseWorkspaceView(activeCase))}
      </main>
    </div>

    <div id="toast" role="status" aria-live="polite"></div>
    <dialog id="modal-dialog"></dialog>
  `;

  createIcons({ icons });
  bindEvents();
}

/**
 * Карточка дела для отображения на Главной и в Личном кабинете
 */
function renderCaseDashboardCard(c, isPinnedSection = false) {
  const res = calculateValuation(c.objectData, c.analogs, c.objectData.tradeAdjustment);
  const statusClass = c.status === 'Готов' ? 'ready' : (c.status === 'В работе' ? 'in-progress' : 'draft');
  const displayTotal = res.total
    ? money(res.total)
    : money(Math.round((c.objectData.area * 47000) / 1000) * 1000) + ' (расч.)';
  const displayPerSqm = res.pricePerSqm
    ? moneyPerSqm(res.pricePerSqm)
    : '~47 000 ₽/м²';

  return `
    <div class="case-card ${c.isPinned ? 'is-pinned-card' : ''}">
      <div>
        <div class="case-header-row">
          <button class="btn-star ${c.isPinned ? 'pinned' : ''}" data-action="toggle-pin" data-id="${c.id}" title="${c.isPinned ? 'Открепить дело' : 'Закрепить дело на главной'}">
            ${icon('star')}
          </button>
          <span class="case-num">ДЕЛО № ${c.number}</span>
          <span class="badge-status ${statusClass}">${c.status}</span>
          <span style="font-size: 13px; color: var(--text-dim);">Дата: ${c.objectData.valuationDate}</span>
        </div>
        <div class="case-addr">${c.objectData.address}</div>
        <div class="case-sub-meta">
          <span>${icon('user')} Заказчик: <b>${c.objectData.client}</b></span>
          <span>${icon('maximize')} Площадь: <b>${sqm(c.objectData.area)}</b></span>
          <span>${icon('building')} Этаж: <b>${c.objectData.floor}/${c.objectData.totalFloors}</b></span>
          <span>${icon('layers')} Аналогов в расчёте: <b>${res.selectedCount} из ${c.analogs.length}</b></span>
        </div>

        ${c.status !== 'Готов' ? `
          <div class="case-progress-wrap">
            <div class="case-progress-meta">
              <span>${c.progressStep || 'В процессе расчёта'}</span>
              <strong>${c.progress || 50}% выполнено</strong>
            </div>
            <div class="case-progress-track">
              <div class="case-progress-bar" style="width: ${c.progress || 50}%; background: ${c.status === 'Черновик' ? '#94a3b8' : 'linear-gradient(90deg, #f59e0b, #eab308)'};"></div>
            </div>
          </div>
        ` : ''}
      </div>

      <div class="case-right-meta">
        <div>
          <div class="case-val-amount">${displayTotal}</div>
          <div class="case-val-sub">${displayPerSqm}</div>
        </div>
        <div class="case-actions">
          ${c.status === 'Готов' ? `
            <button class="btn btn-secondary btn-sm" data-action="export-word" data-id="${c.id}" title="Скачать официальный Word (.docx)">
              ${icon('file-text')} Word
            </button>
          ` : ''}
          <button class="btn btn-danger btn-sm" data-action="delete-case" data-id="${c.id}" title="Удалить дело">
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

  return `
    <!-- Clean Unboxed Greeting Header (No Frame, No Microtext) -->
    <section class="dashboard-welcome anim-fade-up">
      <h1 class="welcome-title">Здравствуйте, Анна Александровна!</h1>
      <div class="welcome-actions">
        <button class="btn btn-primary" id="btn-hero-new">
          ${icon('plus')} Добавить объект оценки
        </button>
        <button class="btn btn-secondary" id="btn-hero-cabinet" data-nav="all-cases">
          ${icon('folder')} Все дела (${cases.length})
        </button>
      </div>
    </section>

    <!-- Key Metrics Ribbon (KPIs with Mini Sparklines) -->
    <section class="kpi-grid">
      <div class="kpi-card kpi-card-blue anim-fade-up anim-delay-1">
        <div class="kpi-top">
          <span class="kpi-icon-wrap kpi-icon-blue">${icon('wallet')}</span>
          <span class="kpi-pill kpi-pill-blue">+12% ноябрь</span>
        </div>
        <div class="kpi-value">${money(totalValuation)}</div>
        <div class="kpi-foot-row">
          <div class="kpi-label">Портфель объектов</div>
          <svg class="kpi-spark" viewBox="0 0 74 26" fill="none">
            <path d="M2 22 C14 20, 22 14, 34 15 C46 16, 56 6, 72 3" stroke="#2563eb" stroke-width="2.4" stroke-linecap="round"/>
            <circle cx="72" cy="3" r="3" fill="#2563eb"/>
          </svg>
        </div>
        <div class="kpi-meter">
          <div class="kpi-meter-fill" style="width: 100%; background: linear-gradient(90deg, #2563eb, #60a5fa);"></div>
        </div>
      </div>

      <div class="kpi-card kpi-card-purple anim-fade-up anim-delay-2">
        <div class="kpi-top">
          <span class="kpi-icon-wrap kpi-icon-purple">${icon('trending-up')}</span>
          <span class="kpi-pill kpi-pill-purple">г. Тольятти</span>
        </div>
        <div class="kpi-value">${moneyPerSqm(avgPricePerSqm)}</div>
        <div class="kpi-foot-row">
          <div class="kpi-label">Средняя цена 1 м²</div>
          <svg class="kpi-spark" viewBox="0 0 74 26" fill="none">
            <path d="M2 19 C16 18, 28 11, 40 12 C52 13, 60 5, 72 4" stroke="#7c3aed" stroke-width="2.4" stroke-linecap="round"/>
            <circle cx="72" cy="4" r="3" fill="#7c3aed"/>
          </svg>
        </div>
        <div class="kpi-meter">
          <div class="kpi-meter-fill" style="width: 78%; background: linear-gradient(90deg, #7c3aed, #a78bfa);"></div>
        </div>
      </div>

      <div class="kpi-card kpi-card-green anim-fade-up anim-delay-3">
        <div class="kpi-top">
          <span class="kpi-icon-wrap kpi-icon-green">${icon('shield-check')}</span>
          <span class="kpi-pill kpi-pill-green">ФСО ≤ 33%</span>
        </div>
        <div class="kpi-value">V = ${variationCoeff.toFixed(1).replace('.', ',')}%</div>
        <div class="kpi-foot-row">
          <div class="kpi-label">Вариация выборки</div>
          <svg class="kpi-spark" viewBox="0 0 74 26" fill="none">
            <path d="M2 12 C14 14, 24 8, 38 11 C50 14, 60 9, 72 10" stroke="#10b981" stroke-width="2.4" stroke-linecap="round"/>
            <circle cx="72" cy="10" r="3" fill="#10b981"/>
          </svg>
        </div>
        <div class="kpi-meter">
          <div class="kpi-meter-fill" style="width: 88%; background: linear-gradient(90deg, #10b981, #34d399);"></div>
        </div>
      </div>

      <div class="kpi-card kpi-card-amber anim-fade-up anim-delay-4">
        <div class="kpi-top">
          <span class="kpi-icon-wrap kpi-icon-amber">${icon('pie-chart')}</span>
          <span class="kpi-pill kpi-pill-amber">${readyCases.length} готов / ${unfinishedCases.length} в работе</span>
        </div>
        <div class="kpi-value">${readyCases.length} / ${cases.length}</div>
        <div class="kpi-foot-row">
          <div class="kpi-label">Готовность отчётов</div>
          <svg class="kpi-spark" viewBox="0 0 74 26" fill="none">
            <path d="M2 23 C18 22, 30 16, 44 13 C56 10, 64 7, 72 5" stroke="#d97706" stroke-width="2.4" stroke-linecap="round"/>
            <circle cx="72" cy="5" r="3" fill="#d97706"/>
          </svg>
        </div>
        <div class="kpi-meter">
          <div class="kpi-meter-fill" style="width: ${Math.max(18, readyPct)}%; background: linear-gradient(90deg, #f59e0b, #fbbf24);"></div>
        </div>
      </div>
    </section>

    <!-- Main Workspace Grid RIGHT ON FIRST SCREEN: Pinned Cases + In-Progress + Activity -->
    <div class="dash-main-grid">
      <div class="dash-left-col">
        <!-- Block 1: Закреплённые дела (Сразу на первом экране!) -->
        <section class="dash-section anim-fade-up anim-delay-5">
          <div class="dash-section-head">
            <div class="dash-section-title">
              <span class="icon-star-badge">${icon('star')}</span>
              <strong>Закреплённые дела</strong>
              <span class="dash-counter">${pinnedCases.length}</span>
            </div>
          </div>

          ${pinnedCases.length ? `
            <div class="cases-grid">
              ${pinnedCases.map(c => renderCaseDashboardCard(c, true)).join('')}
            </div>
          ` : `
            <div class="empty-pinned-box">
              <p>Нет закреплённых дел. Нажмите звёздочку рядом с делом, чтобы закрепить его здесь.</p>
            </div>
          `}
        </section>

        <!-- Block 2: В работе и незаконченные -->
        <section class="dash-section reveal-on-scroll">
          <div class="dash-section-head">
            <div class="dash-section-title">
              <span class="icon-clock-badge">${icon('clock')}</span>
              <strong>В работе и незаконченные</strong>
              <span class="dash-counter">${unfinishedCases.length}</span>
            </div>
          </div>

          <div class="cases-grid">
            ${unfinishedCases.map(c => renderCaseDashboardCard(c, false)).join('')}
          </div>
        </section>
      </div>

      <!-- Right Column: Activity Feed & Report Card -->
      <aside class="dash-right-col">
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

        ${spotlightCase ? `
          <div class="spotlight-card reveal-on-scroll">
            <div class="spotlight-image-wrap">
              <img src="/images/report-showcase.jpg" alt="Эталонный отчёт ООО РусОценка">
              <span class="spotlight-float-badge">${icon('shield-check')} Готовый отчёт ФСО</span>
            </div>
            <div class="spotlight-body">
              <div class="spotlight-title">Дело № ${spotlightCase.number}</div>
              <div class="spotlight-desc">
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
      <!-- Showcase 1: Аналитика цен 1 м² по районам Тольятти -->
      <section class="showcase-panel reveal-on-scroll">
        <div class="panel-head-flex">
          <h3 class="panel-head-title">${icon('building')} Аналитика цен 1 м² по районам Тольятти</h3>
          <span class="badge-status ready">Ноябрь 2026</span>
        </div>

        <div class="analytics-showcase-body">
          <div class="analytics-data-col">
            <div class="district-stat-pills">
              <div class="dstat-chip dstat-chip-blue">
                <span class="dstat-val">54 380 ₽/м²</span>
                <span class="dstat-lbl">Средняя по городу</span>
              </div>
              <div class="dstat-chip">
                <span class="dstat-val">65 566 ₽/м²</span>
                <span class="dstat-lbl">Максимум (Автозаводский)</span>
              </div>
              <div class="dstat-chip dstat-chip-emerald">
                <span class="dstat-val">−6,0%</span>
                <span class="dstat-lbl">Поправка на торг</span>
              </div>
            </div>

            <div class="district-list">
              <div class="district-item">
                <div class="district-head">
                  <span class="district-name"><strong>Автозаводский район</strong> · Новый город</span>
                  <span class="district-price">65 566 ₽/м² <small class="text-green">+4.2%</small></span>
                </div>
                <div class="district-bar-bg">
                  <div class="district-bar-fill" style="width: 94%; background: linear-gradient(90deg, #1d4ed8, #3b82f6, #60a5fa);"></div>
                </div>
              </div>

              <div class="district-item">
                <div class="district-head">
                  <span class="district-name"><strong>Центральный район</strong> · Старый город</span>
                  <span class="district-price">58 900 ₽/м² <small class="text-blue">+1.9%</small></span>
                </div>
                <div class="district-bar-bg">
                  <div class="district-bar-fill" style="width: 84%; background: linear-gradient(90deg, #4f46e5, #6366f1, #818cf8);"></div>
                </div>
              </div>

              <div class="district-item">
                <div class="district-head">
                  <span class="district-name"><strong>Комсомольский район</strong> · Набережная</span>
                  <span class="district-price">52 973 ₽/м² <small class="text-amber">эталон</small></span>
                </div>
                <div class="district-bar-bg">
                  <div class="district-bar-fill" style="width: 75%; background: linear-gradient(90deg, #059669, #10b981, #34d399);"></div>
                </div>
              </div>

              <div class="district-item">
                <div class="district-head">
                  <span class="district-name"><strong>мкрн Поволжский</strong></span>
                  <span class="district-price">50 630 ₽/м² <small class="text-muted">база</small></span>
                </div>
                <div class="district-bar-bg">
                  <div class="district-bar-fill" style="width: 70%; background: linear-gradient(90deg, #3b82f6, #93c5fd);"></div>
                </div>
              </div>
            </div>

            <div class="trend-chart-card">
              <div class="trend-chart-head">
                <span>Индекс средней цены 1 м² (Июн — Ноя 2026)</span>
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
            <img src="/images/togliatti-skyline-widget.jpg" alt="Аналитика районов Тольятти" class="visual-stage-img">
            <div class="district-avg-footer" style="width: 100%; margin-top: 0;">
              <span>Жилой фонд г. Тольятти</span>
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

    <!-- Active Tab Body -->
    ${activeTab === 'object' ? renderTabObject(activeCase) : ''}
    ${activeTab === 'analogs' ? renderTabAnalogs(activeCase, res) : ''}
    ${activeTab === 'calculation' ? renderTabCalculation(activeCase, res) : ''}
    ${activeTab === 'report' ? renderTabReport(activeCase, res) : ''}
  `;
}

/**
 * Вкладка 1: Параметры объекта оценки
 */
function renderTabObject(activeCase) {
  const o = activeCase.objectData;
  return `
    <div class="panel">
      <div class="panel-header">
        <div class="panel-title">
          <h3>Основные параметры объекта оценки</h3>
          <p>Характеристики вносятся на основании Выписки ЕГРН и акта осмотра</p>
        </div>
        <button class="btn btn-primary btn-sm" id="btn-save-obj">${icon('check')} Сохранить объект</button>
      </div>

      <form id="form-case-object">
        <div class="form-grid-3">
          <div class="form-field">
            <label>Номер отчёта / дела <span class="badge-auto">🤖 Шаблон</span></label>
            <input type="text" name="reportNumber" value="${o.reportNumber}" required>
          </div>
          <div class="form-field">
            <label>Кадастровый номер <span class="badge-auto">🤖 Из ЕГРН</span></label>
            <input type="text" name="cadastralNumber" value="${o.cadastralNumber}" required>
          </div>
          <div class="form-field">
            <label>Дата оценки <span class="badge-auto">🤖 Авто</span></label>
            <input type="date" name="valuationDate" value="${o.valuationDate}" required>
          </div>
        </div>

        <div class="form-field">
          <label>Полный адрес объекта оценки <span class="badge-auto">🤖 Из ЕГРН / Шаблона</span></label>
          <input type="text" name="address" value="${o.address}" required>
        </div>

        <div class="form-grid-3">
          <div class="form-field">
            <label>Общая площадь (кв.м) <span class="badge-auto">🤖 Из ЕГРН</span></label>
            <input type="number" step="0.1" name="area" value="${o.area}" required>
          </div>
          <div class="form-field">
            <label>Этаж расположения <span class="badge-auto">🤖 Из ЕГРН</span></label>
            <input type="number" name="floor" value="${o.floor}" required>
          </div>
          <div class="form-field">
            <label>Этажность дома <span class="badge-auto">🤖 Из ГИС ЖКХ</span></label>
            <input type="number" name="totalFloors" value="${o.totalFloors}" required>
          </div>
        </div>

        <div class="form-grid-3">
          <div class="form-field">
            <label>Тип отделки <span class="badge-manual">👤 Оценщик (осмотр)</span></label>
            <select name="finish">
              <option value="улучшенная" ${o.finish === 'улучшенная' ? 'selected' : ''}>Улучшенная</option>
              <option value="простая" ${o.finish === 'простая' ? 'selected' : ''}>Простая</option>
            </select>
          </div>
          <div class="form-field">
            <label>Материал стен дома <span class="badge-auto">🤖 Из ГИС ЖКХ</span></label>
            <select name="wallMaterial">
              <option value="панель" ${o.wallMaterial === 'панель' ? 'selected' : ''}>Панель</option>
              <option value="кирпич" ${o.wallMaterial === 'кирпич' ? 'selected' : ''}>Кирпич</option>
              <option value="монолит" ${o.wallMaterial === 'монолит' ? 'selected' : ''}>Монолит</option>
            </select>
          </div>
          <div class="form-field">
            <label>Техническое состояние <span class="badge-manual">👤 Оценщик (осмотр)</span></label>
            <select name="condition">
              <option value="хорошее" ${o.condition === 'хорошее' ? 'selected' : ''}>Хорошее</option>
              <option value="отличное" ${o.condition === 'отличное' ? 'selected' : ''}>Отличное</option>
              <option value="требует ремонта" ${o.condition === 'требует ремонта' ? 'selected' : ''}>Требует ремонта</option>
            </select>
          </div>
        </div>

        <div class="form-grid-2">
          <div class="form-field">
            <label>Заказчик оценки <span class="badge-auto">🤖 Из договора</span></label>
            <input type="text" name="client" value="${o.client}" required>
          </div>
          <div class="form-field">
            <label>Цель оценки <span class="badge-auto">🤖 Шаблон</span></label>
            <input type="text" name="purpose" value="${o.purpose}">
          </div>
        </div>
      </form>
    </div>

    <!-- Shares Block -->
    <div class="panel">
      <div class="panel-header">
        <div class="panel-title">
          <h3>Долевая собственность на объект</h3>
          <p>Сведения о правообладателях и размерах долей из ЕГРН</p>
        </div>
        <button class="btn btn-secondary btn-sm" id="btn-add-share">${icon('plus')} Добавить собственника</button>
      </div>

      <div style="display: grid; gap: 10px;">
        ${(o.shares || []).map((s, idx) => `
          <div style="display: flex; align-items: center; gap: 12px; background: #f8fafc; border: 1px solid var(--border); padding: 10px 14px; border-radius: 6px;">
            <span style="font-size: 12px; font-weight: 700; color: var(--text-muted); width: 20px;">#${idx+1}</span>
            <input type="text" data-share-holder="${idx}" value="${s.holder}" placeholder="ФИО собственника" style="flex: 1; padding: 6px 10px; border: 1px solid var(--border); border-radius: 4px; font-size: 13px;">
            <span style="font-size: 12px; color: var(--text-muted);">Доля:</span>
            <input type="number" data-share-num="${idx}" value="${s.num}" style="width: 70px; padding: 6px; border: 1px solid var(--border); border-radius: 4px; font-size: 13px;" title="Числитель доли">
            <span>/</span>
            <input type="number" data-share-den="${idx}" value="${s.den}" style="width: 70px; padding: 6px; border: 1px solid var(--border); border-radius: 4px; font-size: 13px;" title="Знаменатель доли">
            <button class="btn btn-danger btn-sm" data-action="delete-share" data-index="${idx}" title="Удалить долю">${icon('trash-2')}</button>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

/**
 * Вкладка 2: Таблица аналогов и поправок (Таблица 12.2)
 */
function renderTabAnalogs(activeCase, res) {
  const o = activeCase.objectData;
  return `
    <div class="panel">
      <div class="panel-header">
        <div class="panel-title">
          <h3>Подбор аналогов и матрица корректировок</h3>
          <p>Таблица 12.2 отчёта: сравнительный подход к оценке рыночной стоимости</p>
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
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

      <div class="banner-calc-info">
        <span style="font-size: 16px;">💡</span>
        <div>
          <strong>Разделение труда по ФСО:</strong>
          <span>🤖 <b>Робот</b> по утвержденным формулам считает скидку на торг, поправки Лейфера (этаж, площадь, отделка), скорректированную стоимость и весовые коэффициенты $w_i$.</span>
          <span style="margin-left: 8px;">👤 <b>Оценщик</b> отбирает 3–5 проверенных аналогов из открытых источников и подтверждает класс отделки по осмотру.</span>
        </div>
      </div>

      <div class="table-wrap">
        <table class="calc-table">
          <thead>
            <tr>
              <th style="width: 36px;"><span class="sr-only">Выбор</span></th>
              <th>Предложение и адрес</th>
              <th>Цена предложения</th>
              <th>Торг</th>
              <th>Отделка</th>
              <th>Этаж</th>
              <th>Масштаб</th>
              <th>Скоррект. 1 м²</th>
              <th>Число поправок (Ki)</th>
              <th>Вес в итоге</th>
              <th style="width: 40px;"></th>
            </tr>
          </thead>
          <tbody>
            ${activeCase.analogs.map((a, idx) => {
              const row = res.rows.find(r => r.id === a.id);
              const isSelected = a.selected;
              const rawPerSqm = Math.round(a.price / a.area);
              return `
                <tr class="${isSelected ? 'active-row' : 'inactive-row'}">
                  <td>
                    <input type="checkbox" data-analog-toggle="${a.id}" ${isSelected ? 'checked' : ''} title="Включить аналог в расчёт">
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
                        <span>·</span>
                        <a class="analog-link" href="${a.url || '#'}" target="_blank" rel="noopener noreferrer">${a.source || 'Источник'} ${icon('external-link')}</a>
                      </div>
                    </div>
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
                  <td class="price-cell" style="color: var(--primary);">
                    ${isSelected && row ? moneyPerSqm(row.finalAdjustedPrice) : '—'}
                  </td>
                  <td style="text-align: center;">
                    <b>${isSelected && row ? row.correctionsCount : '—'}</b>
                  </td>
                  <td>
                    ${isSelected && row ? `
                      <div class="weight-bar-wrap">
                        <div class="weight-track"><div class="weight-fill" style="width: ${row.weight * 100 * 3}%;"></div></div>
                        <span class="weight-label">${weightFmt(row.weight)}</span>
                      </div>
                    ` : '<span style="color: var(--text-dim);">0%</span>'}
                  </td>
                  <td>
                    <button class="btn btn-danger btn-sm" data-action="delete-analog" data-id="${a.id}" title="Удалить аналог">${icon('x')}</button>
                  </td>
                </tr>
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
        <!-- Large Action Button -->
        <button class="btn btn-primary" id="btn-export-word-sidebar" style="width: 100%; justify-content: center; padding: 13px; font-size: 14px; font-weight: 700; gap: 10px; box-shadow: 0 2px 8px rgba(30, 64, 175, 0.25);">
          ${icon('download')} Скачать официальный Word (.docx)
        </button>

        <!-- Audit Card 1: Робот сделал за вас -->
        <div class="audit-card robot">
          <div class="audit-head">
            ${icon('check-circle')} 🤖 Заполнено программой по шаблону (100%)
          </div>
          <ul class="audit-list">
            <li>${icon('check')} Подставлены реквизиты объекта, адрес, кадастровый номер и заказчик</li>
            <li>${icon('check')} Все нормативные разделы по 135-ФЗ, ФСО I-VI №200 и ФСО №7</li>
            <li>${icon('check')} Методологическое обоснование отказа от затратного и доходного подходов</li>
            <li>${icon('check')} Матрица корректировок Лейфера (скидка на торг, этаж, площадь, отделка)</li>
            <li>${icon('check')} Алгоритмический расчет обратных весов каждого аналога</li>
            <li>${icon('check')} Статистический контроль выборки (V = 4,09% ≤ 33,0% — соблюден)</li>
            <li>${icon('check')} Расчет итоговой рыночной стоимости полного права и долей</li>
            <li>${icon('check')} Формирование суммы прописью на русском языке</li>
          </ul>
        </div>

        <!-- Audit Card 2: Зона ответственности человека -->
        <div class="audit-card human">
          <div class="audit-head">
            ${icon('alert-circle')} 👤 Зона ответственности оценщика (Человек)
          </div>
          <ul class="audit-list">
            <li><b>1. Проверка аналогов:</b> подтвердить отсутствие дублей риелторов на Авито/Циан.</li>
            <li><b>2. Сверка отделки:</b> сверить состояние с актом натурного визуального осмотра.</li>
            <li><b>3. Фототаблица:</b> вставить фотографии осмотра квартиры в Приложение №4.</li>
            <li><b>4. Юридическая подпись:</b> заверить отчет личной ЭЦП оценщика (ст. 15 135-ФЗ).</li>
          </ul>
        </div>

        <!-- Checklist -->
        <div class="panel" style="margin: 0; padding: 16px 18px;">
          <div style="font-size: 13px; font-weight: 700; color: var(--text-dark); margin-bottom: 10px;">
            Чек-лист готовности дела к выпуску
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px; font-size: 12.5px;">
            <div style="display: flex; align-items: center; gap: 8px; color: var(--green);">
              ${icon('check-circle')} <span>Параметры объекта проверены</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; color: ${res.selectedCount >= 3 ? 'var(--green)' : 'var(--amber)'};">
              ${icon(res.selectedCount >= 3 ? 'check-circle' : 'alert-circle')} <span>Отобрано ${res.selectedCount} аналогов (минимум 3)</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; color: ${res.variationPass ? 'var(--green)' : 'var(--amber)'};">
              ${icon(res.variationPass ? 'check-circle' : 'alert-circle')} <span>Выборка однородна (V ≤ 33,0%)</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; color: var(--green);">
              ${icon('check-circle')} <span>Сумма долей совпадает с итогом на 100%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Обработчики событий UI
 */
function bindEvents() {
  // Navigation: Sidebar items
  document.querySelectorAll('[data-nav]').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.nav;
      if (target === 'dashboard') {
        currentView = 'dashboard';
      } else {
        currentView = 'cabinet';
        if (target === 'all-cases') filterStatus = 'all';
        if (target === 'in-progress') filterStatus = 'В работе';
        if (target === 'ready') filterStatus = 'Готов';
      }
      render();
    });
  });

  // Breadcrumbs navigation
  document.getElementById('crumb-dashboard')?.addEventListener('click', e => {
    e.preventDefault();
    currentView = 'dashboard';
    render();
  });
  document.getElementById('crumb-cabinet')?.addEventListener('click', e => {
    e.preventDefault();
    currentView = 'cabinet';
    render();
  });

  // Open case tab
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      currentView = 'case';
      activeTab = btn.dataset.tab;
      render();
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
        activeCaseId = id;
        setActiveCaseId(id);
        currentView = 'case';
        activeTab = 'analogs';
        render();
      } else if (action === 'continue-case') {
        activeCaseId = id;
        setActiveCaseId(id);
        currentView = 'case';
        const c = findCaseById(cases, id);
        activeTab = (c && c.status === 'Черновик' && c.analogs.length === 0) ? 'analogs' : 'analogs';
        render();
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

  // Toggle analog checkbox
  document.querySelectorAll('[data-analog-toggle]').forEach(cb => {
    cb.addEventListener('change', e => {
      const id = e.target.dataset.analogToggle;
      const c = getActiveCase();
      if (c) {
        const item = c.analogs.find(a => a.id === id);
        if (item) {
          item.selected = e.target.checked;
          cases = updateCase(cases, c);
          render();
        }
      }
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

  // Add share button
  document.getElementById('btn-add-share')?.addEventListener('click', () => {
    const c = getActiveCase();
    if (c) {
      if (!c.objectData.shares) c.objectData.shares = [];
      c.objectData.shares.push({
        id: 's_' + Date.now(),
        holder: 'Новый собственник',
        num: 1,
        den: 2,
      });
      cases = updateCase(cases, c);
      render();
      toast('Доля добавлена');
    }
  });

  // Delete share button
  document.querySelectorAll('[data-action="delete-share"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index);
      const c = getActiveCase();
      if (c && c.objectData.shares) {
        c.objectData.shares.splice(idx, 1);
        cases = updateCase(cases, c);
        render();
        toast('Доля удалена');
      }
    });
  });

  // Live edit shares
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
        c.objectData.shares[idx].num = parseInt(e.target.value) || 1;
        cases = updateCase(cases, c);
        render();
      }
    });
  });
  document.querySelectorAll('[data-share-den]').forEach(inp => {
    inp.addEventListener('change', e => {
      const idx = parseInt(e.target.dataset.shareDen);
      const c = getActiveCase();
      if (c && c.objectData.shares[idx]) {
        c.objectData.shares[idx].den = parseInt(e.target.value) || 1;
        cases = updateCase(cases, c);
        render();
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
        <label>Адрес объекта (г. Тольятти)</label>
        <input type="text" name="address" placeholder="г. Тольятти, Автозаводский район, ул. ..." required>
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
          Загрузить типовую выборку реальных аналогов г. Тольятти
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
        <label>Адрес предложения (г. Тольятти)</label>
        <input type="text" name="address" placeholder="г. Тольятти, ул. ..." required>
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
      <div class="form-group">
        <label>Ссылка на объявление (Авито / Циан)</label>
        <input type="url" name="url" placeholder="https://avito.ru/...">
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
      source: 'Ручной ввод',
      url: fd.get('url') || '',
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
