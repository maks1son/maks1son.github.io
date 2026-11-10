import { createIcons, icons } from 'lucide';
import {
  defaultObject,
  defaultAnalogs,
  calculateValuation,
  money,
  moneyPerSqm,
  sqm,
  percent,
  weightFmt,
} from './model.js';
import { exportApartmentReport } from './report.js';
import '@fontsource-variable/onest';
import './styles.css';

// Storage keys
const STORAGE_KEY_OBJ = 'rosocenka_apartment_obj_v1';
const STORAGE_KEY_ANAL = 'rosocenka_apartment_analogs_v1';

let objectData = loadObject();
let analogs = loadAnalogs();

function loadObject() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_OBJ);
    if (raw) return JSON.parse(raw);
  } catch {}
  return defaultObject();
}

function loadAnalogs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ANAL);
    if (raw) return JSON.parse(raw);
  } catch {}
  return defaultAnalogs();
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY_OBJ, JSON.stringify(objectData));
    localStorage.setItem(STORAGE_KEY_ANAL, JSON.stringify(analogs));
  } catch {}
}

function resetToDefault() {
  objectData = defaultObject();
  analogs = defaultAnalogs();
  saveState();
  render();
  toast('Данные сброшены к образцу из отчёта Анны');
}

function toast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('visible');
  setTimeout(() => el.classList.remove('visible'), 3500);
}

const icon = name => `<i data-lucide="${name}"></i>`;

function render() {
  const result = calculateValuation(objectData, analogs, objectData.tradeAdjustment);

  const app = document.getElementById('app');
  app.innerHTML = `
    <header class="app-header">
      <div class="brand-group">
        <img class="brand-emblem" src="/images/rosocenka-emblem.png" alt="РусОценка">
        <div class="brand-text">
          <h1>РУСОЦЕНКА <span class="brand-badge">Дело № ${objectData.reportNumber}</span></h1>
          <span class="brand-sub">Автоматизированное рабочее место оценщика · Жилая недвижимость</span>
        </div>
      </div>
      <div class="header-actions">
        <button class="btn btn-secondary btn-sm" id="btn-reset" title="Сбросить к исходному делу Анны">
          ${icon('rotate-ccw')} Исходные данные
        </button>
        <button class="btn btn-secondary btn-sm" id="btn-print">
          ${icon('printer')} Печать / PDF
        </button>
        <button class="btn btn-primary btn-sm" id="btn-export-word">
          ${icon('file-text')} Экспорт в Word (.docx)
        </button>
      </div>
    </header>

    <main class="app-container">
      <!-- Hero / Case Bar -->
      <section class="case-hero">
        <div class="case-info">
          <div class="case-meta-row">
            <span class="case-tag">ОБЪЕКТ ОЦЕНКИ</span>
            <span>Кадастровый номер: <b>${objectData.cadastralNumber}</b></span>
            <span>Дата оценки: <b>${objectData.valuationDate} г.</b></span>
          </div>
          <div class="case-address">${objectData.address}</div>
          <div class="case-details-pills">
            <span class="spec-pill">Площадь: <b>${sqm(objectData.area)}</b></span>
            <span class="spec-pill">Этаж: <b>${objectData.floor} из ${objectData.totalFloors} (средний)</b></span>
            <span class="spec-pill">Стены: <b>${objectData.wallMaterial}</b></span>
            <span class="spec-pill">Отделка: <b>${objectData.finish}</b></span>
            <span class="spec-pill">Состояние: <b>${objectData.condition}</b></span>
            <span class="spec-pill">Балкон: <b>${objectData.balcony}</b></span>
            <button class="btn btn-secondary btn-sm" id="btn-edit-obj" style="margin-left: 6px; padding: 2px 8px; font-size: 11px;">
              ${icon('pencil')} Изменить параметры
            </button>
          </div>
        </div>

        <div class="valuation-metric-card">
          <span class="metric-label">Рыночная стоимость (100% доля)</span>
          <div class="metric-value">${money(result.total)}</div>
          <div class="metric-sub">
            <span>${moneyPerSqm(result.pricePerSqm)}</span>
            <span>·</span>
            <span>${result.selectedCount} из ${analogs.length} аналогов</span>
          </div>
        </div>
      </section>

      <!-- Main Workspace Grid -->
      <div class="work-layout">
        <div class="primary-col">
          <!-- Table 12.2: Comparative Matrix -->
          <section class="panel">
            <div class="panel-header">
              <div class="panel-title">
                <h2>Матрица корректировок аналогов</h2>
                <span class="badge">Таблица 12.2 отчёта</span>
              </div>
              <div class="panel-controls">
                <div class="trade-bar" title="Общая скидка на торг для всех предложений рынка">
                  <label for="trade-slider">Торг:</label>
                  <input type="range" id="trade-slider" min="-15" max="0" step="0.5" value="${objectData.tradeAdjustment}">
                  <output id="trade-val">${percent(objectData.tradeAdjustment)}</output>
                </div>
                <button class="btn btn-secondary btn-sm" id="btn-add-analog">
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
                    <th>Поправки</th>
                    <th>Вес в итоге</th>
                  </tr>
                </thead>
                <tbody>
                  ${analogs.map((a, idx) => {
                    const row = result.rows.find(r => r.id === a.id);
                    const isSelected = a.selected;
                    const pricePerSqmRaw = Math.round(a.price / a.area);
                    return `
                      <tr class="${isSelected ? 'active-row' : 'inactive-row'}">
                        <td>
                          <input type="checkbox" data-toggle="${a.id}" ${isSelected ? 'checked' : ''} aria-label="Включить в расчёт аналог №${idx+1}">
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
                              <a class="analog-link" href="${a.url}" target="_blank" rel="noopener noreferrer">${a.source} ${icon('external-link')}</a>
                            </div>
                          </div>
                        </td>
                        <td class="price-cell">
                          ${money(a.price)}
                          <span class="price-sub">${moneyPerSqm(pricePerSqmRaw)}</span>
                        </td>
                        <td>
                          <span class="adj-chip neg">${percent(objectData.tradeAdjustment)}</span>
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
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </section>

          <!-- Table 12.5: Shares Calculation -->
          <section class="panel">
            <div class="panel-header">
              <div class="panel-title">
                <h2>Распределение рыночной стоимости по долям</h2>
                <span class="badge">Таблица 12.5 отчёта</span>
              </div>
              <span style="font-size: 12px; color: var(--text-muted);">Без скидки на долевой характер (единая реализация 100% объекта)</span>
            </div>

            <div class="shares-grid">
              ${result.shares.map(s => `
                <div class="share-card">
                  <div>
                    <div class="share-name">${s.holder}</div>
                    <div class="share-frac">Доля: <b>${s.shareFraction}</b> (${s.percentOfTotal}%)</div>
                  </div>
                  <div class="share-money">
                    ${money(s.rounded)}
                    <small>номинал: ${money(s.nominal)}</small>
                  </div>
                </div>
              `).join('')}
            </div>
          </section>
        </div>

        <!-- Sidebar Inspector -->
        <aside class="sidebar-col">
          <!-- Quality / Variation Stats Card -->
          <div class="side-card">
            <h3>Контроль выборки <span class="badge">Таблица 22</span></h3>
            <div class="stat-item">
              <span>Число аналогов в расчёте</span>
              <b>${result.selectedCount} из ${analogs.length}</b>
            </div>
            <div class="stat-item">
              <span>Среднее по выборке (Pср)</span>
              <b>${moneyPerSqm(result.meanPrice)}</b>
            </div>
            <div class="stat-item">
              <span>Стандартное отклонение (σ)</span>
              <b>±${money(result.stdDev).replace(' ₽', '')} ₽/м²</b>
            </div>
            <div class="stat-item">
              <span>Коэффициент вариации (V)</span>
              <b>${result.variationCoeff != null ? result.variationCoeff.toFixed(2) + '%' : '—'}</b>
            </div>
            <div style="margin-top: 14px;">
              ${result.variationPass ? `
                <div class="status-badge ok">
                  ${icon('check-circle')} Допуск соблюдён (V ≤ 33%)
                </div>
              ` : `
                <div class="status-badge warn">
                  ${icon('alert-triangle')} Внимание: V > 33% (выборка неоднородна)
                </div>
              `}
            </div>
          </div>

          <!-- Methodology Box -->
          <div class="side-card">
            <h3>Методика расчёта</h3>
            <div class="formula-box">
              <strong>Формула весового коэффициента:</strong>
              <code>Вес = (ΣK - Ki) / (ΣK × (N - 1))</code>
              <p>Чем меньше поправок внесено в аналог, тем больше его удельный вес при согласовании стоимости.</p>
              
              <div style="margin-top: 10px; border-top: 1px solid var(--border); padding-top: 8px;">
                <strong>Нормативная база:</strong>
                <p>135-ФЗ «Об оценочной деятельности в РФ», ФСО I-VI №200, ФСО №7 («Оценка недвижимости»), «Справочник оценщика» под ред. Лейфера Л.А.</p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>

    <div id="toast" role="status" aria-live="polite"></div>
    <dialog id="modal-dialog"></dialog>
  `;

  createIcons({ icons });
  bindEvents();
}

function bindEvents() {
  // Trade slider
  const slider = document.getElementById('trade-slider');
  if (slider) {
    slider.addEventListener('input', e => {
      objectData.tradeAdjustment = parseFloat(e.target.value);
      saveState();
      render();
    });
  }

  // Toggling analogs
  document.querySelectorAll('[data-toggle]').forEach(cb => {
    cb.addEventListener('change', e => {
      const id = e.target.dataset.toggle;
      const item = analogs.find(a => a.id === id);
      if (item) {
        item.selected = e.target.checked;
        saveState();
        render();
      }
    });
  });

  // Reset
  document.getElementById('btn-reset')?.addEventListener('click', resetToDefault);

  // Print
  document.getElementById('btn-print')?.addEventListener('click', () => window.print());

  // Export Word
  document.getElementById('btn-export-word')?.addEventListener('click', async () => {
    try {
      await exportApartmentReport(objectData, analogs);
      toast('Отчёт сформирован и передан браузеру для скачивания');
    } catch (err) {
      console.error(err);
      toast('Ошибка при формировании отчёта Word');
    }
  });

  // Edit Object Modal
  document.getElementById('btn-edit-obj')?.addEventListener('click', openEditObjectModal);

  // Add Analog Modal
  document.getElementById('btn-add-analog')?.addEventListener('click', openAddAnalogModal);
}

function openEditObjectModal() {
  const dialog = document.getElementById('modal-dialog');
  dialog.innerHTML = `
    <div class="modal-header">
      <h3>Параметры объекта оценки</h3>
      <button class="btn btn-secondary btn-sm" id="modal-close">${icon('x')}</button>
    </div>
    <form id="form-edit-obj" class="modal-form">
      <div class="form-group">
        <label>Адрес объекта</label>
        <input type="text" name="address" value="${objectData.address}" required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Кадастровый номер</label>
          <input type="text" name="cadastralNumber" value="${objectData.cadastralNumber}" required>
        </div>
        <div class="form-group">
          <label>Общая площадь (м²)</label>
          <input type="number" step="0.1" name="area" value="${objectData.area}" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Этаж</label>
          <input type="number" name="floor" value="${objectData.floor}" required>
        </div>
        <div class="form-group">
          <label>Всего этажей</label>
          <input type="number" name="totalFloors" value="${objectData.totalFloors}" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Отделка</label>
          <select name="finish">
            <option value="улучшенная" ${objectData.finish === 'улучшенная' ? 'selected' : ''}>Улучшенная</option>
            <option value="простая" ${objectData.finish === 'простая' ? 'selected' : ''}>Простая</option>
          </select>
        </div>
        <div class="form-group">
          <label>Материал стен</label>
          <select name="wallMaterial">
            <option value="панель" ${objectData.wallMaterial === 'панель' ? 'selected' : ''}>Панель</option>
            <option value="кирпич" ${objectData.wallMaterial === 'кирпич' ? 'selected' : ''}>Кирпич</option>
            <option value="монолит" ${objectData.wallMaterial === 'монолит' ? 'selected' : ''}>Монолит</option>
          </select>
        </div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" id="modal-cancel">Отмена</button>
        <button type="submit" class="btn btn-primary">Сохранить изменения</button>
      </div>
    </form>
  `;
  createIcons({ icons });
  dialog.showModal();

  dialog.querySelector('#modal-close').onclick = () => dialog.close();
  dialog.querySelector('#modal-cancel').onclick = () => dialog.close();
  dialog.querySelector('#form-edit-obj').onsubmit = e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    objectData.address = fd.get('address');
    objectData.cadastralNumber = fd.get('cadastralNumber');
    objectData.area = parseFloat(fd.get('area'));
    objectData.floor = parseInt(fd.get('floor'));
    objectData.totalFloors = parseInt(fd.get('totalFloors'));
    objectData.finish = fd.get('finish');
    objectData.wallMaterial = fd.get('wallMaterial');
    saveState();
    dialog.close();
    render();
    toast('Параметры объекта обновлены');
  };
}

function openAddAnalogModal() {
  const dialog = document.getElementById('modal-dialog');
  dialog.innerHTML = `
    <div class="modal-header">
      <h3>Добавить аналог в расчёт</h3>
      <button class="btn btn-secondary btn-sm" id="modal-close">${icon('x')}</button>
    </div>
    <form id="form-add-analog" class="modal-form">
      <div class="form-group">
        <label>Адрес предложения</label>
        <input type="text" name="address" placeholder="г. Тольятти, ул. ..." required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Цена предложения (руб.)</label>
          <input type="number" name="price" placeholder="3600000" required>
        </div>
        <div class="form-group">
          <label>Площадь (м²)</label>
          <input type="number" step="0.1" name="area" placeholder="68.5" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Этаж / Этажность</label>
          <div style="display: flex; gap: 8px;">
            <input type="number" name="floor" placeholder="Этаж" required style="flex: 1;">
            <input type="number" name="totalFloors" placeholder="Всего" required style="flex: 1;">
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
        <label>Ссылка на источник (Авито / Циан)</label>
        <input type="url" name="url" placeholder="https://avito.ru/...">
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" id="modal-cancel">Отмена</button>
        <button type="submit" class="btn btn-primary">Добавить в выборку</button>
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
      number: analogs.length + 1,
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
      note: 'Добавлен оценщиком',
    };
    analogs.push(newAnalog);
    saveState();
    dialog.close();
    render();
    toast('Аналог добавлен в сравнительную таблицу');
  };
}

// Start
render();
