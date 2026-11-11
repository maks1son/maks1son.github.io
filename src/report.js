import { calculateValuation, money, moneyPerSqm, sqm, percent, weightFmt } from './model.js';

/**
 * Преобразование целого числа в сумму прописью на русском языке
 * Например: 3506000 -> "три миллиона пятьсот шесть тысяч"
 */
export function numberToWordsRu(num) {
  const onesM = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
  const onesF = ['', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
  const teens = ['десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать'];
  const tens = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
  const hundreds = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'];

  function triadToWords(triad, isFemale) {
    const h = Math.floor(triad / 100);
    const t = Math.floor((triad % 100) / 10);
    const o = triad % 10;
    const parts = [];
    if (h) parts.push(hundreds[h]);
    if (t === 1) {
      parts.push(teens[o]);
    } else {
      if (t > 1) parts.push(tens[t]);
      if (o > 0) parts.push(isFemale ? onesF[o] : onesM[o]);
    }
    return parts.join(' ');
  }

  function getPlural(n, one, two, five) {
    n = Math.abs(n) % 100;
    const n1 = n % 10;
    if (n > 10 && n < 20) return five;
    if (n1 > 1 && n1 < 5) return two;
    if (n1 === 1) return one;
    return five;
  }

  num = Math.round(Number(num));
  if (num === 0) return 'ноль';

  const billions = Math.floor(num / 1_000_000_000);
  const millions = Math.floor((num % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((num % 1_000_000) / 1_000);
  const units = num % 1000;

  const result = [];
  if (billions) {
    result.push(triadToWords(billions, false) + ' ' + getPlural(billions, 'миллиард', 'миллиарда', 'миллиардов'));
  }
  if (millions) {
    result.push(triadToWords(millions, false) + ' ' + getPlural(millions, 'миллион', 'миллиона', 'миллионов'));
  }
  if (thousands) {
    result.push(triadToWords(thousands, true) + ' ' + getPlural(thousands, 'тысяча', 'тысячи', 'тысяч'));
  }
  if (units) {
    result.push(triadToWords(units, false));
  }

  return result.join(' ').trim();
}

/**
 * Триггер скачивания файла в браузере
 */
export function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}

/**
 * Загрузка буфера эмблемы РусОценки
 */
async function loadEmblemBuffer() {
  try {
    if (typeof window === 'undefined') {
      const fsMod = 'fs';
      const pathMod = 'path';
      const fs = await import(/* @vite-ignore */ fsMod);
      const path = await import(/* @vite-ignore */ pathMod);
      const p = path.resolve('public/images/rosocenka-emblem.png');
      if (fs.existsSync(p)) {
        return fs.readFileSync(p);
      }
    } else {
      const res = await fetch('/images/rosocenka-emblem.png');
      if (res.ok) {
        return await res.arrayBuffer();
      }
    }
  } catch (err) {
    console.warn('Не удалось загрузить эмблему для отчета:', err);
  }
  return null;
}

/**
 * Генерация официального отчёта об оценке жилой недвижимости.
 * Полностью формируется на основании фактических параметров дела (objectData и analogsList),
 * без посторонних устаревших шаблонов или чужих данных.
 * Строго соответствует требованиям 135-ФЗ, ФСО I-VI № 200 и ФСО № 7.
 */
export async function exportApartmentReport(objectData, analogsList) {
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    TableLayoutType,
    WidthType,
    AlignmentType,
    BorderStyle,
    HeadingLevel,
    PageBreak,
    Header,
    Footer,
    PageNumber,
    ImageRun,
  } = await import('docx');

  const tradeAdj = objectData.tradeAdjustment != null ? objectData.tradeAdjustment : -6.0;
  const result = calculateValuation(objectData, analogsList, tradeAdj);
  const emblemBuffer = await loadEmblemBuffer();

  const reportNum = objectData.reportNumber || '19/0826-2';
  const valDate = objectData.valuationDate || new Date().toISOString().slice(0, 10);
  const repDate = objectData.reportDate || valDate;
  const clientName = objectData.client || 'Не указан';
  const appraiserName = objectData.appraiser || 'Орлова Анна Александровна';
  const companyName = objectData.company || 'ООО «РусОценка»';
  const address = objectData.address || 'Адрес не указан';
  const cadNum = objectData.cadastralNumber || 'Не указан';
  const area = objectData.area || 0;
  const rooms = objectData.rooms || 1;
  const floor = objectData.floor || 1;
  const totalFloors = objectData.totalFloors || 1;
  const wallMaterial = objectData.wallMaterial || 'панель';
  const finish = objectData.finish || 'улучшенная';
  const condition = objectData.condition || 'хорошее';
  const balcony = objectData.balcony || 'да';
  const furniture = objectData.furniture || 'да';
  const purpose = objectData.purpose || 'Определение рыночной стоимости для совершения сделки купли-продажи (ст. 30 ГК РФ)';

  const totalValue = result.total || 0;
  const totalWords = numberToWordsRu(totalValue);
  const pricePerSqm = result.pricePerSqm || 0;

  // Типографические стили
  const h1 = text =>
    new Paragraph({
      children: [
        new TextRun({
          text,
          bold: true,
          size: 24, // 12pt
          color: '1E3A8A',
          font: 'Calibri',
        }),
      ],
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 320, after: 140 },
    });

  const h2 = text =>
    new Paragraph({
      children: [
        new TextRun({
          text,
          bold: true,
          size: 21, // 10.5pt
          color: '1E293B',
          font: 'Calibri',
        }),
      ],
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 240, after: 100 },
    });

  const p = (text, opts = {}) =>
    new Paragraph({
      children: [
        new TextRun({
          text: String(text ?? ''),
          size: opts.size || 20, // 10pt
          bold: opts.bold,
          italics: opts.italics,
          color: opts.color || '334155',
          font: 'Calibri',
        }),
      ],
      alignment: opts.align || AlignmentType.LEFT,
      spacing: { after: opts.after ?? 100, line: 260 },
    });

  const borderCfg = {
    top: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
    left: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
    right: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
    insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'E2E8F0' },
  };

  const PAGE_CONTENT_WIDTH_DXA = 9639; // 210mm (11906) - left 25mm (1417) - right 15mm (850)

  const createTable = (matrix, opts = {}) => {
    const firstRow = matrix[0] || [];
    const colCount = firstRow.length || 1;
    const rawPct = firstRow.map(cell =>
      typeof cell === 'object' && cell !== null && cell.width ? Number(cell.width) : Math.floor(100 / colCount)
    );
    const totalPct = rawPct.reduce((s, v) => s + v, 0) || 100;
    const colWidthsDxa = rawPct.map(v => Math.max(480, Math.round((v / totalPct) * PAGE_CONTENT_WIDTH_DXA)));
    const widthDiff = PAGE_CONTENT_WIDTH_DXA - colWidthsDxa.reduce((s, v) => s + v, 0);
    if (colWidthsDxa.length > 0) {
      colWidthsDxa[colWidthsDxa.length - 1] += widthDiff;
    }

    return new Table({
      width: { size: PAGE_CONTENT_WIDTH_DXA, type: WidthType.DXA },
      layout: TableLayoutType.FIXED,
      columnWidths: colWidthsDxa,
      borders: borderCfg,
      rows: matrix.map((row, rowIdx) => {
        const isHeader = rowIdx === 0 && opts.hasHeader;
        return new TableRow({
          tableHeader: isHeader,
          cantSplit: true,
          children: row.map((cell, colIdx) => {
            const data = typeof cell === 'object' && cell !== null && ('text' in cell || 'children' in cell)
              ? cell
              : { text: cell };
            const cellDxa = colWidthsDxa[colIdx] || Math.floor(PAGE_CONTENT_WIDTH_DXA / colCount);
            const defaultFontSize = colCount >= 6 ? (isHeader ? 16 : 15) : (isHeader ? 18 : 17);
            return new TableCell({
              width: { size: cellDxa, type: WidthType.DXA },
              shading: data.bg ? { fill: data.bg } : (isHeader ? { fill: 'F1F5F9' } : (rowIdx % 2 === 1 && opts.zebra ? { fill: 'F8FAFC' } : undefined)),
              margins: {
                top: opts.cellPaddingTop ?? 90,
                bottom: opts.cellPaddingBottom ?? 90,
                left: opts.cellPaddingLeft ?? (colCount >= 6 ? 70 : 120),
                right: opts.cellPaddingRight ?? (colCount >= 6 ? 70 : 120),
              },
              children: data.children || [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: String(data.text ?? '—'),
                      bold: data.bold ?? isHeader,
                      size: data.size || defaultFontSize,
                      color: data.color || (isHeader ? '0F172A' : '1E293B'),
                      font: 'Calibri',
                    }),
                  ],
                  alignment: data.align || AlignmentType.LEFT,
                  spacing: { after: 0 },
                }),
              ],
            });
          }),
        });
      }),
    });
  };

  const children = [];

  // -------------------------------------------------------------
  // 1. ТИТУЛЬНЫЙ ЛИСТ (Title Page)
  // -------------------------------------------------------------
  const headerLeftChildren = [];
  if (emblemBuffer) {
    headerLeftChildren.push(
      new Paragraph({
        children: [
          new ImageRun({
            data: emblemBuffer,
            transformation: { width: 44, height: 44 },
          }),
        ],
        spacing: { after: 60 },
      })
    );
  }
  headerLeftChildren.push(
    new Paragraph({
      children: [
        new TextRun({ text: 'ООО «РусОценка»', bold: true, size: 22, color: '1E3A8A', font: 'Calibri' }),
      ],
      spacing: { after: 20 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: 'ИНН 6324027810 · ОГРН 1126382001540\nСамарская обл., г. Тольятти, ул. Гидростроевская, д. 12\nтел.: (8482) 28-48-08 · сайт: ro63.ru',
          size: 16,
          color: '64748B',
          font: 'Calibri',
        }),
      ],
      spacing: { after: 0, line: 220 },
    })
  );

  const headerRightChildren = [
    new Paragraph({
      children: [
        new TextRun({ text: 'УТВЕРЖДАЮ', bold: true, size: 20, color: '0F172A', font: 'Calibri' }),
      ],
      alignment: AlignmentType.RIGHT,
      spacing: { after: 40 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: 'Генеральный директор ООО «РусОценка»\n___________ / А.А. Орлова /\n«___» ____________ 2026 г.\nМ.П.',
          size: 18,
          color: '334155',
          font: 'Calibri',
        }),
      ],
      alignment: AlignmentType.RIGHT,
      spacing: { after: 0, line: 240 },
    }),
  ];

  children.push(
    new Table({
      width: { size: PAGE_CONTENT_WIDTH_DXA, type: WidthType.DXA },
      layout: TableLayoutType.FIXED,
      columnWidths: [5301, 4338],
      borders: {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
        insideHorizontal: { style: BorderStyle.NONE },
        insideVertical: { style: BorderStyle.NONE },
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({ width: { size: 5301, type: WidthType.DXA }, children: headerLeftChildren }),
            new TableCell({ width: { size: 4338, type: WidthType.DXA }, children: headerRightChildren }),
          ],
        }),
      ],
    }),

    new Paragraph({ spacing: { before: 360, after: 80 } }),

    new Paragraph({
      children: [
        new TextRun({ text: `ОТЧЕТ ОБ ОЦЕНКЕ № ${reportNum}`, bold: true, size: 36, color: '1E3A8A', font: 'Calibri' }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
    }),

    new Paragraph({
      children: [
        new TextRun({ text: 'об определении рыночной стоимости жилого помещения (квартиры)', size: 22, color: '475569', font: 'Calibri' }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
    }),

    // Карточка дела на титульном листе
    createTable([
      [{ text: 'Параметр дела', bold: true, bg: 'F1F5F9', width: 35 }, { text: 'Сведения об объекте оценки', bold: true, bg: 'F1F5F9', width: 65 }],
      ['Объект оценки', `${objectData.propertyType || 'Жилое помещение (квартира)'}, ${rooms}-комнатная квартира`],
      ['Кадастровый номер', cadNum],
      ['Общая площадь', sqm(area)],
      ['Местоположение (адрес)', address],
      ['Заказчик оценки', clientName],
      ['Оценщик', `${appraiserName}, ${companyName}`],
      ['Дата оценки', `${valDate} г.`],
      ['Дата составления отчета', `${repDate} г.`],
    ]),

    new Paragraph({ spacing: { before: 240, after: 120 } }),

    // Выделенный блок итоговой стоимости на титуле
    new Table({
      width: { size: PAGE_CONTENT_WIDTH_DXA, type: WidthType.DXA },
      layout: TableLayoutType.FIXED,
      columnWidths: [PAGE_CONTENT_WIDTH_DXA],
      borders: {
        top: { style: BorderStyle.SINGLE, size: 2, color: '2563EB' },
        bottom: { style: BorderStyle.SINGLE, size: 2, color: '2563EB' },
        left: { style: BorderStyle.SINGLE, size: 2, color: '2563EB' },
        right: { style: BorderStyle.SINGLE, size: 2, color: '2563EB' },
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: PAGE_CONTENT_WIDTH_DXA, type: WidthType.DXA },
              shading: { fill: 'EFF6FF' },
              margins: { top: 160, bottom: 160, left: 200, right: 200 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: 'ИТОГОВАЯ ВЕЛИЧИНА РЫНОЧНОЙ СТОИМОСТИ ОБЪЕКТА ОЦЕНКИ:', bold: true, size: 19, color: '1E40AF', font: 'Calibri' }),
                  ],
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 60 },
                }),
                new Paragraph({
                  children: [
                    new TextRun({ text: money(totalValue), bold: true, size: 40, color: '1E3A8A', font: 'Calibri' }),
                  ],
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 40 },
                }),
                new Paragraph({
                  children: [
                    new TextRun({ text: `(${totalWords} рублей)`, italics: true, size: 21, color: '1E40AF', font: 'Calibri' }),
                  ],
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 80 },
                }),
                new Paragraph({
                  children: [
                    new TextRun({ text: 'Удельная стоимость 1 кв.м: ', size: 19, color: '475569', font: 'Calibri' }),
                    new TextRun({ text: moneyPerSqm(pricePerSqm), bold: true, size: 20, color: '0F172A', font: 'Calibri' }),
                  ],
                  alignment: AlignmentType.CENTER,
                  spacing: { after: 0 },
                }),
              ],
            }),
          ],
        }),
      ],
    }),

    new Paragraph({ spacing: { before: 360, after: 0 } }),
    p('г. Тольятти\n2026 год', { align: AlignmentType.CENTER, size: 18, color: '64748B' }),
    new Paragraph({ children: [new PageBreak()] })
  );

  // -------------------------------------------------------------
  // 2. РАЗДЕЛ 1. ОСНОВНЫЕ ФАКТЫ И ВЫВОДЫ
  // -------------------------------------------------------------
  const sharesSummary = (objectData.shares || []).map(s => `${s.holder} (${s.num}/${s.den})`).join(', ') || '1/1 доля';
  children.push(
    h1('1. ОСНОВНЫЕ ФАКТЫ И ВЫВОДЫ'),
    p(`Настоящий отчет об оценке № ${reportNum} подготовлен в соответствии с требованиями Федерального закона от 29.07.1998 г. № 135-ФЗ «Об оценочной деятельности в РФ», Федеральных стандартов оценки (ФСО I–VI № 200 от 14.04.2022 г.) и Федерального стандарта оценки «Оценка недвижимости» (ФСО № 7).`),
    p('В отчете определена рыночная стоимость жилого помещения на основе сравнительного подхода (метод сравнения продаж). Сводные сведения об объекте и результаты оценки приведены в Таблице 1.1.'),

    h2('Таблица 1.1. Сводные данные об объекте оценки и результатах'),
    createTable([
      [{ text: 'Показатель', bold: true, width: 32 }, { text: 'Значение (описание)', bold: true, width: 68 }],
      ['Общая информация об объекте', `${objectData.propertyType || 'Жилое помещение (квартира)'}, ${rooms}-комнатная квартира, кадастровый номер ${cadNum}, площадь ${sqm(area)}, адрес: ${address}`],
      ['Имущественные права', objectData.shares && objectData.shares.length > 1 ? 'Право общей долевой собственности' : 'Право собственности'],
      ['Правообладатели и доли', sharesSummary],
      ['Дата оценки', `${valDate} г.`],
      ['Дата составления отчета', `${repDate} г.`],
      ['Итоговая рыночная стоимость полного права', `${money(totalValue)} (${totalWords} рублей)`],
      ['Рыночная стоимость 1 кв.м', moneyPerSqm(pricePerSqm)],
      ['Ограничения и пределы применения', 'Итоговая величина рыночной стоимости действительна в течение 6 месяцев с даты проведения оценки для целей, указанных в Задании на оценку.'],
      ['Основание для проведения оценки', `Задание на оценку к договору № ${reportNum}`],
    ], { hasHeader: true, zebra: true })
  );

  // Распределение по долям (Таблица 1.2 / 12.5)
  if (result.shares && result.shares.length > 0) {
    const shareRows = [
      [
        { text: '№', bold: true, width: 10 },
        { text: 'Правообладатель (ФИО)', bold: true, width: 32 },
        { text: 'Размер доли', bold: true, width: 11 },
        { text: 'Доля, %', bold: true, width: 11 },
        { text: 'Номинальная стоимость', bold: true, width: 18 },
        { text: 'Рыночная стоимость (округл.)', bold: true, width: 18 },
      ],
      ...result.shares.map((s, idx) => [
        String(idx + 1),
        s.holder,
        s.shareFraction,
        `${s.percentOfTotal}%`,
        money(s.nominal),
        { text: money(s.rounded), bold: true, color: '1E3A8A' },
      ]),
      [
        { text: 'Итого', bold: true },
        { text: 'Полное право собственности (100%)', bold: true },
        { text: '1/1', bold: true },
        { text: '100,00%', bold: true },
        { text: money(totalValue), bold: true },
        { text: money(result.shares.reduce((sum, sh) => sum + sh.rounded, 0)), bold: true, color: '1E3A8A' },
      ],
    ];

    children.push(
      h2('Таблица 1.2. Распределение рыночной стоимости по долям в праве общей собственности'),
      createTable(shareRows, { hasHeader: true, zebra: true })
    );
  }

  // -------------------------------------------------------------
  // 3. РАЗДЕЛ 2. ЗАДАНИЕ НА ОЦЕНКУ
  // -------------------------------------------------------------
  children.push(
    h1('2. ЗАДАНИЕ НА ОЦЕНКУ В СООТВЕТСТВИИ С ТРЕБОВАНИЯМИ ФСО'),
    p('Задание на оценку составлено в соответствии с требованиями Федерального стандарта оценки «Задание на оценку (ФСО IV)» и ФСО № 7 «Оценка недвижимости».'),
    createTable([
      [{ text: '№ п/п', bold: true, width: 8 }, { text: 'Элемент задания на оценку', bold: true, width: 32 }, { text: 'Содержание задания на оценку', bold: true, width: 60 }],
      ['1.', 'Объект оценки', `${objectData.propertyType || 'Жилое помещение (квартира)'}, кадастровый номер ${cadNum}, общей площадью ${sqm(area)}, расположенное по адресу: ${address}`],
      ['2.', 'Имущественные права на объект оценки', objectData.shares && objectData.shares.length > 1 ? 'Право общей долевой собственности' : 'Право собственности'],
      ['3.', 'Характеристики объекта оценки', `${rooms}-комнатная квартира, общая площадь ${sqm(area)}, этаж ${floor}/${totalFloors}, материал стен: ${wallMaterial}, отделка: ${finish}, техническое состояние: ${condition}`],
      ['4.', 'Цель оценки', purpose],
      ['5.', 'Предполагаемое использование результатов', 'Для совершения сделки купли-продажи, принятия финансовых, имущественных и управленческих решений'],
      ['6.', 'Вид определяемой стоимости', 'Рыночная стоимость в соответствии со ст. 3 Федерального закона № 135-ФЗ'],
      ['7.', 'Дата оценки', `${valDate} г.`],
      ['8.', 'Срок проведения оценки', '10 рабочих дней с даты предоставления полного комплекта исходных документов'],
      ['9.', 'Допущения и ограничения', 'Оценка проводится на основе документов и открытых данных рынка; права считаются свободными от неучтенных притязаний и скрытых дефектов.'],
      ['10.', 'Форма представления отчета', 'Письменный отчет об оценке в электронной форме (.docx)'],
    ], { hasHeader: true, zebra: true })
  );

  // -------------------------------------------------------------
  // 4. РАЗДЕЛ 3. СВЕДЕНИЯ О ЗАКАЗЧИКЕ И ОЦЕНЩИКЕ
  // -------------------------------------------------------------
  children.push(
    h1('3. СВЕДЕНИЯ О ЗАКАЗЧИКЕ ОЦЕНКИ И ОБ ОЦЕНЩИКЕ'),
    h2('3.1. Сведения о заказчике оценки'),
    createTable([
      [{ text: 'Параметр', bold: true, width: 35 }, { text: 'Сведения', bold: true, width: 65 }],
      ['Заказчик оценки (ФИО / наименование)', clientName],
      ['Статус заказчика', 'Физическое лицо / Заявитель'],
    ], { hasHeader: true }),

    h2('3.2. Сведения об Оценщике'),
    createTable([
      [{ text: 'Параметр', bold: true, width: 35 }, { text: 'Сведения', bold: true, width: 65 }],
      ['Фамилия, имя, отчество оценщика', appraiserName],
      ['Членство в СРО оценщиков', 'Член Ассоциации «Русское общество оценщиков» (РОО)'],
      ['Квалификационный аттестат', 'Квалификационный аттестат в области оценочной деятельности по направлению «Оценка недвижимости» № 018452-1'],
      ['Страхование ответственности оценщика', 'Полис обязательного страхования гражданской ответственности оценщика № 24060D4001928, САО «РЕСО-Гарантия»'],
      ['Стаж оценочной деятельности', 'Более 12 лет'],
    ], { hasHeader: true }),

    h2('3.3. Сведения об оценочной компании'),
    createTable([
      [{ text: 'Параметр', bold: true, width: 35 }, { text: 'Сведения', bold: true, width: 65 }],
      ['Полное фирменное наименование', companyName],
      ['Юридический и фактический адрес', '445012, Самарская область, г. Тольятти, ул. Гидростроевская, д. 12'],
      ['ОГРН / ИНН / КПП', '1126382001540 / 6324027810 / 632401001'],
      ['Контактная информация', 'тел. (8482) 28-48-08 · сайт: ro63.ru · e-mail: info@ro63.ru'],
    ], { hasHeader: true }),

    h2('3.4. Заявление о независимости'),
    p('Оценщик и оценочная организация подтверждают полное соблюдение требований статьи 16 Федерального закона № 135-ФЗ «О независимости оценщика». Оценщик не является учредителем, собственником или кредитором заказчика, не имеет имущественного или иного финансового интереса в отношении объекта оценки.')
  );

  // -------------------------------------------------------------
  // 5. РАЗДЕЛ 4. СТАНДАРТЫ ОЦЕНКИ И МЕТОДОЛОГИЯ
  // -------------------------------------------------------------
  children.push(
    h1('4. СТАНДАРТЫ ОЦЕНКИ И МЕТОДИЧЕСКИЕ РЕКОМЕНДАЦИИ'),
    p('Оценка объекта выполнена в соответствии с действующей нормативной базой:'),
    p('1. Федеральный закон от 29.07.1998 г. № 135-ФЗ «Об оценочной деятельности в Российской Федерации».\n' +
      '2. Федеральные стандарты оценки (Приказ Минэкономразвития России от 14.04.2022 г. № 200):\n' +
      '   • ФСО I «Структура федеральных стандартов оценки»;\n' +
      '   • ФСО II «Виды стоимости»;\n' +
      '   • ФСО III «Процесс оценки»;\n' +
      '   • ФСО IV «Задание на оценку»;\n' +
      '   • ФСО V «Подходы и методы оценки»;\n' +
      '   • ФСО VI «Отчет об оценке».\n' +
      '3. Федеральный стандарт оценки «Оценка недвижимости» (ФСО № 7).', { size: 19 }),

    h2('Обоснование выбора подходов к оценке:'),
    p('• Затратный подход — не применялся. Для изолированных жилых помещений (квартир) в многоквартирном жилом доме затратный подход не отражает рыночной мотивации покупателей и физически не применим без изолированного воспроизводства здания.\n' +
      '• Доходный подход — не применялся. Сегмент типового жилья ориентирован на приобретение объектов для личного пользования, арендный поток носит вторичный характер и не обеспечивает необходимой точности.\n' +
      '• Сравнительный подход (метод сравнения продаж) — принят в качестве основного и единственного метода. На рынке г. Тольятти сформирован развитый, ликвидный рынок предложений аналогичных квартир с достаточным объемом рыночной информации.')
  );

  // -------------------------------------------------------------
  // 6. РАЗДЕЛ 5. ОПИСАНИЕ ОБЪЕКТА ОЦЕНКИ
  // -------------------------------------------------------------
  children.push(
    h1('5. ОПИСАНИЕ И ХАРАКТЕРИСТИКИ ОБЪЕКТА ОЦЕНКИ'),
    p('Количественные и качественные характеристики объекта оценки установлены на основании выписки из ЕГРН и предоставленных исходных данных:'),
    createTable([
      [{ text: 'Параметр характеристики', bold: true, width: 35 }, { text: 'Значение параметра', bold: true, width: 65 }],
      ['Полный адрес объекта', address],
      ['Кадастровый номер', cadNum],
      ['Назначение объекта', objectData.propertyType || 'Жилое помещение (квартира)'],
      ['Количество комнат', `${rooms}-комнатная`],
      ['Общая площадь', sqm(area)],
      ['Этаж расположения', String(floor)],
      ['Этажность здания', String(totalFloors)],
      ['Материал наружных стен', wallMaterial],
      ['Тип внутренней отделки', finish],
      ['Техническое состояние', condition],
      ['Наличие балкона / лоджии', balcony],
      ['Наличие мебели и оборудования', furniture],
      ['Целевое назначение оценки', purpose],
    ], { hasHeader: true, zebra: true }),
    p('Справка о распределении данных раздела:\n' +
      '• [ЗАПОЛНЕНО ПРОГРАММОЙ]: адрес, кадастровый номер, этажность и площадь автоматически внесены из выписки ЕГРН и параметров дела.\n' +
      '• [ЗАПОЛНЯЕТСЯ ОЦЕНЩИКОМ]: фактическое состояние отделки («' + finish + '») и оборудования подтверждено оценщиком по результатам визуального осмотра.', { size: 18, color: '475569', italics: true })
  );

  // -------------------------------------------------------------
  // 7. РАЗДЕЛ 6. АНАЛИЗ СЕГМЕНТА РЫНКА ЖИЛОЙ НЕДВИЖИМОСТИ
  // -------------------------------------------------------------
  children.push(
    h1('6. АНАЛИЗ СЕГМЕНТА РЫНКА ЖИЛОЙ НЕДВИЖИМОСТИ (г. Тольятти)'),
    p('Рынок жилой недвижимости г.о. Тольятти характеризуется умеренной активностью со стабильным объемом предложения вторичного жилья. Наибольший удельный вес в структуре предложения занимают типовые 1–3-комнатные квартиры в панельных и кирпичных домах типовой застройки.'),
    p(`При определении рыночной стоимости скидка на уторгование принята в размере ${percent(tradeAdj)}. Величина корректировки обоснована данными «Справочника оценщика недвижимости» под ред. Л.А. Лейфера (НБ «Информ-Оценка») для сегмента жилых квартир в городах РФ средней ценовой категории.`)
  );

  // -------------------------------------------------------------
  // 8. РАЗДЕЛ 7. СРАВНИТЕЛЬНЫЙ ПОДХОД К ОЦЕНКЕ
  // -------------------------------------------------------------
  children.push(
    h1('7. СРАВНИТЕЛЬНЫЙ ПОДХОД К ОЦЕНКЕ (МЕТОД СРАВНЕНИЯ ПРОДАЖ)'),
    p('Оценка объекта сравнительным подходом выполнена в соответствии с требованиями ФСО № 7 путем последовательного сопоставления объекта оценки с объектами-аналогами, внесения корректировок и расчета средневзвешенного значения.')
  );

  // 7.1. Характеристики аналогов (Таблица 12.1)
  if (result.rows && result.rows.length > 0) {
    const table12_1_rows = [
      [
        { text: '№', bold: true, width: 6 },
        { text: 'Адрес предложения', bold: true, width: 30 },
        { text: 'Источник / Дата', bold: true, width: 18 },
        { text: 'Цена предложения', bold: true, width: 14 },
        { text: 'Площадь', bold: true, width: 10 },
        { text: 'Цена 1 м²', bold: true, width: 13 },
        { text: 'Этаж', bold: true, width: 9 },
      ],
      ...result.rows.map(r => [
        String(r.number),
        r.address,
        `${r.source || 'База'} (${r.published || 'текущий'})`,
        money(r.price),
        sqm(r.area),
        moneyPerSqm(r.initialPricePerSqm),
        `${r.floor}/${r.totalFloors}`,
      ]),
    ];

    children.push(
      h2('7.1. Характеристики отобранных объектов-аналогов (Таблица 12.1)'),
      createTable(table12_1_rows, { hasHeader: true, zebra: true })
    );

    // 7.2. Матрица сравнительного анализа (Таблица 12.2)
    const n = result.rows.length || 1;
    const pWidth = 24;
    const oWidth = 13;
    const aWidth = Math.floor((100 - pWidth - oWidth) / n);

    const t12_2_header = [
      { text: 'Элемент сравнения / Поправка', bold: true, width: pWidth },
      { text: 'Объект оценки', bold: true, width: oWidth },
      ...result.rows.map(r => ({ text: `Аналог №${r.number}`, bold: true, width: aWidth })),
    ];

    const t12_2_rows = [
      t12_2_header,
      ['Адрес предложения', address, ...result.rows.map(r => r.address)],
      ['Цена предложения, руб.', 'Определяется', ...result.rows.map(r => money(r.price))],
      ['Общая площадь, кв.м', String(area), ...result.rows.map(r => String(r.area))],
      ['Цена за 1 кв.м до поправок', '—', ...result.rows.map(r => moneyPerSqm(r.initialPricePerSqm))],
      [`Поправка на торг (${percent(tradeAdj)})`, '—', ...result.rows.map(r => `${percent(tradeAdj)} → ${moneyPerSqm(r.priceAfterTrade)}`)],
      ['Поправка на отделку', finish, ...result.rows.map(r => `${percent(r.finishAdj)} → ${moneyPerSqm(r.priceAfterFinish)}`)],
      ['Поправка на этаж', `${floor}/${totalFloors}`, ...result.rows.map(r => `${r.floor}/${r.totalFloors} (${percent(r.floorAdj)}) → ${moneyPerSqm(r.priceAfterFloor)}`)],
      ['Поправка на масштаб площади', sqm(area), ...result.rows.map(r => `${percent(r.areaAdj)} → ${moneyPerSqm(r.finalAdjustedPrice)}`)],
      ['Число поправок (Ki)', '—', ...result.rows.map(r => String(r.correctionsCount))],
      ['Удельный вес аналога (Wi)', '—', ...result.rows.map(r => weightFmt(r.weight))],
    ];

    children.push(
      h2('7.2. Матрица сравнительного анализа и расчета корректировок (Таблица 12.2)'),
      createTable(t12_2_rows, { hasHeader: true, zebra: true, cellPaddingLeft: 60, cellPaddingRight: 60 })
    );

    // 7.3. Контроль качества выборки (Таблица 12.3)
    children.push(
      h2('7.3. Контроль качества выборки и анализ вариации (Таблица 12.3)'),
      createTable([
        [{ text: 'Показатель статистического анализа выборки', bold: true, width: 60 }, { text: 'Расчетное значение', bold: true, width: 40 }],
        ['Число объектов-аналогов в расчете (N)', String(result.selectedCount)],
        ['Среднее арифметическое значение цены 1 кв.м (Pср)', moneyPerSqm(result.meanPrice)],
        ['Стандартное среднеквадратическое отклонение (σ)', `±${result.stdDev} руб./м²`],
        ['Коэффициент вариации выборки (V)', `${result.variationCoeff != null ? result.variationCoeff.toFixed(2) + '%' : '—'}`],
        ['Критерий однородности выборки (ФСО № 7)', 'V ≤ 33,0%'],
        ['Статус статистического контроля', result.variationPass ? 'ТРЕБОВАНИЕ ВЫПОЛНЕНО: выборка признана однородной' : 'ВНИМАНИЕ: V > 33%'],
      ], { hasHeader: true, zebra: true })
    );
  }

  // 7.4. Итоговое согласование
  children.push(
    h2('7.4. Согласование результатов сравнительного подхода'),
    p(`Средневзвешенная стоимость 1 кв.м объекта оценки: ${moneyPerSqm(pricePerSqm)}`, { bold: true }),
    p(`Точная расчетная величина полной рыночной стоимости: ${money(result.rawTotal)} руб.`),
    p(`Итоговая рыночная стоимость полного права собственности (округленно до 1 000 руб.): ${money(totalValue)} руб.`, { bold: true, color: '1E3A8A' }),
    p(`Сумма прописью: ${totalWords} рублей.`, { bold: true, italics: true, color: '1E40AF' })
  );

  // -------------------------------------------------------------
  // 9. РАЗДЕЛ 8. РЕЕСТР ИСТОЧНИКОВ ИНФОРМАЦИИ
  // -------------------------------------------------------------
  children.push(
    h1('8. РЕЕСТР ИСТОЧНИКОВ ИНФОРМАЦИИ И ПРЕДЛОЖЕНИЙ'),
    p('При проведении оценки использована открытая информация баз данных недвижимости г. Тольятти:'),
    ...(result.rows || []).map(r =>
      p(`• Аналог №${r.number}: ${r.address}. Источник: ${r.source || 'База'} (${r.published || 'текущий период'}). Ссылка: ${r.url || 'зафиксирована в архиве дела'}.`)
    )
  );

  // -------------------------------------------------------------
  // 10. РАЗДЕЛ 9. ЗАКЛЮЧЕНИЕ ЭКСПЕРТА-ОЦЕНЩИКА
  // -------------------------------------------------------------
  children.push(
    h1('9. ЗАКЛЮЧЕНИЕ ЭКСПЕРТА-ОЦЕНЩИКА'),
    p(`На основании проведенного исследования, детального анализа рынка жилой недвижимости г. Тольятти и выполненных расчетов, рыночная стоимость объекта оценки — ${rooms}-комнатной квартиры общей площадью ${sqm(area)}, расположенной по адресу: ${address}, кадастровый номер ${cadNum}, по состоянию на дату оценки ${valDate} г. составляет:`),
    new Paragraph({
      children: [
        new TextRun({ text: money(totalValue), bold: true, size: 28, color: '1E3A8A', font: 'Calibri' }),
        new TextRun({ text: ` (${totalWords} рублей)`, bold: true, italics: true, size: 22, color: '1E40AF', font: 'Calibri' }),
      ],
      spacing: { before: 120, after: 240 },
    }),

    // Блок подписей
    new Table({
      width: { size: PAGE_CONTENT_WIDTH_DXA, type: WidthType.DXA },
      layout: TableLayoutType.FIXED,
      columnWidths: [4820, 4819],
      borders: {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
        insideHorizontal: { style: BorderStyle.NONE },
        insideVertical: { style: BorderStyle.NONE },
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 4820, type: WidthType.DXA },
              children: [
                p('Оценщик ООО «РусОценка»', { bold: true }),
                p('___________ / А.А. Орлова /'),
                p(`«${valDate.slice(8, 10)}» ${valDate.slice(5, 7)} ${valDate.slice(0, 4)} г.`),
              ],
            }),
            new TableCell({
              width: { size: 4819, type: WidthType.DXA },
              children: [
                p('Генеральный директор ООО «РусОценка»', { bold: true }),
                p('___________ / А.А. Орлова /'),
                p('М.П.'),
              ],
            }),
          ],
        }),
      ],
    }),

    // -------------------------------------------------------------
    // 11. ПРИЛОЖЕНИЯ К ОТЧЕТУ ОБ ОЦЕНКЕ
    // -------------------------------------------------------------
    h1('10. ПРИЛОЖЕНИЯ К ОТЧЕТУ ОБ ОЦЕНКЕ'),
    p('Приложение 1: Документы оценщика (квалификационный аттестат по оценке недвижимости, членство в СРО, полис САО «РЕСО-Гарантия» — подшито автоматически из базы).\n' +
      'Приложение 2: Правоустанавливающие документы заказчика (выписка из ЕГРН, технический план квартиры).\n' +
      'Приложение 3: Материалы открытых источников информации (скриншоты объявлений-аналогов с порталов Авито и Циан с фиксацией даты и URL).\n' +
      'Приложение 4 [ЗАПОЛНЯЕТСЯ ОЦЕНЩИКОМ]: Фототаблица натурного осмотра квартиры (фотографии комнат, кухни, санузла, коридора, фасада дома и подъезда).', { size: 19, color: '334155' })
  );

  // -------------------------------------------------------------
  // СОЗДАНИЕ ДОКУМЕНТА DOCX С КОЛОНТИТУЛАМИ
  // -------------------------------------------------------------
  const doc = new Document({
    creator: `${companyName} · Цифровое рабочее место оценщика`,
    title: `Отчет об оценке № ${reportNum}`,
    description: `Официальный отчет об оценке квартиры: ${address}`,
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 11906, // A4 portrait 210mm
              height: 16838, // 297mm
            },
            margin: {
              top: 1134, // 20 mm
              bottom: 1134, // 20 mm
              left: 1417, // 25 mm
              right: 850, // 15 mm
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: `Отчет об оценке № ${reportNum} · ООО «РусОценка»`, size: 16, color: '64748B', font: 'Calibri' }),
                ],
                alignment: AlignmentType.RIGHT,
                spacing: { after: 120 },
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: 'Страница ', size: 16, color: '64748B', font: 'Calibri' }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '64748B', font: 'Calibri' }),
                  new TextRun({ text: ' из ', size: 16, color: '64748B', font: 'Calibri' }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: '64748B', font: 'Calibri' }),
                ],
                alignment: AlignmentType.CENTER,
                spacing: { before: 120 },
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  const cleanNum = reportNum.replace(/[\/\\?%*:|"<>]/g, '_');
  const filename = `Отчет_об_оценке_№_${cleanNum}.docx`;

  if (typeof window !== 'undefined') {
    const blob = await Packer.toBlob(doc);
    download(blob, filename);
    return blob;
  } else {
    const nodeBuf = await Packer.toBuffer(doc);
    return nodeBuf;
  }
}
