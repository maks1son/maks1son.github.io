import { createIcons, icons } from 'lucide';
import { newRecord, calculate, money } from './model.js';
import { exportWord } from './report.js';
import './presentation.css';
import './presentation-compact.css';
import './presentation-type.css';
import './presentation-motion.css';

const icon = name => `<i data-lucide="${name}"></i>`;
const record = newRecord(true);
let current = 0, timer;
const names = ['Идея', 'Процесс', 'Живой расчёт', 'Результат', 'Следующий шаг'];
document.querySelector('#presentation').innerHTML = `
<header class="masthead"><a class="wordmark" href="#idea" aria-label="Росоценка — начало"><span class="logo">р<span>о</span></span>росоценка<span class="brand-tag">concept / 01</span></a><nav aria-label="Разделы презентации">${names.map((n,i)=>`<button data-slide="${i}" ${i===0?'aria-current="step"':''}>${n}</button>`).join('')}</nav><a class="workspace-link" href="/workspace.html">Открыть инструмент ${icon('arrow-up-right')}</a></header>
<main id="deck">
<section class="scene active hero" id="idea" aria-labelledby="hero-title"><div class="section-code"><span class="status-dot"></span> ЦИФРОВОЕ РАБОЧЕЕ МЕСТО ОЦЕНЩИКА<span class="edition">ПРОТОТИП · 2026</span></div><div class="hero-layout"><div class="hero-copy"><p class="eyebrow">Меньше рутины. Больше точности.</p><h1 id="hero-title">От данных<br>к <em>обоснованной</em><br>стоимости<span class="blue">.</span></h1><p class="lead">Объект, аналоги, расчёт и отчёт —<br>в одном понятном рабочем процессе.</p><button class="primary" data-slide="2">Попробовать на примере ${icon('arrow-up-right')}</button><span class="button-caption">Интерактивное демо · без регистрации</span></div><div class="hero-art"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><span class="art-coordinate top-coordinate">ДАННЫЕ → РЕШЕНИЕ</span><img class="sculpture" src="/images/ice-sculpture.png" alt="Скульптурная петля из голубого стекла и хрома"><div class="floating-note note-one">${icon('scan-line')}<span>Каждая цифра<br><b>имеет основание</b></span></div><div class="floating-note note-two"><span class="note-dot"></span> Решение за оценщиком</div><span class="art-coordinate bottom-coordinate">РОСОЦЕНКА / WORKFLOW SYSTEM</span></div></div><div class="hero-bottom"><span>СОБРАТЬ. СРАВНИТЬ. ОБОСНОВАТЬ.</span><div><span>01 / Объект</span><i></i><span>02 / Аналоги</span><i></i><span>03 / Отчёт</span></div><button class="text-button" data-slide="1">Посмотреть процесс ${icon('arrow-down-right')}</button></div></section>
<section class="scene" id="process" aria-labelledby="process-title" hidden><div class="section-code">01 / ЛОГИКА ИНСТРУМЕНТА<span class="edition">ОТ ЗАЯВКИ ДО ДОКУМЕНТА</span></div><div class="section-intro"><h2 id="process-title">Один объект.<br><em>Цельный процесс.</em></h2><p>Данные не теряются между вкладками,<br>таблицами и документами. Каждый шаг<br>продолжает предыдущий.</p></div><div class="process-grid">${[['01','scan-line','Описать объект','Характеристики, дата оценки, фотографии и документы.','object'],['02','search','Собрать аналоги','Сопоставимые предложения с ценами, датами и источниками.','analogs'],['03','sliders-horizontal','Проверить расчёт','Открытые поправки и формула. Итог меняется вместе с выборкой.','calculation'],['04','file-check-2','Собрать отчёт','Характеристики и расчёт переходят в документ Word.','report']].map(([n,ic,t,d,p])=>`<a class="process-card" href="/workspace.html#${p}"><div class="card-top"><span>${n}</span>${icon(ic)}</div><h3>${t}</h3><p>${d}</p><span class="card-link">Открыть шаг ${icon('arrow-up-right')}</span></a>`).join('')}</div><div class="process-foot">${icon('shield-check')}<span><b>Автоматизируем рутину.</b> Выбор источников, поправок и итоговое заключение подтверждает специалист.</span></div></section>
<section class="scene demo-scene" id="demo" aria-labelledby="demo-title" hidden><div class="section-code">02 / ПОПРОБУЙ В ДЕЙСТВИИ<span class="edition"><span class="status-dot"></span> ЖИВОЙ РАСЧЁТ</span></div><div class="demo-heading"><h2 id="demo-title">Меняй выборку.<br><em>Видь результат.</em></h2><p>Выбери аналоги и измени поправку на торг.<br>Стоимость пересчитается сразу.</p></div><div class="demo-layout"><div class="analog-panel"><div class="object-strip"><span>${icon('bike')}</span><div><small>ОБЪЕКТ ОЦЕНКИ</small><b>Урал ИМЗ 8.103-10</b></div><span class="object-year">1993 · с коляской</span></div><div class="analog-label"><span>АНАЛОГИ НА РЫНКЕ</span><span>ВЫБРАТЬ ДЛЯ РАСЧЁТА</span></div><div class="analog-list">${record.analogs.slice(0,4).map((a,i)=>`<label class="analog-row"><input type="checkbox" data-analog="${a.id}" ${a.selected?'checked':''}><img src="/images/${i%2?'ural-black':'ural-blue'}.png" alt="Иллюстрация мотоцикла Урал"><span class="analog-copy"><b>${a.city}</b><small>${a.year} г. · ${a.condition}</small></span><span class="analog-price">${money(a.price)}<small>учебный аналог</small></span></label>`).join('')}</div></div><div class="result-panel"><div class="result-top"><span>РАСЧЁТНАЯ СТОИМОСТЬ</span>${icon('move-up-right')}</div><output id="valuation" aria-live="polite"></output><div class="result-sub" id="selection-count"></div><div class="mini-chart" aria-hidden="true">${[46,59,51,75,68,88,78,96,86,100,92,113].map(h=>`<i style="--bar:${h}px"></i>`).join('')}</div><div class="range-header"><label for="trade-range">Поправка на торг</label><output id="trade-value">−5%</output></div><input id="trade-range" type="range" min="-20" max="0" step="1" value="-5"><div class="range-ends"><span>−20%</span><span>0%</span></div><details class="formula"><summary>Как считается стоимость ${icon('plus')}</summary><p>К каждой цене последовательно применяются поправки на торг, год, состояние и комплектацию из учебного дела. Затем — среднее с равными весами и округление до 1 000 ₽.</p></details></div></div><p class="demo-disclosure">${icon('info')} Учебный пример: объявления вымышлены, поправки условные. Подключения к площадкам и ИИ пока нет.</p></section>
<section class="scene report-scene" id="result" aria-labelledby="report-title" hidden><div class="section-code">03 / РЕЗУЛЬТАТ РАБОТЫ<span class="edition">ПРОЗРАЧНОСТЬ НА КАЖДОМ ШАГЕ</span></div><div class="report-layout"><div><p class="eyebrow">Из рабочего процесса — в документ</p><h2 id="report-title">Не просто цифра.<br><em>Её обоснование.</em></h2><p class="lead">Характеристики объекта, выбранные аналоги<br>и расчёт собираются в один отчёт.</p><ul class="report-features"><li>${icon('check')} Исходные данные и дата оценки</li><li>${icon('check')} Таблица аналогов и поправок</li><li>${icon('check')} Материалы и сохранённые источники</li></ul><button id="download-report" class="primary">Скачать пример Word ${icon('download')}</button><p id="report-status" class="button-caption" role="status">По текущему выбору в живом расчёте</p></div><div class="document-stage"><span class="document-label">ПРЕВЬЮ СТРУКТУРЫ / .DOCX</span><div class="paper paper-back"></div><article class="paper"><div class="paper-brand">росоценка <span>ДЕЛО № 026</span></div><span class="paper-kicker">ДЕМОНСТРАЦИОННЫЙ ДОКУМЕНТ</span><h3>Расчёт стоимости<br>движимого имущества</h3><p>Мотоцикл «Урал ИМЗ 8.103-10»</p><div class="paper-rule"></div><div class="paper-line"><span>Объект и характеристики</span><b>01</b></div><div class="paper-line"><span>Сравнительный подход</span><b>02</b></div><div class="paper-table"><div><b>Аналог</b><b>Цена</b><b>Поправки</b></div><div><span>Тольятти</span><span>210 000 ₽</span><span>−2% / −7%</span></div><div><span>Самара</span><span>185 000 ₽</span><span>0% / 0%</span></div><div><span>Ульяновск</span><span>175 000 ₽</span><span>+2% / 0%</span></div></div><div class="paper-total"><span>Расчётная стоимость</span><b id="paper-total"></b></div><p class="paper-fineprint">Учебный расчёт. Требует проверки оценщиком.</p></article><div class="doc-badge">${icon('file-check-2')} Word, который можно редактировать</div></div></div></section>
<section class="scene final-scene" id="next" aria-labelledby="next-title" hidden><div class="section-code">04 / СЛЕДУЮЩИЙ ШАГ<span class="edition">ОТ КОНЦЕПЦИИ К ПИЛОТУ</span></div><div class="final-content"><span class="pill"><span class="status-dot"></span> Основа уже работает локально</span><h2 id="next-title">Меньше действий.<br><em>Больше ясности.</em></h2><p class="lead">Пройди одно учебное дело целиком.<br>Затем адаптируем процесс под реальные отчёты компании.</p><a class="primary" href="/workspace.html">Перейти в рабочее место ${icon('arrow-up-right')}</a><div class="pilot-checklist"><span><b>01</b> Обезличенный отчёт</span><span><b>02</b> Методика расчёта</span><span><b>03</b> Шаблон компании</span></div><p class="pilot-caption">Три исходных материала для настройки пилота</p></div><div class="final-orbit" aria-hidden="true"></div><div class="final-footer"><span>РОСОЦЕНКА / ИНТЕРАКТИВНАЯ КОНЦЕПЦИЯ</span><span>Технологии помогают. Решение принимаешь ты.</span></div></section>
</main><footer class="deck-controls"><span class="footer-caption">ИНСТРУМЕНТ, КОТОРЫЙ МОЖНО ПОПРОБОВАТЬ</span><div class="control-capsule"><button id="prev" aria-label="Предыдущий слайд">${icon('arrow-left')}</button><span id="counter">01 <span>/ 05</span></span><div class="dots">${names.map((n,i)=>`<button data-slide="${i}" aria-label="${n}" class="${i===0?'selected':''}"></button>`).join('')}</div><button id="next-slide" aria-label="Следующий слайд">${icon('arrow-right')}</button></div><div class="view-controls"><button id="autoplay" aria-label="Включить автопоказ" aria-pressed="false">${icon('play')}<span>Автопоказ</span></button><button id="fullscreen" aria-label="Полный экран">${icon('maximize')}</button></div></footer><div class="deck-progress"><i id="progress"></i></div>`;

const scenes = [...document.querySelectorAll('.scene')];
const brandEmblem = document.createElement('img');
brandEmblem.src = '/images/rosocenka-emblem.png';
brandEmblem.alt = '';
brandEmblem.width = 52;
brandEmblem.height = 52;
document.querySelector('.wordmark .logo').replaceChildren(brandEmblem);
document.querySelector('.wordmark .logo').setAttribute('aria-hidden', 'true');
document.querySelectorAll('#presentation p br').forEach(br => br.after(document.createTextNode(' ')));
document.querySelector('.note-one').innerHTML = `<span class="note-icon">${icon('scan-line')}</span><span><small>ПРОЗРАЧНЫЙ РАСЧЁТ</small><b>Каждая цифра —<br>с основанием.</b></span>`;
document.querySelector('.note-two').innerHTML = `<span class="note-icon">${icon('user-check')}</span><span><small>КОНТРОЛЬ СПЕЦИАЛИСТА</small><b>Решение<br>за оценщиком.</b></span>`;
document.querySelector('.hero-bottom > span').innerHTML = 'Собрать. Сравнить.<br><em>Обосновать.</em>';
let activeTransition;
function show(index, updateHash = true) {
  const next = Math.max(0, Math.min(scenes.length - 1, index));
  const changed = next !== current;
  const direction = next >= current ? 1 : -1;
  current = next;
  const apply = () => {
  scenes.forEach((s,i) => { s.hidden = i !== current; s.classList.toggle('active', i === current); });
  document.querySelectorAll('.masthead [data-slide]').forEach(b => { if (+b.dataset.slide === current) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
  document.querySelectorAll('.dots button').forEach((b,i) => { b.classList.toggle('selected',i===current); b.setAttribute('aria-pressed',String(i===current)); });
  document.querySelector('#counter').innerHTML = `0${current+1} <span>/ 05</span>`;
  document.querySelector('#prev').disabled = current === 0;
  document.querySelector('#next-slide').disabled = current === scenes.length-1;
  document.querySelector('#progress').style.width = `${(current+1)/scenes.length*100}%`;
  if (updateHash) history.replaceState(null,'',`#${scenes[current].id}`);
  window.scrollTo({top:0,behavior:'instant'});
  };
  activeTransition?.skipTransition();
  if (changed && document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.documentElement.style.setProperty('--slide-direction', direction);
    activeTransition = document.startViewTransition(apply);
    activeTransition.ready.catch(() => {});
  } else {
    apply();
  }
}
function updateCalculation() {
  const result = calculate(record);
  document.querySelector('#valuation').textContent = money(result.total);
  document.querySelector('#paper-total').textContent = money(result.total);
  document.querySelector('.paper-table').innerHTML = `<div><b>Аналог</b><b>Цена</b><b>Поправки</b></div>${result.rows.map(a=>`<div><span>${a.city}</span><span>${money(a.price)}</span><span>${a.yearAdj}% / ${a.conditionAdj}%</span></div>`).join('')}`;
  document.querySelector('#selection-count').textContent = result.rows.length ? `${result.rows.length} из 4 аналогов · среднее с поправками` : 'Выбери хотя бы один аналог';
  document.querySelector('#trade-value').textContent = `${record.trade}%`;
  document.querySelector('#download-report').disabled = !result.rows.length;
}
function stopAuto() { clearInterval(timer); timer=null; document.querySelector('#autoplay').setAttribute('aria-pressed','false'); document.querySelector('#autoplay').setAttribute('aria-label','Включить автопоказ'); document.querySelector('#autoplay span').textContent='Автопоказ'; }
document.addEventListener('click', e => { const b=e.target.closest('[data-slide]'); if(b) {stopAuto();show(+b.dataset.slide);} });
document.querySelector('#prev').onclick=()=>{stopAuto();show(current-1);};
document.querySelector('#next-slide').onclick=()=>{stopAuto();show(current+1);};
document.addEventListener('keydown',e=>{if(e.target.closest('input,summary,textarea,select') || e.altKey || e.ctrlKey || e.metaKey)return; if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();stopAuto();show(current+(e.key==='ArrowRight'?1:-1));}});
document.querySelector('#trade-range').addEventListener('input',e=>{stopAuto();record.trade=+e.target.value;updateCalculation();});
document.querySelectorAll('[data-analog]').forEach(el=>el.addEventListener('change',()=>{stopAuto();record.analogs.find(a=>a.id===el.dataset.analog).selected=el.checked;updateCalculation();}));
document.querySelector('#download-report').onclick=async e=>{ const b=e.currentTarget;b.disabled=true;const status=document.querySelector('#report-status');try{await exportWord(record);status.textContent='Документ передан браузеру для скачивания';}catch(err){status.textContent='Не удалось создать документ. Попробуй ещё раз.';console.error(err);}finally{b.disabled=!calculate(record).rows.length;} };
document.querySelector('#autoplay').onclick=()=>{if(timer){stopAuto();return;}const b=document.querySelector('#autoplay');b.setAttribute('aria-pressed','true');b.setAttribute('aria-label','Остановить автопоказ');b.querySelector('span').textContent='Пауза';timer=setInterval(()=>{if(current===scenes.length-1){stopAuto();return;}show(current+1);},12000);};
document.querySelector('#fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{document.querySelector('#fullscreen').setAttribute('aria-label','Полный экран недоступен');}};
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopAuto();});
window.addEventListener('hashchange',()=>{const i=scenes.findIndex(s=>`#${s.id}`===location.hash);if(i>=0)show(i,false);});
createIcons({icons});updateCalculation();show(Math.max(0,scenes.findIndex(s=>`#${s.id}`===location.hash)),false);
