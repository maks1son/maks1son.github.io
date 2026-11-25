import JSZip from 'jszip';
import { calculateValuation } from './model.js';

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

const fmtNum = n => (n == null || !Number.isFinite(n) ? '—' : new Intl.NumberFormat('ru-RU').format(Math.round(n)));
const fmtDec1 = n => (n == null || !Number.isFinite(n) ? '—' : Number(n).toFixed(1).replace('.', ','));
const fmtPct2 = n => (n == null || !Number.isFinite(n) ? '0,00%' : `${Number(n).toFixed(2).replace('.', ',')}%`);

function formatDateRu(isoDate) {
  if (!isoDate) return '—';
  const m = String(isoDate).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}.${m[2]}.${m[1]}`;
  return String(isoDate);
}

function formatMonthYearRu(isoDate) {
  const months = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
  const m = String(isoDate || '').match(/^(\d{4})-(\d{2})/);
  if (!m) return 'текущий месяц';
  const idx = parseInt(m[2], 10) - 1;
  return `${months[idx] || 'август'} ${m[1]}г.`;
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function unescapeXml(str) {
  return String(str)
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
}

/**
 * Заменяет текст внутри <w:p>, сохраняя <w:rPr> форматирование каждого run,
 * даже если Word разбил искомую фразу на несколько <w:t> тегов.
 */
function replaceInParagraphXml(pXml, replacements) {
  const tRegex = /<w:t(?:\s+[^>]*)?>([\s\S]*?)<\/w:t>/g;
  const runs = [];
  let match;
  while ((match = tRegex.exec(pXml)) !== null) {
    runs.push({
      fullMatchStart: match.index,
      fullMatchEnd: match.index + match[0].length,
      text: unescapeXml(match[1]),
    });
  }
  if (!runs.length) return pXml;

  let fullText = runs.map(r => r.text).join('');
  let changed = false;

  for (const [search, replaceWith] of replacements) {
    if (!search || search === replaceWith) continue;
    let startIdx = 0;
    while (true) {
      const idx = fullText.indexOf(search, startIdx);
      if (idx === -1) break;
      changed = true;

      const endIdx = idx + search.length;
      let cursor = 0;
      for (let i = 0; i < runs.length; i++) {
        const rLen = runs[i].text.length;
        const rStart = cursor;
        const rEnd = cursor + rLen;
        cursor = rEnd;

        if (rEnd <= idx || rStart >= endIdx) continue;

        const overlapStart = Math.max(0, idx - rStart);
        const overlapEnd = Math.min(rLen, endIdx - rStart);
        const prefix = runs[i].text.slice(0, overlapStart);
        const suffix = runs[i].text.slice(overlapEnd);

        if (rStart <= idx && idx < rEnd) {
          runs[i].text = prefix + replaceWith + suffix;
        } else {
          runs[i].text = prefix + suffix;
        }
      }
      fullText = runs.map(r => r.text).join('');
      startIdx = idx + replaceWith.length;
    }
  }

  if (!changed) return pXml;

  let out = '';
  let lastPos = 0;
  for (const r of runs) {
    out += pXml.slice(lastPos, r.fullMatchStart);
    out += `<w:t xml:space="preserve">${escapeXml(r.text)}</w:t>`;
    lastPos = r.fullMatchEnd;
  }
  out += pXml.slice(lastPos);
  return out;
}

function replaceInAllParagraphs(xml, replacements) {
  return xml.replace(/<w:p(?:\s+[^>]*)?>[\s\S]*?<\/w:p>/g, pXml => replaceInParagraphXml(pXml, replacements));
}

/**
 * Извлекает строки <w:tr> и ячейки <w:tc>, позволяя менять текст ячейки
 * с сохранением всех стилей (шрифт, размер, цвет, границы, выравнивание).
 */
function setCellText(tcXml, newText) {
  const tcPrMatch = tcXml.match(/<w:tcPr>[\s\S]*?<\/w:tcPr>/);
  const pMatch = tcXml.match(/<w:p(?:\s+[^>]*)?>[\s\S]*?<\/w:p>/);
  const pPrMatch = pMatch ? pMatch[0].match(/<w:pPr>[\s\S]*?<\/w:pPr>/) : null;
  const rPrMatch = pMatch ? pMatch[0].match(/<w:rPr>[\s\S]*?<\/w:rPr>/) : null;

  const tcPr = tcPrMatch ? tcPrMatch[0] : '';
  const pPr = pPrMatch ? pPrMatch[0] : '';
  const rPr = rPrMatch ? rPrMatch[0] : '';

  return `<w:tc>${tcPr}<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(newText)}</w:t></w:r></w:p></w:tc>`;
}

function splitRows(tblXml) {
  return tblXml.match(/<w:tr(?:\s+[^>]*)?>[\s\S]*?<\/w:tr>/g) || [];
}

function splitCells(trXml) {
  return trXml.match(/<w:tc(?:\s+[^>]*)?>[\s\S]*?<\/w:tc>/g) || [];
}

function replaceRowCells(trXml, updater) {
  const cells = splitCells(trXml);
  const newCells = updater(cells);
  let idx = 0;
  return trXml.replace(/<w:tc(?:\s+[^>]*)?>[\s\S]*?<\/w:tc>/g, () => newCells[idx++] || '');
}

function patchTableByIndex(xml, targetIndex, patchFn) {
  let current = 0;
  return xml.replace(/<w:tbl(?:\s+[^>]*)?>[\s\S]*?<\/w:tbl>/g, tblXml => {
    if (current++ !== targetIndex) return tblXml;
    const rows = splitRows(tblXml);
    const updatedRows = patchFn(rows);
    const firstTr = tblXml.indexOf('<w:tr');
    const lastTrEnd = tblXml.lastIndexOf('</w:tr>') + '</w:tr>'.length;
    if (firstTr === -1 || lastTrEnd < '</w:tr>'.length) return tblXml;
    return tblXml.slice(0, firstTr) + updatedRows.join('') + tblXml.slice(lastTrEnd);
  });
}

async function loadTemplateBuffer() {
  if (typeof window !== 'undefined' && typeof fetch === 'function') {
    const res = await fetch('/templates/rosocenka_apartment_template.docx');
    if (!res.ok) {
      throw new Error(`Не удалось загрузить фирменный шаблон отчёта (${res.status})`);
    }
    return await res.arrayBuffer();
  }
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const templatePath = path.resolve(__dirname, '../public/templates/rosocenka_apartment_template.docx');
  return fs.readFileSync(templatePath);
}

/**
 * Генерация официального Word-отчёта 1-в-1 по фирменному шаблону ООО «РусОценка»
 * Сохраняет все фоны, изображения, шрифты, размеры текста, колонтитулы и стили оригинала.
 */
export async function exportApartmentReport(objectData, analogsList) {
  const templateBuffer = await loadTemplateBuffer();
  const zip = await JSZip.loadAsync(templateBuffer);
  let xml = await zip.file('word/document.xml').async('string');

  // Убираем маркеры проверки орфографии Word, чтобы не дробились строки
  xml = xml.replace(/<w:proofErr[^>]*\/>/g, '');

  const tradeAdj = objectData.tradeAdjustment != null ? objectData.tradeAdjustment : -6.0;
  const result = calculateValuation(objectData, analogsList, tradeAdj);

  const reportNum = objectData.reportNumber || '19/0826-2';
  const valDateIso = objectData.valuationDate || new Date().toISOString().slice(0, 10);
  const repDateIso = objectData.reportDate || valDateIso;
  const valDateRu = formatDateRu(valDateIso);
  const repDateRu = formatDateRu(repDateIso);
  const repMonthYear = formatMonthYearRu(valDateIso);

  const clientName = objectData.client || 'Не указан';
  const appraiserName = objectData.appraiser || 'Орлова Анна Александровна';
  const companyName = objectData.company || 'ООО «РусОценка»';
  const address = objectData.address || 'Адрес не указан';
  const shortAddress = address.replace(/^.*?(ул\.|пр-т|б-р|пр\.|пер\.)/i, '$1');
  const cadNum = objectData.cadastralNumber || 'Не указан';
  const area = Number(objectData.area) || 0;
  const areaStr = fmtDec1(area);
  const rooms = objectData.rooms || 1;
  const floor = objectData.floor || 1;
  const totalFloors = objectData.totalFloors || 1;
  const floorStr = `${floor}/${totalFloors}`;
  const wallMaterial = objectData.wallMaterial || 'панель';
  const finish = objectData.finish || 'улучшенная';
  const condition = objectData.condition || 'хорошее';
  const balcony = objectData.balcony || 'да';
  const furniture = objectData.furniture || 'да';
  const purpose = objectData.purpose || 'Определение рыночной стоимости для совершения сделки купли-продажи (ст. 30 ГК РФ)';

  const totalValue = result.total || 0;
  const rawTotal = Math.round(result.rawTotal || totalValue);
  const totalWords = numberToWordsRu(totalValue);
  const pricePerSqm = result.pricePerSqm || 0;
  const selectedRows = result.rows || [];
  const allAnalogs = analogsList || [];

  const shares = result.shares || [];
  const sharesOwnershipType = shares.length > 1 ? 'общая долевая собственность' : 'индивидуальная собственность';
  const sharesText = shares.map(s => `${s.holder} (доля ${s.shareFraction})`).join(', ');

  // 1. Таблицы 2 и 24: Итоговая величина рыночной стоимости + доли
  const patchSummaryTable = rows => {
    if (rows.length < 3) return rows;
    const header = rows[0];
    const fullPropRow = replaceRowCells(rows[1], cells => {
      cells[1] = setCellText(cells[1], `Жилое помещение (${rooms}-комнатная квартира) с кадастровым номером ${cadNum}, общей площадью ${areaStr} кв.м., расположенное по адресу: ${address}`);
      cells[2] = setCellText(cells[2], `${fmtNum(totalValue)} (${totalWords}) рублей`);
      return cells;
    });
    const shareTemplate = rows[2];
    const shareRows = shares.map((sh, idx) =>
      replaceRowCells(shareTemplate, cells => {
        cells[0] = setCellText(cells[0], String(idx + 2));
        cells[1] = setCellText(cells[1], `${sh.shareFraction} доли в праве собственности (${sh.holder}) на жилое помещение (квартиру) с кадастровым номером ${cadNum}`);
        cells[2] = setCellText(cells[2], `${fmtNum(sh.rounded)} (${numberToWordsRu(sh.rounded)}) рублей`);
        return cells;
      })
    );
    return [header, fullPropRow, ...shareRows];
  };
  xml = patchTableByIndex(xml, 2, patchSummaryTable);
  xml = patchTableByIndex(xml, 24, patchSummaryTable);

  // 2. Таблица 13: Имущественные права ЕГРН
  xml = patchTableByIndex(xml, 13, rows => {
    if (rows[3]) {
      rows[3] = replaceRowCells(rows[3], cells => {
        cells[1] = setCellText(cells[1], `Имущественные права на объект оценки – ${sharesOwnershipType}. Правообладатели: ${sharesText}.`);
        return cells;
      });
    }
    return rows;
  });

  // 3. Таблица 15 (Таблица 12.1): Выборка рыночных аналогов
  xml = patchTableByIndex(xml, 15, rows => {
    if (rows.length < 2) return rows;
    const header = rows[0];
    const rowTemplate = rows[5] || rows[1];
    const sourceAnalogs = allAnalogs.length ? allAnalogs : selectedRows;
    const analogRows = sourceAnalogs.map((a, idx) =>
      replaceRowCells(rowTemplate, cells => {
        const pSqm = a.area ? Math.round(a.price / a.area) : 0;
        cells[0] = setCellText(cells[0], String(idx + 1));
        cells[1] = setCellText(cells[1], 'жилое помещение (квартира)');
        cells[2] = setCellText(cells[2], '—');
        cells[3] = setCellText(cells[3], a.address || '');
        cells[4] = setCellText(cells[4], `${a.floor}/${a.totalFloors}`);
        cells[5] = setCellText(cells[5], fmtDec1(a.area));
        cells[6] = setCellText(cells[6], fmtNum(a.price));
        cells[7] = setCellText(cells[7], fmtNum(pSqm));
        cells[8] = setCellText(cells[8], a.url || a.source || 'Открытый рынок');
        return cells;
      })
    );
    return [header, ...analogRows];
  });

  // Вспомогательная функция заполнения 5 колонок аналогов
  const fillAnalogCol = (cells, startCol, getVal) => {
    for (let i = 0; i < 5; i++) {
      const col = startCol + i;
      if (col < cells.length) {
        const r = selectedRows[i];
        cells[col] = setCellText(cells[col], r ? getVal(r, i) : '—');
      }
    }
  };

  // 4. Таблица 18: Элементы сравнения
  xml = patchTableByIndex(xml, 18, rows => {
    const mapObj = {
      3: `${valDateRu}г.`,
      5: sharesOwnershipType,
      6: address,
      7: finish,
      8: floorStr,
      9: areaStr,
      10: balcony,
      11: wallMaterial,
      12: furniture,
      13: condition,
    };
    const mapAn = {
      3: r => r.published || repMonthYear,
      5: () => 'собственность',
      6: r => r.address || '—',
      7: r => r.finish || '—',
      8: r => `${r.floor}/${r.totalFloors}`,
      9: r => fmtDec1(r.area),
      10: r => r.balcony || 'да',
      11: r => r.wallMaterial || wallMaterial,
      12: r => r.furniture || 'да',
      13: r => r.condition || 'хорошее',
      14: r => fmtNum(r.price),
      15: r => fmtNum(r.initialPricePerSqm),
      16: r => r.url || r.source || '—',
    };
    return rows.map((tr, rIdx) => {
      if (!mapObj[rIdx] && !mapAn[rIdx]) return tr;
      return replaceRowCells(tr, cells => {
        if (mapObj[rIdx] && cells[2]) cells[2] = setCellText(cells[2], mapObj[rIdx]);
        if (mapAn[rIdx]) fillAnalogCol(cells, 3, mapAn[rIdx]);
        return cells;
      });
    });
  });

  // 5. Таблица 19 (Таблица 12.2): Матрица корректировок Лейфера
  xml = patchTableByIndex(xml, 19, rows => {
    return rows.map((tr, rIdx) => {
      const cells = splitCells(tr);
      if (rIdx === 42) {
        return replaceRowCells(tr, c => {
          if (c[2]) c[2] = setCellText(c[2], fmtNum(pricePerSqm));
          return c;
        });
      }
      if (rIdx === 43) {
        return replaceRowCells(tr, c => {
          if (c[2]) c[2] = setCellText(c[2], `${fmtNum(rawTotal)}\nОкругленно ${fmtNum(totalValue)}`);
          return c;
        });
      }
      if (cells.length >= 8) {
        return replaceRowCells(tr, c => {
          // Объект оценки (col 2)
          if (rIdx === 2) c[2] = setCellText(c[2], areaStr);
          if (rIdx === 6) c[2] = setCellText(c[2], `${valDateRu}г.`);
          if (rIdx === 9) c[2] = setCellText(c[2], sharesOwnershipType);
          if (rIdx === 15) c[2] = setCellText(c[2], address);
          if (rIdx === 18) c[2] = setCellText(c[2], finish);
          if (rIdx === 21) c[2] = setCellText(c[2], wallMaterial);
          if (rIdx === 24) c[2] = setCellText(c[2], furniture);
          if (rIdx === 27) c[2] = setCellText(c[2], floorStr);
          if (rIdx === 30) c[2] = setCellText(c[2], areaStr);
          if (rIdx === 33) c[2] = setCellText(c[2], condition);
          if (rIdx === 36) c[2] = setCellText(c[2], balcony);

          // Аналоги (cols 3..7)
          const anMap = {
            1: r => fmtNum(r.price),
            2: r => fmtDec1(r.area),
            3: r => fmtNum(r.initialPricePerSqm),
            4: r => fmtPct2(r.tradeAdjustment),
            5: r => fmtNum(r.priceAfterTrade),
            6: r => r.published || repMonthYear,
            8: r => fmtNum(r.priceAfterTrade),
            9: () => 'собственность',
            11: r => fmtNum(r.priceAfterTrade),
            14: r => fmtNum(r.priceAfterTrade),
            15: r => r.address || '—',
            17: r => fmtNum(r.priceAfterTrade),
            18: r => r.finish || '—',
            19: r => fmtPct2(r.finishAdj),
            20: r => fmtNum(r.priceAfterFinish),
            21: r => r.wallMaterial || wallMaterial,
            23: r => fmtNum(r.priceAfterFinish),
            24: r => r.furniture || 'да',
            26: r => fmtNum(r.priceAfterFinish),
            27: r => `${r.floor}/${r.totalFloors}`,
            28: r => fmtPct2(r.floorAdj),
            29: r => fmtNum(r.priceAfterFloor),
            30: r => fmtDec1(r.area),
            31: r => fmtPct2(r.areaAdj),
            32: r => fmtNum(r.finalAdjustedPrice),
            33: r => r.condition || 'хорошее',
            35: r => fmtNum(r.finalAdjustedPrice),
            36: r => r.balcony || 'да',
            38: r => fmtNum(r.finalAdjustedPrice),
            40: r => String(r.correctionsCount),
            41: r => r.weight.toFixed(4).replace('.', ','),
          };
          if (anMap[rIdx]) fillAnalogCol(c, 3, anMap[rIdx]);
          return c;
        });
      }
      return tr;
    });
  });

  // 6. Таблица 20: Поправка на масштаб площади
  xml = patchTableByIndex(xml, 20, rows =>
    rows.map((tr, rIdx) =>
      replaceRowCells(tr, c => {
        if (rIdx === 1) {
          c[1] = setCellText(c[1], areaStr);
          fillAnalogCol(c, 2, r => fmtDec1(r.area));
        } else if (rIdx === 2) {
          c[1] = setCellText(c[1], area > 0 ? Math.pow(area, -0.10).toFixed(4).replace('.', ',') : '—');
          fillAnalogCol(c, 2, r => Math.pow(r.area, -0.10).toFixed(4).replace('.', ','));
        } else if (rIdx === 3) {
          fillAnalogCol(c, 2, r => fmtPct2(r.areaAdj));
        }
        return c;
      })
    )
  );

  // 7. Таблица 21 (Таблица 22): Статистика вариации
  xml = patchTableByIndex(xml, 21, rows =>
    rows.map((tr, rIdx) =>
      replaceRowCells(tr, c => {
        if (rIdx === 1) fillAnalogCol(c, 1, r => fmtNum(r.finalAdjustedPrice));
        if (rIdx === 2 && c[1]) c[1] = setCellText(c[1], fmtNum(result.meanPrice || pricePerSqm));
        if (rIdx === 3 && c[1]) c[1] = setCellText(c[1], fmtNum(result.stdDev || 0));
        if (rIdx === 4 && c[1]) c[1] = setCellText(c[1], fmtPct2(result.variationCoeff || 0));
        return c;
      })
    )
  );

  // 8. Таблица 22: Расчёт стоимости долей
  xml = patchTableByIndex(xml, 22, rows =>
    rows.map((tr, rIdx) => {
      if (rIdx === 0) return tr;
      return replaceRowCells(tr, c => {
        for (let i = 0; i < 5; i++) {
          const col = i + 1;
          if (col >= c.length) continue;
          const sh = shares[i];
          if (!sh) {
            c[col] = setCellText(c[col], '—');
          } else if (rIdx === 1) {
            c[col] = setCellText(c[col], fmtNum(totalValue));
          } else if (rIdx === 2) {
            c[col] = setCellText(c[col], sh.shareFraction);
          } else if (rIdx === 3 || rIdx === 5) {
            c[col] = setCellText(c[col], fmtNum(sh.nominal));
          } else if (rIdx === 4) {
            c[col] = setCellText(c[col], '0%');
          } else if (rIdx === 6) {
            c[col] = setCellText(c[col], fmtNum(sh.rounded));
          }
        }
        return c;
      });
    })
  );

  // 9. Глобальная замена текстовых вхождений во всех абзацах документа
  const globalReplacements = [
    ['19/0826-2', reportNum],
    ['19.08.2026', valDateRu],
    ['20.08.2026', repDateRu],
    ['Иванова Елена Ивановна', clientName],
    ['Ивановой Елене Ивановне', clientName],
    ['Ивановой Елены Ивановны', clientName],
    ['Разрезов Александр Михайлович', shares[1]?.holder || clientName],
    ['Разрезов Дмитрий Александрович', shares[2]?.holder || clientName],
    ['Разрезова Ксения Александровна', shares[3]?.holder || clientName],
    ['Матвеев Максим Антонович', shares[4]?.holder || clientName],
    ['Разрезов', clientName.split(' ')[0] || clientName],
    ['63:09:0201045:5015', cadNum],
    ['г. Тольятти, Комсомольский район, мкрн Поволжский, ул. Новосадовая, д. 1, кв. 49', address],
    ['Самарская область, г. Тольятти, Комсомольский район, ул. Новосадовая, д. 1, кв. 49', address],
    ['ул. Новосадовая, д. 1, кв. 49', shortAddress],
    ['66,8', areaStr],
    ['3-комнатная', `${rooms}-комнатная`],
    ['3-комнатных', `${rooms}-комнатных`],
    ['3-х комнатной', `${rooms}-комнатной`],
    ['3 506 000', fmtNum(totalValue)],
    ['3\u00a0506\u00a0000', fmtNum(totalValue)],
    ['3 505 597', fmtNum(rawTotal)],
    ['3\u00a0505\u00a0597', fmtNum(rawTotal)],
    ['три миллиона пятьсот шесть тысяч', totalWords],
    ['52 479', fmtNum(pricePerSqm)],
    ['52\u00a0479', fmtNum(pricePerSqm)],
    ['Определение рыночной стоимости для совершения сделки купли-продажи', purpose],
    ['Орлова Анна Александровна', appraiserName],
    ['ООО «РусОценка»', companyName],
  ];

  xml = replaceInAllParagraphs(xml, globalReplacements);
  zip.file('word/document.xml', xml);

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Отчет_об_оценке_№_${reportNum.replace(/[^\wа-яА-ЯёЁ-]/g, '_')}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return blob;
  } else {
    return await zip.generateAsync({ type: 'nodebuffer' });
  }
}
