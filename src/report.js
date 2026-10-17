import { calculate, money, date } from './model.js';
export function download(blob, name) {
  const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 15000);
}
export async function exportWord(record) {
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, HeadingLevel, ImageRun } = await import('docx');
  const result = calculate(record);
  const p = text => new Paragraph({ children: [new TextRun({ text: String(text), size: 22 })], spacing: { after: 160 } });
  const h = text => new Paragraph({ text, heading: HeadingLevel.HEADING_1 });
  const cell = text => new TableCell({ children: [p(text)] });
  const table = rows => new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: rows.map(row => new TableRow({ children: row.map(cell) })) });
  const children = [h(`Учебный отчёт № ${record.number}`), p('ДЕМОНСТРАЦИОННЫЙ ДОКУМЕНТ. Не является профессиональным заключением об оценке. Методика и поправки условные; шаблон компании не подключён.'), h('1. Объект оценки'), p(`${record.model}, ${record.year} г.`), p(`Дата оценки: ${date(record.valuationDate)}. Местонахождение: ${record.city}. Цель: ${record.purpose}.`), p(`Состояние: ${record.condition}. Комплектация: ${record.equipment}. Пробег: ${record.km} км.`), p(record.description), h('2. Сравнительный расчёт'), p('Учебная методика v0.1. Цена × (1 + торг / 100) × (1 + год / 100) × (1 + состояние / 100) × (1 + комплектация / 100). Равные веса; среднее округляется до 1 000 рублей. Поправки задаёт сотрудник, автоматической привязки к характеристикам нет.'), table([['Аналог', 'Цена', 'Торг / год / состояние / комплект, %', 'После поправок'], ...result.rows.map(a => [`${a.model}, ${a.year}, ${a.city}`, money(a.price), `${record.trade} / ${a.yearAdj} / ${a.conditionAdj} / ${a.equipmentAdj}`, money(a.adjusted)])]), p(`Среднее до округления: ${result.exact?.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} руб.`), p(`Демонстрационный результат: ${money(result.total)}.`), h('3. Источники и сохранённые описания')];
  result.rows.forEach((a, i) => children.push(p(`${i + 1}. ${a.source}. Дата предложения: ${date(a.published)}. Сохранено: ${date(a.captured)}. ${a.url || (a.demo ? 'Вымышленный пример без внешней ссылки.' : 'Ссылка не указана сотрудником.')}`), p(a.text || 'Описание не добавлено.')));
  children.push(h('4. Материалы объекта'));
  for (const file of record.files) {
    children.push(p(file.name));
    if (/^image\/(png|jpeg)$/.test(file.type)) {
      const buffer = Uint8Array.from(atob(file.data.split(',')[1]), c => c.charCodeAt(0));
      const img = new Image(); img.src = file.data; await img.decode();
      const scale = Math.min(1, 480 / img.naturalWidth, 650 / img.naturalHeight);
      const width = Math.round(img.naturalWidth * scale), height = Math.round(img.naturalHeight * scale);
      children.push(new Paragraph({ children: [new ImageRun({ data: buffer, type: file.type === 'image/png' ? 'png' : 'jpg', transformation: { width, height } })] }));
    } else children.push(p('Файл хранится отдельно в материалах локального дела.'));
  }
  if (!record.files.length) children.push(p('Фотографии и документы не загружены.'));
  children.push(h('5. Проверка оценщиком'), p('Исходные данные, сопоставимость, дата источников и основания каждой поправки требуют проверки. Подпись: ____________________'));
  const doc = new Document({ creator: 'Росоценка · локальное демо', title: `Учебный отчёт ${record.number}`, sections: [{ children }] });
  download(await Packer.toBlob(doc), `Учебный-отчёт-${record.number}.docx`);
}
