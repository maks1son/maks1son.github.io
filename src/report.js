import { calculateValuation, money, moneyPerSqm, sqm, percent, weightFmt } from './model.js';

export function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}

export async function exportApartmentReport(objectData, analogsList) {
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, HeadingLevel, AlignmentType, BorderStyle } = await import('docx');
  const result = calculateValuation(objectData, analogsList, objectData.tradeAdjustment);

  const titleP = text => new Paragraph({
    children: [new TextRun({ text, bold: true, size: 28, color: '1e3a5f' })],
    spacing: { before: 200, after: 140 },
  });

  const h1 = text => new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 300, after: 160 },
  });

  const p = (text, opts = {}) => new Paragraph({
    children: [new TextRun({ text: String(text), size: 21, ...opts })],
    spacing: { after: 120 },
  });

  const cell = (text, opts = {}) => new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text: String(text), size: 19, bold: opts.bold })], alignment: opts.align || AlignmentType.LEFT })],
    shading: opts.bg ? { fill: opts.bg } : undefined,
  });

  const table = rows => new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(r => new TableRow({ children: r.map(c => typeof c === 'object' && c !== null && 'text' in c ? cell(c.text, c) : cell(c)) })),
  });

  // Construct Report Document
  const children = [
    new Paragraph({
      children: [
        new TextRun({ text: 'УТВЕРЖДАЮ', bold: true, size: 20 }),
      ],
      alignment: AlignmentType.RIGHT,
    }),
    new Paragraph({
      children: [
        new TextRun({ text: 'Директор ООО «РусОценка»\n___________ А.А. Орлова\n', size: 20 }),
      ],
      alignment: AlignmentType.RIGHT,
      spacing: { after: 240 },
    }),

    titleP(`ОТЧЕТ ОБ ОЦЕНКЕ № ${objectData.reportNumber}`),
    p(`Объекта оценки: ${objectData.propertyType}, кадастровый номер ${objectData.cadastralNumber}, общей площадью ${sqm(objectData.area)}, расположенного по адресу: ${objectData.address}`),
    p(`Заказчик: ${objectData.client} · Исполнитель: ${objectData.company} (г. Тольятти, ул. Гидростроевская, д. 12, тел. 28-48-08)`),
    p(`Дата оценки: ${objectData.valuationDate} г. · Дата составления отчета: ${objectData.reportDate} г.`),

    h1('1. Основные характеристики объекта оценки'),
    table([
      [{ text: 'Параметр', bold: true, bg: 'f1f5f9' }, { text: 'Значение', bold: true, bg: 'f1f5f9' }],
      ['Адрес объекта', objectData.address],
      ['Кадастровый номер', objectData.cadastralNumber],
      ['Общая площадь', sqm(objectData.area)],
      ['Этаж / Этажность', `${objectData.floor} из ${objectData.totalFloors} (средний)`],
      ['Материал стен', objectData.wallMaterial],
      ['Тип отделки', objectData.finish],
      ['Техническое состояние', objectData.condition],
      ['Балкон / лоджия', objectData.balcony],
      ['Цель оценки', objectData.purpose],
    ]),

    h1('2. Расчет рыночной стоимости сравнительным подходом (Таблица 12.2)'),
    p('Метод сравнения продаж (ФСО №7). Последовательное внесение корректировок, контроль выборки по коэффициенту вариации (≤33%) и взвешивание аналогов по количеству поправок.'),

    table([
      [
        { text: 'Элемент сравнения / Поправка', bold: true, bg: 'e2e8f0' },
        { text: 'Объект', bold: true, bg: 'e2e8f0' },
        ...result.rows.map(r => ({ text: `Аналог №${r.number}`, bold: true, bg: 'e2e8f0' })),
      ],
      [
        'Адрес предложения',
        objectData.address,
        ...result.rows.map(r => r.address),
      ],
      [
        'Цена предложения, руб.',
        'Определяется',
        ...result.rows.map(r => money(r.price)),
      ],
      [
        'Площадь, кв.м',
        String(objectData.area),
        ...result.rows.map(r => String(r.area)),
      ],
      [
        'Цена за 1 кв.м до поправок',
        '—',
        ...result.rows.map(r => moneyPerSqm(r.initialPricePerSqm)),
      ],
      [
        `Торг (${percent(objectData.tradeAdjustment)})`,
        '—',
        ...result.rows.map(r => moneyPerSqm(r.priceAfterTrade)),
      ],
      [
        'Поправка на отделку',
        objectData.finish,
        ...result.rows.map(r => `${percent(r.finishAdj)} → ${moneyPerSqm(r.priceAfterFinish)}`),
      ],
      [
        'Поправка на этаж',
        `${objectData.floor}/${objectData.totalFloors}`,
        ...result.rows.map(r => `${r.floor}/${r.totalFloors} (${percent(r.floorAdj)}) → ${moneyPerSqm(r.priceAfterFloor)}`),
      ],
      [
        'Поправка на площадь (масштаб)',
        sqm(objectData.area),
        ...result.rows.map(r => `${percent(r.areaAdj)} → ${moneyPerSqm(r.finalAdjustedPrice)}`),
      ],
      [
        'Число поправок (Ki)',
        '—',
        ...result.rows.map(r => String(r.correctionsCount)),
      ],
      [
        'Удельный вес аналога',
        '—',
        ...result.rows.map(r => weightFmt(r.weight)),
      ],
    ]),

    new Paragraph({ spacing: { before: 180 } }),
    p(`Средневзвешенная цена 1 кв.м: ${moneyPerSqm(result.pricePerSqm)}`, { bold: true }),
    p(`Итоговая рыночная стоимость полного права собственности: ${money(result.total)} (округленно до 1 000 руб.)`, { bold: true, color: '1e3a5f' }),
    p(`Статистика выборки: среднее = ${moneyPerSqm(result.meanPrice)}, стандартное отклонение = ${result.stdDev} руб./кв.м, коэффициент вариации V = ${result.variationCoeff.toFixed(2)}% (допуск ≤ 33% соблюдён).`),

    h1('3. Определение стоимости долей в праве общей собственности (Таблица 12.5)'),
    table([
      [{ text: 'Собственник', bold: true, bg: 'f1f5f9' }, { text: 'Доля', bold: true, bg: 'f1f5f9' }, { text: 'Номинальная стоимость', bold: true, bg: 'f1f5f9' }, { text: 'Рыночная стоимость (округл.)', bold: true, bg: 'f1f5f9' }],
      ...result.shares.map(s => [
        s.holder,
        s.shareFraction,
        money(s.nominal),
        money(s.rounded),
      ]),
      [
        { text: 'Итого полная стоимость', bold: true },
        '1/1 (100%)',
        money(result.total),
        { text: money(result.shares.reduce((sum, s) => sum + s.rounded, 0)), bold: true },
      ],
    ]),

    h1('4. Источники информации'),
    ...result.rows.map(r => p(`Аналог №${r.number}: ${r.source} (${r.published}) — ${r.url || 'Ссылка сохранена в материалах дела'}`)),

    h1('5. Заключение оценщика'),
    p(`Оценщик ООО «РусОценка» Орлова А.А. подтверждает, что расчет выполнен в соответствии с Федеральными стандартами оценки. Итоговая рыночная стоимость объекта составляет ${money(result.total)} рублей.`),
    p('Подпись оценщика: ____________________ / Орлова А.А. /'),
  ];

  const doc = new Document({
    creator: 'ООО «РусОценка» · Цифровое рабочее место',
    title: `Отчет об оценке ${objectData.reportNumber}`,
    sections: [{ children }],
  });

  download(await Packer.toBlob(doc), `Отчет_об_оценке_${objectData.reportNumber.replace('/', '_')}.docx`);
}
