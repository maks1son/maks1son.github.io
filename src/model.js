export const money = value => value == null ? '—' : new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value) + ' ₽';
export const date = value => value ? new Date(value + 'T12:00:00').toLocaleDateString('ru-RU') : '—';
export const today = () => new Date().toLocaleDateString('en-CA');
export function adjustedPrice(price, adjustments) {
  if (!Number.isFinite(price) || price <= 0) throw new Error('Цена должна быть больше нуля');
  return adjustments.reduce((value, percent) => {
    if (!Number.isFinite(percent) || percent <= -100 || percent > 100) throw new Error('Поправка должна быть больше −100% и не больше 100%');
    return value * (1 + percent / 100);
  }, price);
}
export function calculate(record) {
  const rows = record.analogs.filter(a => a.selected).map(a => ({ ...a, adjusted: adjustedPrice(a.price, [record.trade, a.yearAdj, a.conditionAdj, a.equipmentAdj]) }));
  const exact = rows.length ? rows.reduce((sum, a) => sum + a.adjusted, 0) / rows.length : null;
  return { rows, exact, total: exact == null ? null : Math.round(exact / 1000) * 1000, min: rows.length ? Math.min(...rows.map(a => a.adjusted)) : null, max: rows.length ? Math.max(...rows.map(a => a.adjusted)) : null };
}
export function demoAnalogs() {
  return [
    { id: 'a1', model: 'Урал ИМЗ 8.103-10', year: 1993, city: 'Самара', price: 185000, condition: 'Хорошее', equipment: 'С коляской', km: 18400, selected: true, yearAdj: 0, conditionAdj: 0, equipmentAdj: 0, color: '#647b69', note: 'Совпадают модель и комплектация', source: 'Учебный пример · Авито', published: '2026-09-01' },
    { id: 'a2', model: 'Урал ИМЗ 8.103-10', year: 1994, city: 'Тольятти', price: 210000, condition: 'Отличное', equipment: 'С коляской', km: 12200, selected: true, yearAdj: -2, conditionAdj: -7, equipmentAdj: 0, color: '#40555f', note: 'На год новее · состояние лучше', source: 'Учебный пример · Авито', published: '2026-09-02' },
    { id: 'a3', model: 'Урал ИМЗ 8.103-10', year: 1992, city: 'Ульяновск', price: 175000, condition: 'Хорошее', equipment: 'С коляской', km: 26000, selected: true, yearAdj: 2, conditionAdj: 0, equipmentAdj: 0, color: '#8e6d53', note: 'На год старше', source: 'Учебный пример · Дром', published: '2026-08-30' },
    { id: 'a4', model: 'Урал ИМЗ 8.103-10', year: 1995, city: 'Казань', price: 245000, condition: 'После реставрации', equipment: 'С коляской', km: 500, selected: false, yearAdj: -4, conditionAdj: -15, equipmentAdj: 0, color: '#708184', note: 'Реставрация — нужна проверка сопоставимости', source: 'Учебный пример · Авито', published: '2026-09-03' },
    { id: 'a5', model: 'Урал ИМЗ 8.103-10', year: 1991, city: 'Пенза', price: 125000, condition: 'Требует ремонта', equipment: 'Без коляски', km: 34000, selected: false, yearAdj: 4, conditionAdj: 12, equipmentAdj: 15, color: '#934c46', note: 'Нет коляски · требуется ремонт', source: 'Учебный пример · Дром', published: '2026-08-28' },
  ].map(a => ({ ...a, url: '', text: `${a.model}, ${a.year} г. ${a.condition}. ${a.equipment}. Пробег ${a.km} км. ${a.city}. Цена ${a.price} руб. Это вымышленное объявление для демонстрации.`, captured: '2026-09-06', demo: true }));
}
export function newRecord(demo = false) {
  return { id: crypto.randomUUID(), number: demo ? '026' : String(Date.now()).slice(-5), model: demo ? 'Урал ИМЗ 8.103-10' : '', year: demo ? 1993 : 2020, condition: 'Хорошее', equipment: 'С коляской', km: demo ? 22400 : 0, city: 'Тольятти', valuationDate: '2026-09-06', purpose: 'Определение рыночной стоимости', description: demo ? 'Мотоцикл с боковым прицепом. На ходу, следы эксплуатации соответствуют возрасту. Документы и техническое состояние подлежат проверке оценщиком.' : '', trade: -5, analogs: demo ? demoAnalogs() : [], files: [], status: 'В работе', history: [{ at: new Date().toISOString(), text: demo ? 'Создано учебное дело' : 'Создано новое дело' }], updated: new Date().toISOString() };
}
