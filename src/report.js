import JSZip from 'jszip';
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
 * Получение ArrayBuffer официального шаблона отчета (60 страниц, ООО «РусОценка»)
 */
async function getTemplateArrayBuffer() {
  if (typeof window === 'undefined') {
    // Окружение Node.js (для автоматических тестов)
    const fs = await import('fs');
    const path = await import('path');
    const templatePath = path.resolve('public/templates/rosocenka_apartment_template.docx');
    return fs.readFileSync(templatePath);
  } else {
    // Браузерное окружение
    const response = await fetch('/templates/rosocenka_apartment_template.docx');
    if (!response.ok) {
      throw new Error(`Не удалось загрузить официальный шаблон отчёта (HTTP ${response.status})`);
    }
    return await response.arrayBuffer();
  }
}

/**
 * Инъекция параметров дела и результатов расчётов в официальный 60-страничный документ
 */
export async function populateOfficialReport(templateBuffer, objectData, analogsList) {
  const result = calculateValuation(objectData, analogsList, objectData.tradeAdjustment);
  const zip = await JSZip.loadAsync(templateBuffer);
  let xml = await zip.file('word/document.xml').async('string');

  const reportNum = objectData.reportNumber || '19/0826-2';
  const cadNum = objectData.cadastralNumber || '63:09:0201045:5015';
  const clientName = objectData.client || 'Иванова Елена Ивановна';
  const valDate = objectData.valuationDate || '19.08.2026';

  const totalRounded = result.total;
  const totalNbsp = totalRounded.toLocaleString('ru-RU').replace(/\s/g, '\u00a0');
  const totalSpace = totalRounded.toLocaleString('ru-RU');
  const totalRaw = Math.round(result.weightedPricePerSqm * objectData.area);
  const totalRawNbsp = totalRaw.toLocaleString('ru-RU').replace(/\s/g, '\u00a0');
  const totalWords = numberToWordsRu(totalRounded);

  const priceSqmSpace = result.pricePerSqm.toLocaleString('ru-RU');
  const priceSqmNbsp = priceSqmSpace.replace(/\s/g, '\u00a0');

  // 1. Номер отчета / дела (Титул, разделы, таблицы)
  xml = xml.replaceAll('19/0826-2', reportNum);

  // 2. Кадастровый номер
  xml = xml.replaceAll('63:09:0201045:5015', cadNum);

  // 3. Заказчик оценки
  xml = xml.replaceAll('Иванова Елена Ивановна', clientName);

  // 4. Дата оценки
  if (valDate !== '19.08.2026') {
    xml = xml.replaceAll('19.08.2026', valDate);
  }

  // 5. Адрес объекта оценки
  if (objectData.address && objectData.address !== 'Самарская область, г. Тольятти, Комсомольский район, мкрн Поволжский, ул. Новосадовая, д. 1, кв. 49') {
    xml = xml.replaceAll('Самарская область, г. Тольятти, Комсомольский район, мкрн Поволжский, ул. Новосадовая, д. 1, кв. 49', objectData.address);
    xml = xml.replaceAll('Самарская область, г. Тольятти, Комсомольский район, ул. Новосадовая, д. 1, кв. 49', objectData.address);
  }

  // 6. Итоговые стоимости и суммы прописью (Титул, разд. 1, разд. 12, разд. 14, заключение)
  xml = xml.replaceAll('3\u00a0506 000', totalNbsp);
  xml = xml.replaceAll('3 506 000', totalSpace);
  xml = xml.replaceAll('3 505\u00a0597', totalRawNbsp);
  xml = xml.replaceAll('3 505 597', totalRaw.toLocaleString('ru-RU'));

  xml = xml.replaceAll('три миллиона пятьсот шесть тысяч', totalWords);

  // 7. Средневзвешенная цена 1 кв.м.
  xml = xml.replaceAll('52 479', priceSqmSpace);
  xml = xml.replaceAll('52\u00a0479', priceSqmNbsp);

  // 8. Статистика выборки (Таблица 12.3)
  if (result.variationCoeff !== undefined) {
    const varCoeffStr = result.variationCoeff.toFixed(2).replace('.', ',') + '%';
    xml = xml.replaceAll('4,09%', varCoeffStr);
  }
  if (result.meanPrice !== undefined) {
    xml = xml.replaceAll('52 525', result.meanPrice.toLocaleString('ru-RU'));
  }
  if (result.stdDev !== undefined) {
    xml = xml.replaceAll('2 150', result.stdDev.toLocaleString('ru-RU'));
  }

  // 9. Доли в праве общей собственности (Таблица 12.5 и Заключение)
  if (result.shares && result.shares.length >= 4) {
    const s1 = result.shares[0];
    const s3 = result.shares[2];

    if (s1) {
      xml = xml.replaceAll('1 468 000', s1.rounded.toLocaleString('ru-RU'));
      xml = xml.replaceAll('1\u00a0468 000', s1.rounded.toLocaleString('ru-RU').replace(/\s/g, '\u00a0'));
      xml = xml.replaceAll('1 467 805', Math.round(s1.nominal).toLocaleString('ru-RU'));
      xml = xml.replaceAll('один миллион четыреста шестьдесят восемь тысяч', numberToWordsRu(s1.rounded));
    }
    if (s3) {
      xml = xml.replaceAll('190 000', s3.rounded.toLocaleString('ru-RU'));
      xml = xml.replaceAll('190\u00a0000', s3.rounded.toLocaleString('ru-RU').replace(/\s/g, '\u00a0'));
      xml = xml.replaceAll('190 130', Math.round(s3.nominal).toLocaleString('ru-RU'));
      xml = xml.replaceAll('сто девяносто тысяч', numberToWordsRu(s3.rounded));
    }
  }

  // Сохраняем обновленный XML обратно в zip-архив docx
  zip.file('word/document.xml', xml);

  return zip;
}

/**
 * Экспорт полноценного 60-страничного отчета Word
 */
export async function exportApartmentReport(objectData, analogsList) {
  const templateBuffer = await getTemplateArrayBuffer();
  const zip = await populateOfficialReport(templateBuffer, objectData, analogsList);

  const reportNum = objectData.reportNumber || '19/0826-2';
  const cleanNum = reportNum.replace(/[\/\\?%*:|"<>]/g, '_');
  const filename = `Отчет_об_оценке_№_${cleanNum}.docx`;

  if (typeof window !== 'undefined') {
    const blob = await zip.generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });
    download(blob, filename);
    return blob;
  } else {
    // Окружение тестов
    const nodeBuf = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    });
    return nodeBuf;
  }
}
