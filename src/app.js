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
} from './storage.js';
import { exportApartmentReport } from './report.js';
import '@fontsource-variable/onest';
import './styles.css';

// State
let cases = getStoredCases();
let activeCaseId = getActiveCaseId() || (cases[0] ? cases[0].id : null);
let currentView = activeCaseId ? 'case' : 'cabinet'; // 'cabinet' | 'case'
let activeTab = 'analogs'; // 'object' | 'analogs' | 'calculation' | 'report'
let filterStatus = 'all';
let searchQuery = '';

const icon = name => `<i data-lucide="${name}"></i>`;

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
        <div class="nav-section-title"><span class="nav-label">Рабочее пространство</span></div>
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
          <div class="nav-section-title" style="margin-top: 14px;"><span class="nav-label">Активное дело</span></div>
          <div class="active-case-menu">
            <div class="active-case-label">
              <span class="nav-label">№ ${activeCase.number}</span>
              <span class="badge-status ${activeCase.status === 'Готов' ? 'ready' : (activeCase.status === 'В работе' ? 'in-progress' : 'draft')} nav-label">${activeCase.status}</span>
            </div>
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
          </div>
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
            <a href="#" id="crumb-cabinet">Личный кабинет</a>
            ${currentView === 'case' && activeCase ? `
              <span>/</span>
              <strong>Дело № ${activeCase.number}</strong>
              <span>(${activeCase.objectData.rooms}-к. кв., ${sqm(activeCase.objectData.area)})</span>
            ` : ''}
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
          `}
        </div>
      </header>

      <!-- View Content -->
      <main class="page-container">
        ${currentView === 'cabinet' ? renderCabinetView() : renderCaseWorkspaceView(activeCase)}
      </main>
    </div>

    <div id="toast" role="status" aria-live="polite"></div>
    <dialog id="modal-dialog"></dialog>
  `;

  createIcons({ icons });
  bindEvents();
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
      ${filtered.length ? filtered.map(c => {
        const res = calculateValuation(c.objectData, c.analogs, c.objectData.tradeAdjustment);
        const statusClass = c.status === 'Готов' ? 'ready' : (c.status === 'В работе' ? 'in-progress' : 'draft');
        return `
          <div class="case-card">
            <div>
              <div class="case-header-row">
                <span class="case-num">ДЕЛО № ${c.number}</span>
                <span class="badge-status ${statusClass}">${c.status}</span>
                <span style="font-size: 12px; color: var(--text-dim);">Дата оценки: ${c.objectData.valuationDate}</span>
              </div>
              <div class="case-addr">${c.objectData.address}</div>
              <div class="case-sub-meta">
                <span>${icon('user')} Заказчик: <b>${c.objectData.client}</b></span>
                <span>${icon('maximize')} Площадь: <b>${sqm(c.objectData.area)}</b></span>
                <span>${icon('building')} Этаж: <b>${c.objectData.floor}/${c.objectData.totalFloors}</b></span>
                <span>${icon('layers')} Аналогов в расчёте: <b>${res.selectedCount} из ${c.analogs.length}</b></span>
              </div>
            </div>

            <div class="case-right-meta">
              <div>
                <div class="case-val-amount">${res.total ? money(res.total) : 'Не рассчитано'}</div>
                <div class="case-val-sub">${res.pricePerSqm ? moneyPerSqm(res.pricePerSqm) : 'требуются аналоги'}</div>
              </div>
              <div class="case-actions">
                <button class="btn btn-secondary btn-sm" data-action="export-word" data-id="${c.id}" title="Скачать Word (.docx)">
                  ${icon('file-text')} Word
                </button>
                <button class="btn btn-danger btn-sm" data-action="delete-case" data-id="${c.id}" title="Удалить дело">
                  ${icon('trash-2')}
                </button>
                <button class="btn btn-primary btn-sm" data-action="open-case" data-id="${c.id}">
                  ${icon('arrow-right')} Открыть
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('') : `
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
            <label>Номер отчёта / дела</label>
            <input type="text" name="reportNumber" value="${o.reportNumber}" required>
          </div>
          <div class="form-field">
            <label>Кадастровый номер</label>
            <input type="text" name="cadastralNumber" value="${o.cadastralNumber}" required>
          </div>
          <div class="form-field">
            <label>Дата оценки</label>
            <input type="date" name="valuationDate" value="${o.valuationDate}" required>
          </div>
        </div>

        <div class="form-field">
          <label>Полный адрес объекта оценки</label>
          <input type="text" name="address" value="${o.address}" required>
        </div>

        <div class="form-grid-3">
          <div class="form-field">
            <label>Общая площадь (кв.м)</label>
            <input type="number" step="0.1" name="area" value="${o.area}" required>
          </div>
          <div class="form-field">
            <label>Этаж расположения</label>
            <input type="number" name="floor" value="${o.floor}" required>
          </div>
          <div class="form-field">
            <label>Этажность дома</label>
            <input type="number" name="totalFloors" value="${o.totalFloors}" required>
          </div>
        </div>

        <div class="form-grid-3">
          <div class="form-field">
            <label>Тип отделки</label>
            <select name="finish">
              <option value="улучшенная" ${o.finish === 'улучшенная' ? 'selected' : ''}>Улучшенная</option>
              <option value="простая" ${o.finish === 'простая' ? 'selected' : ''}>Простая</option>
            </select>
          </div>
          <div class="form-field">
            <label>Материал стен дома</label>
            <select name="wallMaterial">
              <option value="панель" ${o.wallMaterial === 'панель' ? 'selected' : ''}>Панель</option>
              <option value="кирпич" ${o.wallMaterial === 'кирпич' ? 'selected' : ''}>Кирпич</option>
              <option value="монолит" ${o.wallMaterial === 'монолит' ? 'selected' : ''}>Монолит</option>
            </select>
          </div>
          <div class="form-field">
            <label>Техническое состояние</label>
            <select name="condition">
              <option value="хорошее" ${o.condition === 'хорошее' ? 'selected' : ''}>Хорошее</option>
              <option value="отличное" ${o.condition === 'отличное' ? 'selected' : ''}>Отличное</option>
              <option value="требует ремонта" ${o.condition === 'требует ремонта' ? 'selected' : ''}>Требует ремонта</option>
            </select>
          </div>
        </div>

        <div class="form-grid-2">
          <div class="form-field">
            <label>Заказчик оценки</label>
            <input type="text" name="client" value="${o.client}" required>
          </div>
          <div class="form-field">
            <label>Цель оценки</label>
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
    <div style="display: grid; grid-template-columns: 1fr 340px; gap: 24px; align-items: start;">
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">
            <h3>Превью структуры отчёта № ${o.reportNumber}</h3>
            <p>Документ готов к выгрузке по официальному стандарту ООО «РусОценка»</p>
          </div>
          <button class="btn btn-primary btn-sm" id="btn-export-word-tab">
            ${icon('download')} Скачать Word (.docx)
          </button>
        </div>

        <div style="background: #f8fafc; border: 1px solid var(--border); border-radius: 8px; padding: 24px; font-size: 13px; line-height: 1.6;">
          <div style="text-align: right; font-size: 12px; color: var(--text-muted); margin-bottom: 20px;">
            <strong>УТВЕРЖДАЮ</strong><br>
            Директор ООО «РусОценка»<br>
            ___________ А.А. Орлова
          </div>

          <h3 style="font-size: 17px; font-weight: 700; color: var(--primary); margin-bottom: 8px;">
            ОТЧЕТ ОБ ОЦЕНКЕ № ${o.reportNumber}
          </h3>
          <p style="margin-bottom: 12px;">
            Объект: ${o.propertyType}, кадастровый номер ${o.cadastralNumber}, площадь ${sqm(o.area)}, адрес: ${o.address}
          </p>

          <div style="border-top: 1px solid var(--border); padding-top: 12px; margin-top: 12px;">
            <strong>Итоговая величина рыночной стоимости:</strong>
            <span style="font-size: 18px; font-weight: 700; color: var(--primary); margin-left: 8px;">${money(res.total)}</span>
          </div>

          <div style="margin-top: 16px; font-size: 12px; color: var(--text-muted);">
            Включает: Раздел 12 (Метод сравнения продаж), Таблицу 12.2 (Матрица корректировок и взвешивания), Таблицу 22 (Контроль выборки), Таблицу 12.5 (Расчёт долей).
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">
            <h3>Чек-лист готовности</h3>
          </div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 10px; font-size: 13px;">
          <div style="display: flex; align-items: center; gap: 8px; color: var(--green);">
            ${icon('check-circle')} <span>Объект оценки заполнен</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px; color: ${res.selectedCount >= 3 ? 'var(--green)' : 'var(--amber)'};">
            ${icon(res.selectedCount >= 3 ? 'check-circle' : 'alert-circle')} <span>Выбрано ${res.selectedCount} аналогов (мин. 3)</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px; color: ${res.variationPass ? 'var(--green)' : 'var(--amber)'};">
            ${icon(res.variationPass ? 'check-circle' : 'alert-circle')} <span>Вариация V ≤ 33%</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px; color: var(--green);">
            ${icon('check-circle')} <span>Доли сходятся на 100%</span>
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
      currentView = 'cabinet';
      if (target === 'all-cases') filterStatus = 'all';
      if (target === 'in-progress') filterStatus = 'В работе';
      if (target === 'ready') filterStatus = 'Готов';
      render();
    });
  });

  // Breadcrumbs to cabinet
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

  // Case card actions (open, delete, export)
  document.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', async e => {
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      if (action === 'open-case') {
        activeCaseId = id;
        setActiveCaseId(id);
        currentView = 'case';
        activeTab = 'analogs';
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
          try {
            await exportApartmentReport(c.objectData, c.analogs);
            toast('Отчёт сформирован и передан для скачивания');
          } catch (err) {
            console.error(err);
            toast('Ошибка при формировании отчёта Word');
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
  document.getElementById('btn-top-word')?.addEventListener('click', async () => {
    const c = getActiveCase();
    if (c) {
      await exportApartmentReport(c.objectData, c.analogs);
      toast('Отчёт Word скачивается...');
    }
  });
  document.getElementById('btn-export-word-tab')?.addEventListener('click', async () => {
    const c = getActiveCase();
    if (c) {
      await exportApartmentReport(c.objectData, c.analogs);
      toast('Отчёт Word скачивается...');
    }
  });

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
      <button class="btn btn-secondary btn-sm" id="modal-close">${icon('x')}</button>
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
          <div style="display: flex; gap: 8px;">
            <input type="number" name="floor" placeholder="Этаж" value="4" required style="flex: 1;">
            <input type="number" name="totalFloors" placeholder="Всего" value="9" required style="flex: 1;">
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

      <div style="background: #f8fafc; border: 1px solid var(--border); border-radius: 6px; padding: 10px 12px; font-size: 12px; color: var(--text-muted); display: flex; align-items: center; gap: 8px;">
        <input type="checkbox" id="check-include-sample-analogs" checked style="width: 16px; height: 16px;">
        <label for="check-include-sample-analogs" style="cursor: pointer;">
          Загрузить типовую выборку реальных аналогов г. Тольятти для быстрого старта
        </label>
      </div>

      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" id="modal-cancel">Отмена</button>
        <button type="submit" class="btn btn-primary">Создать дело и открыть</button>
      </div>
    </form>
  `;
  createIcons({ icons });
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
      <button class="btn btn-secondary btn-sm" id="modal-close">${icon('x')}</button>
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
          <div style="display: flex; gap: 8px;">
            <input type="number" name="floor" placeholder="Этаж" value="3" required style="flex: 1;">
            <input type="number" name="totalFloors" placeholder="Всего" value="5" required style="flex: 1;">
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
  createIcons({ icons });
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
