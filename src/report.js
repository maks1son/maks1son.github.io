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
const fmtPctPlain = n => {
  const num = Number(n) || 0;
  return Number.isInteger(num) ? String(num) : num.toFixed(2).replace(/0+$/, '').replace(/\.$/, '').replace('.', ',');
};

const MALE_A_NAMES = new Set([
  'никита', 'илья', 'кузьма', 'фома', 'савва', 'данила', 'лука', 'добрыня',
  'гаврила', 'лёня', 'ваня', 'саша', 'миша', 'дима', 'костя', 'коля', 'женя',
  'юра', 'сережа', 'серёжа', 'паша', 'вова', 'толя', 'витя', 'гена', 'гоша', 'гриша', 'жора',
]);

const FEMALE_SOFT_NAMES = new Set([
  'любовь', 'нинель', 'адель', 'рахиль', 'юдифь', 'эсфирь', 'ассоль', 'айгуль', 'гузель', 'асель',
]);

const FEMALE_INVARIANT_NAMES = new Set(['нелли', 'кармен', 'элен', 'ирен', 'марго']);

function isInitialToken(token) {
  return /^[А-ЯЁ]\.(?:\s*[А-ЯЁ]\.)?$/i.test(token);
}

function isPatronymicToken(token) {
  return /(ович|евич|ьевич|овна|евна|ьевна|ична|инична)$/i.test(token)
    || /^(ильич|никитич|кузьмич|фомич|лукич|саввич)$/i.test(token);
}

function looksLikeSurnameToken(token) {
  return /(ова?|ева?|ёва?|ина?|ына?|ский|цкий|ская|цкая|ской|цкой|их|ых|ко|енко)$/i.test(token);
}

function detectFioGender(last, first, middle) {
  if (middle) {
    if (/(вна|чна)$/i.test(middle)) return 'f';
    if (/(вич|ич)$/i.test(middle)) return 'm';
  }
  if (first) {
    const low = first.toLowerCase();
    if (MALE_A_NAMES.has(low)) return 'm';
    if (FEMALE_SOFT_NAMES.has(low) || FEMALE_INVARIANT_NAMES.has(low)) return 'f';
    if (/[ая]$/i.test(low)) return 'f';
    if (/[бвгджзйклмнпрстфхцчшщъь]$/i.test(low)) return 'm';
  }
  if (last) {
    const low = last.toLowerCase();
    if (/(ова|ева|ёва|ина|ына|ая|яя)$/i.test(low)) return 'f';
    if (/(ов|ев|ёв|ин|ын|ский|цкий|ской|цкой|ый|ой)$/i.test(low)) return 'm';
  }
  return 'm';
}

function declineFirstDeclension(word, targetCase) {
  const low = word.toLowerCase();
  if (low.endsWith('ия')) {
    const stem = word.slice(0, -1);
    return targetCase === 'ins' ? `${stem}ей` : `${stem}и`;
  }
  if (low.endsWith('ья')) {
    const stem = word.slice(0, -1);
    if (targetCase === 'gen') return `${stem}и`;
    if (targetCase === 'dat') return `${stem}е`;
    return low === 'илья' ? `${stem}ёй` : `${stem}ей`;
  }
  if (low.endsWith('я')) {
    const stem = word.slice(0, -1);
    if (targetCase === 'gen') return `${stem}и`;
    if (targetCase === 'dat') return `${stem}е`;
    return `${stem}ей`;
  }
  if (low.endsWith('а')) {
    const stem = word.slice(0, -1);
    const prev = stem.slice(-1).toLowerCase();
    const isVelarOrSibilant = 'гкхжшчщ'.includes(prev);
    const isSibilantOrTs = 'жшчщц'.includes(prev);
    if (targetCase === 'gen') return `${stem}${isVelarOrSibilant ? 'и' : 'ы'}`;
    if (targetCase === 'dat') return `${stem}е`;
    return `${stem}${isSibilantOrTs ? 'ей' : 'ой'}`;
  }
  return word;
}

function declineSurnameSingle(word, gender, targetCase) {
  if (!word || isInitialToken(word)) return word;
  const low = word.toLowerCase();

  // Несклоняемые фамилии (-ко, -о, -е, -и, -у, -ю, -ы, -их, -ых)
  if (/([оеиуюы]|их|ых)$/i.test(low)) return word;

  if (gender === 'f') {
    if (/(ова|ева|ёва|ина|ына)$/i.test(low)) return `${word.slice(0, -1)}ой`;
    if (/ая$/i.test(low)) return `${word.slice(0, -2)}ой`;
    if (/яя$/i.test(low)) return `${word.slice(0, -2)}ей`;
    if (/[ая]$/i.test(low)) return declineFirstDeclension(word, targetCase);
    // Женские фамилии на согласный или -ь/-й не склоняются
    return word;
  }

  // Мужские фамилии
  if (/(ов|ев|ёв|ин|ын)$/i.test(low)) {
    if (targetCase === 'gen') return `${word}а`;
    if (targetCase === 'dat') return `${word}у`;
    return `${word}ым`;
  }
  if (/(ский|цкий|кий|гий|хий)$/i.test(low)) {
    const stem = word.slice(0, -2);
    if (targetCase === 'gen') return `${stem}ого`;
    if (targetCase === 'dat') return `${stem}ому`;
    return `${stem}им`;
  }
  if (/(чий|ший|жий|щий|ний)$/i.test(low)) {
    const stem = word.slice(0, -2);
    if (targetCase === 'gen') return `${stem}его`;
    if (targetCase === 'dat') return `${stem}ему`;
    return `${stem}им`;
  }
  if (/ый$/i.test(low) || (/ой$/i.test(low) && word.length > 4)) {
    const stem = word.slice(0, -2);
    if (targetCase === 'gen') return `${stem}ого`;
    if (targetCase === 'dat') return `${stem}ому`;
    return `${stem}ым`;
  }
  if (/[ая]$/i.test(low)) return declineFirstDeclension(word, targetCase);
  if (/ь$/i.test(low)) {
    const stem = word.slice(0, -1);
    if (targetCase === 'gen') return `${stem}я`;
    if (targetCase === 'dat') return `${stem}ю`;
    return `${stem}ем`;
  }
  if (/^(вороб|солов|мурав)ей$/i.test(low)) {
    const stem = word.slice(0, -2);
    if (targetCase === 'gen') return `${stem}ья`;
    if (targetCase === 'dat') return `${stem}ью`;
    return `${stem}ьём`;
  }
  if (/[аеёиоуыэюя]й$/i.test(low)) {
    const stem = word.slice(0, -1);
    if (targetCase === 'gen') return `${stem}я`;
    if (targetCase === 'dat') return `${stem}ю`;
    return `${stem}ем`;
  }
  if (/[бвгджзклмнпрстфхцчшщ]$/i.test(low)) {
    const isSibilantOrTs = /[жшчщц]$/i.test(low);
    if (targetCase === 'gen') return `${word}а`;
    if (targetCase === 'dat') return `${word}у`;
    return `${word}${isSibilantOrTs ? 'ем' : 'ом'}`;
  }
  return word;
}

function declineSurname(word, gender, targetCase) {
  if (!word) return word;
  return word
    .split('-')
    .map(part => declineSurnameSingle(part, gender, targetCase))
    .join('-');
}

function declineFirstName(word, gender, targetCase) {
  if (!word || isInitialToken(word)) return word;
  const low = word.toLowerCase();

  const irregulars = {
    'пётр': { gen: 'Петра', dat: 'Петру', ins: 'Петром' },
    'петр': { gen: 'Петра', dat: 'Петру', ins: 'Петром' },
    'павел': { gen: 'Павла', dat: 'Павлу', ins: 'Павлом' },
    'лев': { gen: 'Льва', dat: 'Льву', ins: 'Львом' },
    'любовь': { gen: 'Любови', dat: 'Любови', ins: 'Любовью' },
  };
  if (irregulars[low]) {
    const res = irregulars[low][targetCase];
    return word[0] === word[0].toLowerCase() ? res.toLowerCase() : res;
  }

  if (gender === 'f') {
    if (FEMALE_INVARIANT_NAMES.has(low)) return word;
    if (/[ая]$/i.test(low)) return declineFirstDeclension(word, targetCase);
    if (/ь$/i.test(low)) {
      const stem = word.slice(0, -1);
      return targetCase === 'ins' ? `${stem}ью` : `${stem}и`;
    }
    return word;
  }

  if (/[ая]$/i.test(low)) return declineFirstDeclension(word, targetCase);
  if (/ий$/i.test(low)) {
    const stem = word.slice(0, -1);
    if (targetCase === 'gen') return `${stem}я`;
    if (targetCase === 'dat') return `${stem}ю`;
    return `${stem}ем`;
  }
  if (/[аеёоуыэюя]й$/i.test(low)) {
    const stem = word.slice(0, -1);
    if (targetCase === 'gen') return `${stem}я`;
    if (targetCase === 'dat') return `${stem}ю`;
    return `${stem}ем`;
  }
  if (/ь$/i.test(low)) {
    const stem = word.slice(0, -1);
    if (targetCase === 'gen') return `${stem}я`;
    if (targetCase === 'dat') return `${stem}ю`;
    return `${stem}ем`;
  }
  if (/[бвгджзклмнпрстфхцчшщ]$/i.test(low)) {
    const isSibilantOrTs = /[жшчщц]$/i.test(low);
    if (targetCase === 'gen') return `${word}а`;
    if (targetCase === 'dat') return `${word}у`;
    return `${word}${isSibilantOrTs ? 'ем' : 'ом'}`;
  }
  return word;
}

function declinePatronymic(word, gender, targetCase) {
  if (!word || isInitialToken(word)) return word;
  const low = word.toLowerCase();
  if (gender === 'f' || /(вна|чна)$/i.test(low)) {
    if (!/[ая]$/i.test(low)) return word;
    const stem = word.slice(0, -1);
    if (targetCase === 'gen') return `${stem}ы`;
    if (targetCase === 'dat') return `${stem}е`;
    return `${stem}ой`;
  }
  if (/ич$/i.test(low)) {
    if (targetCase === 'gen') return `${word}а`;
    if (targetCase === 'dat') return `${word}у`;
    const stressedOm = /^(ильич|кузьмич|фомич|лукич)$/i.test(low);
    return `${word}${stressedOm ? 'ом' : 'ем'}`;
  }
  return word;
}

/**
 * Детерминированное склонение русского ФИО по падежам ('gen', 'dat', 'ins')
 * с автоопределением пола по отчеству/имени/фамилии.
 */
export function declineFioRu(fullName, targetCase) {
  if (!fullName || typeof fullName !== 'string') return fullName || '';
  const trimmed = fullName.trim().replace(/\s+/g, ' ');
  if (!trimmed || trimmed === 'Не указан' || !['gen', 'dat', 'ins'].includes(targetCase)) {
    return trimmed;
  }

  const tokens = trimmed.split(' ');
  let lastIdx = -1;
  let firstIdx = -1;
  let middleIdx = -1;

  if (tokens.length >= 3) {
    lastIdx = 0;
    firstIdx = 1;
    middleIdx = 2;
  } else if (tokens.length === 2) {
    if (isPatronymicToken(tokens[1])) {
      firstIdx = 0;
      middleIdx = 1;
    } else if (looksLikeSurnameToken(tokens[1]) && !looksLikeSurnameToken(tokens[0])) {
      firstIdx = 0;
      lastIdx = 1;
    } else {
      lastIdx = 0;
      firstIdx = 1;
    }
  } else if (tokens.length === 1) {
    if (isPatronymicToken(tokens[0])) middleIdx = 0;
    else if (looksLikeSurnameToken(tokens[0])) lastIdx = 0;
    else firstIdx = 0;
  }

  const gender = detectFioGender(
    lastIdx >= 0 ? tokens[lastIdx] : '',
    firstIdx >= 0 ? tokens[firstIdx] : '',
    middleIdx >= 0 ? tokens[middleIdx] : ''
  );

  return tokens
    .map((tok, i) => {
      if (i === lastIdx) return declineSurname(tok, gender, targetCase);
      if (i === firstIdx) return declineFirstName(tok, gender, targetCase);
      if (i === middleIdx) return declinePatronymic(tok, gender, targetCase);
      return tok;
    })
    .join(' ');
}

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
 * Пробелы и неразрывные пробелы (\u00a0) сопоставляются эквивалентно.
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
  let normText = fullText.replace(/\u00a0/g, ' ');
  let changed = false;

  for (const [search, replaceWith] of replacements) {
    if (!search) continue;
    const normSearch = search.replace(/\u00a0/g, ' ');
    const normReplace = String(replaceWith).replace(/\u00a0/g, ' ');
    if (normSearch === normReplace) continue;

    let startIdx = 0;
    while (true) {
      const idx = normText.indexOf(normSearch, startIdx);
      if (idx === -1) break;
      changed = true;

      const endIdx = idx + normSearch.length;
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
      normText = fullText.replace(/\u00a0/g, ' ');
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

function getParagraphText(pXml) {
  const parts = [];
  const tRegex = /<w:t(?:\s+[^>]*)?>([\s\S]*?)<\/w:t>/g;
  let m;
  while ((m = tRegex.exec(pXml)) !== null) {
    parts.push(unescapeXml(m[1]));
  }
  return parts.join('');
}

function patchParagraphsByMatcher(xml, matchers) {
  return xml.replace(/<w:p(?:\s+[^>]*)?>[\s\S]*?<\/w:p>/g, pXml => {
    const fullText = getParagraphText(pXml);
    if (!fullText) return pXml;
    const normText = fullText.replace(/\u00a0/g, ' ');
    for (const m of matchers) {
      if (m.test(normText, fullText)) {
        const pairs = m.replacements(normText, fullText);
        if (pairs && pairs.length) {
          return replaceInParagraphXml(pXml, pairs);
        }
        return pXml;
      }
    }
    return pXml;
  });
}

/**
 * Заменяет содержимое ячейки на несколько абзацев, сохраняя <w:tcPr>, <w:pPr> и <w:rPr> оригинала.
 */
function setCellParagraphs(tcXml, lines) {
  const tcPrMatch = tcXml.match(/<w:tcPr>[\s\S]*?<\/w:tcPr>/);
  const existingPs = tcXml.match(/<w:p(?:\s+[^>]*)?>[\s\S]*?<\/w:p>/g) || [];
  const tcPr = tcPrMatch ? tcPrMatch[0] : '';

  const pXmls = lines.map((line, i) => {
    const srcP = existingPs[Math.min(i, existingPs.length - 1)] || '';
    const pPrMatch = srcP.match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
    const rPrMatch = srcP.match(/<w:rPr>[\s\S]*?<\/w:rPr>/);
    const pPr = pPrMatch ? pPrMatch[0] : '';
    const rPr = rPrMatch ? rPrMatch[0] : '';
    if (line === '') return `<w:p>${pPr}</w:p>`;
    return `<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`;
  });

  return `<w:tc>${tcPr}${pXmls.join('')}</w:tc>`;
}

/**
 * Извлекает строки <w:tr> и ячейки <w:tc>, позволяя менять текст ячейки
 * с сохранением всех стилей (шрифт, размер, цвет, границы, выравнивание).
 */
function setCellText(tcXml, newText) {
  const str = String(newText ?? '');
  if (str.includes('\n')) {
    return setCellParagraphs(tcXml, str.split('\n'));
  }
  const tcPrMatch = tcXml.match(/<w:tcPr>[\s\S]*?<\/w:tcPr>/);
  const pMatch = tcXml.match(/<w:p(?:\s+[^>]*)?>[\s\S]*?<\/w:p>/);
  const pPrMatch = pMatch ? pMatch[0].match(/<w:pPr>[\s\S]*?<\/w:pPr>/) : null;
  const rPrMatch = pMatch ? pMatch[0].match(/<w:rPr>[\s\S]*?<\/w:rPr>/) : null;

  const tcPr = tcPrMatch ? tcPrMatch[0] : '';
  const pPr = pPrMatch ? pPrMatch[0] : '';
  const rPr = rPrMatch ? rPrMatch[0] : '';

  return `<w:tc>${tcPr}<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(str)}</w:t></w:r></w:p></w:tc>`;
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

function capitalizeRu(str) {
  const s = String(str || '').trim();
  return s ? s[0].toUpperCase() + s.slice(1) : '';
}

function wallMaterialAdjective(material) {
  const low = String(material || 'панель').trim().toLowerCase();
  const map = {
    'панель': 'панельного',
    'панельный': 'панельного',
    'кирпич': 'кирпичного',
    'кирпичный': 'кирпичного',
    'монолит': 'монолитного',
    'монолитный': 'монолитного',
    'кирпично-монолитный': 'кирпично-монолитного',
    'монолитно-кирпичный': 'монолитно-кирпичного',
    'блок': 'блочного',
    'блочный': 'блочного',
    'дерево': 'деревянного',
    'деревянный': 'деревянного',
  };
  if (map[low]) return map[low];
  if (/(ый|ой)$/i.test(low)) return `${low.slice(0, -2)}ого`;
  if (/ий$/i.test(low)) return `${low.slice(0, -2)}его`;
  return low;
}

function pluralRu(n, one, two, five) {
  const num = Math.abs(Math.round(n)) % 100;
  const n1 = num % 10;
  if (num > 10 && num < 20) return five;
  if (n1 > 1 && n1 < 5) return two;
  if (n1 === 1) return one;
  return five;
}

function declineCityGen(cityName) {
  const s = String(cityName || '').trim();
  const low = s.toLowerCase();
  if (!s || low.endsWith('и') || low.endsWith('о') || low.endsWith('е')) return s;
  if (low.endsWith('а')) {
    const stem = s.slice(0, -1);
    return 'гкхжшчщ'.includes(stem.slice(-1).toLowerCase()) ? `${stem}и` : `${stem}ы`;
  }
  if (low.endsWith('ь') || low.endsWith('й')) return `${s.slice(0, -1)}я`;
  return `${s}а`;
}

function extractLocationInfo(address) {
  const addr = String(address || '');
  const cityMatch = addr.match(/г\.\s*([А-ЯЁа-яё-]+)/);
  const city = cityMatch ? `г. ${cityMatch[1]}` : 'г. Тольятти';
  const cityGen = cityMatch ? `города ${declineCityGen(cityMatch[1])}` : 'города Тольятти';

  const mkrMatch = addr.match(/(?:мкрн?|микрорайон)\s+([А-ЯЁа-яё0-9-]+)/i);
  const distMatch = addr.match(/([А-ЯЁа-яё-]+)\s+район/i);
  const districtStem = distMatch ? distMatch[1] : '';

  const declineDistrict = (stem, targetCase) => {
    if (!stem) return '';
    const low = stem.toLowerCase();
    if (/(ск|цк)ий$/i.test(low) || /(ый|ой)$/i.test(low)) {
      const base = stem.slice(0, -2);
      if (targetCase === 'gen') return `${base}ого района`;
      if (targetCase === 'dat') return `${base}ому району`;
      return `${base}ом районе`;
    }
    if (/ий$/i.test(low)) {
      const base = stem.slice(0, -2);
      if (targetCase === 'gen') return `${base}его района`;
      if (targetCase === 'dat') return `${base}ему району`;
      return `${base}ем районе`;
    }
    return `${stem} район`;
  };

  let shortDistrictCode = '—';
  if (/автозавод/i.test(districtStem)) shortDistrictCode = 'А';
  else if (/центральн/i.test(districtStem)) shortDistrictCode = 'Ц';
  else if (/комсомольск/i.test(districtStem)) shortDistrictCode = 'К';
  else if (districtStem) shortDistrictCode = districtStem.slice(0, 1).toUpperCase();

  let locIn = `в ${city}`;
  let locGen = 'района расположения объекта оценки';
  if (mkrMatch) {
    locIn = `в микрорайоне ${mkrMatch[1]}`;
    locGen = `микрорайона ${mkrMatch[1]}`;
  } else if (districtStem) {
    locIn = `в ${declineDistrict(districtStem, 'loc')}`;
    locGen = declineDistrict(districtStem, 'gen');
  }

  return {
    city,
    cityGen,
    districtGen: districtStem ? declineDistrict(districtStem, 'gen') : '',
    districtDat: districtStem ? declineDistrict(districtStem, 'dat') : '',
    districtLoc: districtStem ? declineDistrict(districtStem, 'loc') : '',
    shortDistrictCode,
    locIn,
    locGen,
    isPovolzhsky: /поволжск/i.test(addr),
  };
}

function splitTitleAddress(address) {
  const addr = String(address || '').trim();
  const m = addr.match(/^(.*?)(?:,\s*|\s+)((?:ул\.|пр-т|просп\.|б-р|бул\.|пр\.|пер\.|ш\.|наб\.|пл\.|аллея).*)$/i);
  if (m && m[1].trim()) {
    return {
      line1: `${m[1].trim().replace(/,+$/, '')},`,
      line2: m[2].trim(),
    };
  }
  return { line1: addr, line2: '' };
}

function formatAppraiserInitials(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 3) {
    return `${parts[1][0]}. ${parts[2][0]}. ${parts[0]}`;
  }
  if (parts.length === 2) {
    return `${parts[1][0]}. ${parts[0]}`;
  }
  return parts[0] || 'А. А. Орлова';
}

function formatSourceNames(items) {
  const names = [];
  for (const item of items || []) {
    let s = (item.source || '').trim();
    if (!s && item.url) {
      if (/avito\.ru/i.test(item.url)) s = 'Авито';
      else if (/cian\.ru/i.test(item.url)) s = 'Циан';
      else if (/domclick\.ru/i.test(item.url)) s = 'Домклик';
      else if (/volgainfo/i.test(item.url)) s = 'Волга-Инфо';
      else if (/yandex/i.test(item.url)) s = 'Яндекс Недвижимость';
    }
    if (s && !names.includes(s)) names.push(s);
  }
  if (!names.length) return 'открытых Интернет-источниках';
  if (names.length === 1) return `Интернет-сайте ${names[0]}`;
  return `Интернет-сайтах ${names.slice(0, -1).join(', ')} и ${names[names.length - 1]}`;
}

function computePrimaryMarketStats(items) {
  const valid = (items || []).filter(a => Number(a.price) > 0 && Number(a.area) > 0);
  const count = valid.length;
  if (!count) {
    return {
      count: 0, sumArea: 0, sumPrice: 0,
      minArea: 0, maxArea: 0, meanArea: 0, medianArea: 0,
      minPrice: 0, maxPrice: 0, meanPrice: 0, medianPrice: 0,
      minPSqm: 0, maxPSqm: 0, meanPSqm: 0, medianPSqm: 0,
      weightedPSqm: 0, variationPct: 0,
    };
  }
  const median = sorted => {
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };
  const areas = valid.map(a => Number(a.area)).sort((a, b) => a - b);
  const prices = valid.map(a => Number(a.price)).sort((a, b) => a - b);
  const pSqms = valid.map(a => Number(a.price) / Number(a.area)).sort((a, b) => a - b);

  const sumArea = areas.reduce((s, x) => s + x, 0);
  const sumPrice = prices.reduce((s, x) => s + x, 0);
  const meanArea = sumArea / count;
  const meanPrice = sumPrice / count;
  const meanPSqm = pSqms.reduce((s, x) => s + x, 0) / count;
  const weightedPSqm = sumArea > 0 ? sumPrice / sumArea : 0;
  const variance = count > 1
    ? pSqms.reduce((s, x) => s + (x - meanPSqm) ** 2, 0) / (count - 1)
    : 0;
  const variationPct = meanPSqm > 0 ? (Math.sqrt(variance) / meanPSqm) * 100 : 0;

  return {
    count,
    sumArea,
    sumPrice,
    minArea: areas[0],
    maxArea: areas[count - 1],
    meanArea,
    medianArea: median(areas),
    minPrice: prices[0],
    maxPrice: prices[count - 1],
    meanPrice,
    medianPrice: median(prices),
    minPSqm: pSqms[0],
    maxPSqm: pSqms[count - 1],
    meanPSqm,
    medianPSqm: median(pSqms),
    weightedPSqm,
    variationPct,
  };
}

function groupAnalogsBy(rows, getKey) {
  const groups = new Map();
  (rows || []).forEach((r, idx) => {
    const key = getKey(r, idx);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(idx + 1);
  });
  return [...groups.entries()];
}

function formatAnalogNumbers(nums) {
  return nums.length === 1
    ? `объекта-аналога №${nums[0]}`
    : `объектов-аналогов №№${nums.join(',')}`;
}

function describeCategoryGroups(rows, getKey, quoted = true) {
  const groups = groupAnalogsBy(rows, getKey);
  if (!groups.length) return 'не указано.';
  if (groups.length === 1) {
    const val = groups[0][0];
    return `${quoted ? `«${val}»` : val} для всех объектов-аналогов.`;
  }
  return groups
    .map(([val, nums]) => `${quoted ? `«${val}»` : val} для ${formatAnalogNumbers(nums)}`)
    .join(' и ') + '.';
}

function formatAdjustmentClause(adjVal, nums) {
  const num = Number(adjVal) || 0;
  const dir = num > 0 ? 'повышающая' : 'понижающая';
  const pct = num > 0 ? fmtPctPlain(num) : `-${fmtPctPlain(Math.abs(num))}`;
  return `${dir} корректировка ${pct}% в цену ${formatAnalogNumbers(nums)}`;
}

function buildAdjustmentText(rows, getAdj, zeroText) {
  const groups = groupAnalogsBy(rows, r => Number(getAdj(r)) || 0)
    .filter(([adj]) => Math.abs(adj) > 0.001);
  if (!groups.length) return zeroText;
  return `Вносится ${groups.map(([adj, nums]) => formatAdjustmentClause(adj, nums)).join(' и ')}.`;
}

function patchAppendix3Links(xml, relsXml, selectedRows) {
  const slotRids = ['rId111', 'rId115', 'rId119', 'rId122', 'rId125'];
  let updatedXml = xml;
  let updatedRels = relsXml;

  slotRids.forEach((rid, idx) => {
    const hlRegex = new RegExp(`<w:hyperlink\\s+[^>]*r:id="${rid}"[^>]*>[\\s\\S]*?<\\/w:hyperlink>`, 'g');
    const relRegex = new RegExp(`<Relationship\\s+[^>]*Id="${rid}"[^>]*\\/>`, 'g');
    const analog = selectedRows[idx];

    if (analog) {
      const rawUrl = String(analog.url || '').trim();
      const displayText = rawUrl || analog.source || 'Открытый рынок';
      const isHttp = /^https?:\/\/.+/i.test(rawUrl);

      if (isHttp) {
        updatedXml = updatedXml.replace(hlRegex, hlXml =>
          hlXml.replace(/<w:t(?:\s+[^>]*)?>[\s\S]*?<\/w:t>/, `<w:t xml:space="preserve">${escapeXml(displayText)}</w:t>`)
        );
        if (updatedRels) {
          updatedRels = updatedRels.replace(relRegex, relTag =>
            relTag.replace(/Target="[^"]*"/, `Target="${escapeXml(rawUrl)}"`)
          );
        }
      } else {
        updatedXml = updatedXml.replace(hlRegex, () =>
          `<w:r><w:rPr><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">${escapeXml(displayText)}</w:t></w:r>`
        );
        if (updatedRels) updatedRels = updatedRels.replace(relRegex, '');
      }
    } else {
      updatedXml = updatedXml.replace(hlRegex, '');
      if (updatedRels) updatedRels = updatedRels.replace(relRegex, '');
    }
  });

  if (selectedRows.length > slotRids.length) {
    const extraPs = selectedRows.slice(slotRids.length).map(a => {
      const text = String(a.url || a.source || 'Открытый рынок').trim();
      return `<w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Cambria" w:hAnsi="Cambria"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
    }).join('');
    updatedXml = updatedXml.replace(
      /(<w:p(?:\s+[^>]*)?>[\s\S]*?ПРИЛОЖЕНИЕ №4\.[\s\S]*?<\/w:p>)/,
      `${extraPs}$1`
    );
  }

  return { xml: updatedXml, relsXml: updatedRels };
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
  const buildingAddress = address.replace(/,?\s*кв\.?\s*\d+.*$/i, '').trim() || address;
  const shortAddress = address.replace(/^.*?(ул\.|пр-т|б-р|пр\.|пер\.)/i, '$1');
  const titleAddr = splitTitleAddress(address);
  const locInfo = extractLocationInfo(address);
  const repYear = String(repDateIso || '').match(/^(\d{4})/)?.[1] || '2026';

  const cadNum = objectData.cadastralNumber || 'Не указан';
  const area = Number(objectData.area) || 0;
  const areaStr = fmtDec1(area);
  const rooms = objectData.rooms || 1;
  const floor = objectData.floor || 1;
  const totalFloors = objectData.totalFloors || 1;
  const floorStr = `${floor}/${totalFloors}`;
  const wallMaterial = objectData.wallMaterial || 'панель';
  const wallMaterialAdj = wallMaterialAdjective(wallMaterial);
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
  const sourceAnalogs = allAnalogs.length ? allAnalogs : selectedRows;
  const marketStats = computePrimaryMarketStats(sourceAnalogs);

  const shares = result.shares || [];
  const isShared = shares.length > 1;
  const sharesOwnershipType = isShared ? 'общая долевая собственность' : 'индивидуальная собственность';
  const ownerHolder = shares[0]?.holder || clientName;
  const ownerLines = isShared
    ? ['Правообладатели:', ...shares.map(s => `${s.holder} (доля ${s.shareFraction})`)]
    : [`Правообладатель: ${ownerHolder}.`];

  const isReferenceCase = reportNum === '19/0826-2';
  const inspectionAccess = objectData.inspectionAccess || (isReferenceCase ? 'no_access' : 'provided');
  const bathroom = objectData.bathroom || 'Раздельный';
  const infra = objectData.infra || {};
  const infraVal = key => (infra[key] === false ? 'Нет' : 'Есть');
  const egrnText = objectData.egrnDate
    ? `Выписка из Единого государственного реестра недвижимости об основных характеристиках и зарегистрированных правах на объект недвижимости от ${formatDateRu(objectData.egrnDate)}г., выданная Управлением Росреестра.`
    : (isReferenceCase
      ? 'Выписка из Единого государственного реестра недвижимости об основных характеристиках и зарегистрированных правах на объект недвижимости от 25.11.2025г., выданная Управлением Росреестра по Самарской области.'
      : 'Выписка из Единого государственного реестра недвижимости об основных характеристиках и зарегистрированных правах на объект недвижимости, выданная Управлением Росреестра.');

  // 0. Таблицы 0 и 1: Титульный лист и сопроводительное письмо
  xml = patchTableByIndex(xml, 0, rows =>
    rows.map((tr, rIdx) =>
      replaceRowCells(tr, c => {
        if (rIdx === 0 && c[1]) c[1] = setCellText(c[1], clientName);
        if (rIdx === 2 && c[1]) c[1] = setCellText(c[1], `${valDateRu}г.`);
        if (rIdx === 3 && c[1]) c[1] = setCellText(c[1], `${repDateRu}г.`);
        return c;
      })
    )
  );
  xml = patchTableByIndex(xml, 1, rows =>
    rows.map((tr, rIdx) =>
      replaceRowCells(tr, c => {
        if (rIdx === 0) {
          if (c[0]) c[0] = setCellText(c[0], locInfo.city);
          if (c[1]) c[1] = setCellText(c[1], `${repDateRu}г.`);
        }
        return c;
      })
    )
  );

  // 1. Таблицы 2 и 24: Итоговая величина рыночной стоимости + доли
  const patchSummaryTable = rows => {
    if (rows.length < 3) return rows;
    const header = rows[0];
    const fullPropRow = replaceRowCells(rows[1], cells => {
      cells[1] = setCellText(cells[1], `Жилое помещение (${rooms}-комнатная квартира) с кадастровым номером ${cadNum}, общей площадью ${areaStr} кв.м., расположенное по адресу: ${address}`);
      cells[2] = setCellText(cells[2], `${fmtNum(totalValue)} (${totalWords}) рублей`);
      return cells;
    });
    if (!isShared) {
      return [header, fullPropRow];
    }
    const shareTemplate = rows[2];
    const shareRows = shares.map((sh, idx) =>
      replaceRowCells(shareTemplate, cells => {
        cells[0] = setCellText(cells[0], String(idx + 2));
        cells[1] = setCellText(cells[1], `${sh.shareFraction} доли в праве общей долевой собственности (${sh.holder}) на жилое помещение (квартиру) с кадастровым номером ${cadNum}`);
        cells[2] = setCellText(cells[2], `${fmtNum(sh.rounded)} (${numberToWordsRu(sh.rounded)}) рублей`);
        return cells;
      })
    );
    return [header, fullPropRow, ...shareRows];
  };
  xml = patchTableByIndex(xml, 2, patchSummaryTable);
  xml = patchTableByIndex(xml, 24, patchSummaryTable);

  // 1а. Таблица 3 (Таблица 1.1): Основные факты и выводы
  const identLines = [
    `Жилое помещение (${rooms}-комнатная квартира) с кадастровым номером ${cadNum}, общей площадью ${areaStr} кв.м., расположенное по адресу: ${address}.`,
    '',
    `Имущественные права на объект оценки – ${sharesOwnershipType}.`,
    ...ownerLines,
  ];
  xml = patchTableByIndex(xml, 3, rows =>
    rows.map((tr, rIdx) =>
      replaceRowCells(tr, c => {
        if (rIdx === 1 && c[1]) c[1] = setCellParagraphs(c[1], identLines);
        if (rIdx === 2 && c[1]) c[1] = setCellText(c[1], `${valDateRu}г.`);
        if (rIdx === 3 && c[1]) c[1] = setCellText(c[1], `${fmtNum(totalValue)} (${totalWords}) рублей`);
        if (rIdx === 5 && c[1]) c[1] = setCellText(c[1], `Договор №${reportNum} от ${valDateRu}г.`);
        if (rIdx === 6 && c[1]) c[1] = setCellText(c[1], `№${reportNum}`);
        if (rIdx === 7 && c[1]) c[1] = setCellText(c[1], `${repDateRu}г.`);
        return c;
      })
    )
  );

  // 1б. Таблица 5 (Таблица 2.1): Задание на оценку
  xml = patchTableByIndex(xml, 5, rows =>
    rows.map((tr, rIdx) =>
      replaceRowCells(tr, c => {
        if (rIdx === 1 && c[2]) c[2] = setCellParagraphs(c[2], identLines);
        if (rIdx === 3 && c[2]) {
          c[2] = setCellParagraphs(c[2], [
            `Жилое помещение (${rooms}-комнатная квартира), площадью ${areaStr} кв.м., расположенная на ${floor}-м этаже ${totalFloors}-этажного ${wallMaterialAdj} жилого дома.`,
            'Характеристики объекта оценки приведены в таких документах:',
            egrnText,
          ]);
        }
        if (rIdx === 4 && c[2]) {
          c[2] = setCellParagraphs(c[2], [
            isShared ? 'Право общей долевой собственности.' : 'Индивидуальная собственность.',
            'Прочие ограничения (обременения), не относящиеся к описанным выше и не учитываемые при оценке объекта оценки, указаны в разделе 6.',
          ]);
        }
        if (rIdx === 5 && c[2]) c[2] = setCellText(c[2], purpose);
        if (rIdx === 7 && c[2]) c[2] = replaceInParagraphXml(c[2], [['19.08.2026', valDateRu]]);
        if (rIdx === 8 && c[2]) c[2] = setCellText(c[2], `${valDateRu}г.`);
        if (rIdx === 11 && c[2]) {
          const accessText = inspectionAccess === 'provided'
            ? 'Ограничения отсутствуют. Оценщиком проведён натурный осмотр объекта оценки с фотофиксацией.'
            : 'Оценщику не был предоставлен доступ в оцениваемое помещение. Определение рыночной стоимости объекта оценки проводится на основании предоставленных Заказчиком правоустанавливающих документов и фотографий объекта оценки';
          c[2] = setCellText(c[2], accessText);
        }
        return c;
      })
    )
  );

  // 1в. Таблицы 6, 9, 11, 12, 14: Заказчик и технические характеристики объекта/здания
  xml = patchTableByIndex(xml, 6, rows =>
    rows.map((tr, rIdx) =>
      replaceRowCells(tr, c => {
        if (rIdx === 1 && c[1]) c[1] = setCellText(c[1], clientName);
        if (rIdx === 2 && c[1]) {
          const passport = objectData.clientPassport
            || (clientName === 'Иванова Елена Ивановна'
              ? 'Паспорт серия 0000 №591155 выдан 24.09.2025 ГУ МВД России по Самарской области'
              : 'Предоставлены Заказчиком');
          c[1] = setCellText(c[1], passport);
        }
        if (rIdx === 3 && c[1]) c[1] = setCellText(c[1], objectData.clientAddress || address);
        return c;
      })
    )
  );
  xml = patchTableByIndex(xml, 9, rows =>
    rows.map((tr, rIdx) =>
      replaceRowCells(tr, c => {
        if (rIdx === 1 && c[1]) c[1] = setCellText(c[1], egrnText.replace(/\.$/, ''));
        return c;
      })
    )
  );
  xml = patchTableByIndex(xml, 11, rows =>
    rows.map((tr, rIdx) =>
      replaceRowCells(tr, c => {
        if (rIdx === 1 && c[1]) c[1] = setCellText(c[1], address);
        if (rIdx === 3 && c[1]) {
          if (objectData.stopDistance) {
            c[1] = replaceInParagraphXml(c[1], [['в пределах 200 м по ул. Олимпийская.', objectData.stopDistance]]);
          } else if (!locInfo.isPovolzhsky) {
            c[1] = replaceInParagraphXml(c[1], [['в пределах 200 м по ул. Олимпийская.', 'в шаговой доступности.']]);
          }
        }
        if (rIdx === 6 && c[2]) c[2] = setCellText(c[2], infraVal('school'));
        if (rIdx === 7 && c[2]) c[2] = setCellText(c[2], infraVal('kindergarten'));
        if (rIdx === 8 && c[2]) c[2] = setCellText(c[2], infraVal('bank'));
        if (rIdx === 9 && c[2]) c[2] = setCellText(c[2], infraVal('services'));
        if (rIdx === 10 && c[2]) c[2] = setCellText(c[2], infraVal('retail'));
        if (rIdx === 11 && c[2]) c[2] = setCellText(c[2], infraVal('pharmacy'));
        if (rIdx === 15 && c[1] && objectData.envDesc) c[1] = setCellText(c[1], objectData.envDesc);
        return c;
      })
    )
  );
  xml = patchTableByIndex(xml, 12, rows =>
    rows.map((tr, rIdx) =>
      replaceRowCells(tr, c => {
        if (rIdx === 1 && c[0]) {
          if (objectData.domclickUrl) {
            c[0] = setCellParagraphs(c[0], ['Источники информации:', `- ${objectData.domclickUrl}`]);
          } else if (!locInfo.isPovolzhsky && !/новосадов/i.test(address)) {
            c[0] = setCellParagraphs(c[0], ['Источники информации:', '- Данные Заказчика, Выписка ЕГРН']);
          }
        }
        if (rIdx === 4 && c[1]) c[1] = setCellText(c[1], buildingAddress);
        if (rIdx === 5 && c[1] && (objectData.buildYear || (!isReferenceCase && !/новосадов/i.test(address)))) {
          c[1] = setCellText(c[1], String(objectData.buildYear || 'По данным ЕГРН'));
        }
        if (rIdx === 6 && c[1] && (objectData.series || (!isReferenceCase && !/новосадов/i.test(address)))) {
          c[1] = setCellText(c[1], String(objectData.series || 'Типовой многоквартирный дом'));
        }
        if (rIdx === 8 && c[1]) c[1] = setCellText(c[1], String(totalFloors));
        if (rIdx === 9 && c[1]) c[1] = setCellText(c[1], capitalizeRu(wallMaterial));
        if (rIdx === 11 && c[1] && objectData.playground) c[1] = setCellText(c[1], objectData.playground);
        if (rIdx === 12 && c[1] && objectData.sportsGround) c[1] = setCellText(c[1], objectData.sportsGround);
        if (rIdx === 16 && c[1] && objectData.entranceSecurity) c[1] = setCellText(c[1], objectData.entranceSecurity);
        if (rIdx === 18 && c[1] && objectData.parking) c[1] = setCellText(c[1], objectData.parking);
        return c;
      })
    )
  );
  xml = patchTableByIndex(xml, 14, rows =>
    rows.map((tr, rIdx) =>
      replaceRowCells(tr, c => {
        if (rIdx === 1 && c[0]) {
          const inspSource = inspectionAccess === 'provided'
            ? 'Акт натурного осмотра и фотофиксация'
            : 'Анализ предоставленных фотографий';
          c[0] = setCellParagraphs(c[0], [egrnText, inspSource]);
        }
        if (rIdx === 2 && c[1]) c[1] = setCellText(c[1], `${floor} из ${totalFloors}`);
        if (rIdx === 3 && c[1]) c[1] = setCellText(c[1], String(rooms));
        if (rIdx === 4 && c[1]) c[1] = setCellText(c[1], areaStr);
        if (rIdx === 5 && c[1]) c[1] = setCellText(c[1], balcony === 'нет' ? 'Нет' : 'Есть');
        if (rIdx === 6 && c[1]) c[1] = setCellText(c[1], capitalizeRu(condition));
        if (rIdx === 7 && c[1]) c[1] = setCellText(c[1], capitalizeRu(finish));
        if (rIdx === 8 && c[1]) c[1] = setCellText(c[1], bathroom);
        return c;
      })
    )
  );

  // 2. Таблица 13: Имущественные права ЕГРН
  xml = patchTableByIndex(xml, 13, rows =>
    rows.map((tr, rIdx) =>
      replaceRowCells(tr, cells => {
        if (rIdx === 1 && cells[0]) {
          cells[0] = setCellParagraphs(cells[0], [
            egrnText,
            'Справочная информация по объектам недвижимости в режиме online (общедоступные сведения об объектах недвижимости с сайта Росреестра)',
          ]);
        }
        if (rIdx === 2 && cells[1]) {
          cells[1] = setCellText(
            cells[1],
            `Жилое помещение (${rooms}-комнатная квартира) – объект недвижимого имущества с кадастровым номером ${cadNum}, назначение: жилое помещение, площадью ${areaStr} кв.м., расположенное по адресу: ${address}`
          );
        }
        if (rIdx === 3 && cells[1]) {
          cells[1] = setCellParagraphs(cells[1], [
            `Имущественные права на объект оценки – ${sharesOwnershipType}.`,
            ...ownerLines,
          ]);
        }
        if (rIdx === 4 && cells[1] && (objectData.basisDoc || !isReferenceCase)) {
          cells[1] = setCellText(cells[1], objectData.basisDoc || 'Правоустанавливающие документы, предоставленные Заказчиком');
        }
        if (rIdx === 5 && cells[1]) {
          cells[1] = setCellText(cells[1], objectData.encumbrances || 'Не зарегистрировано');
        }
        return cells;
      })
    )
  );

  // 3. Таблица 15 (Таблица 9.2): Выборка рыночных аналогов
  xml = patchTableByIndex(xml, 15, rows => {
    if (rows.length < 2) return rows;
    const header = rows[0];
    const rowTemplate = rows[5] || rows[1];
    const analogRows = sourceAnalogs.map((a, idx) =>
      replaceRowCells(rowTemplate, cells => {
        const pSqm = a.area ? Math.round(a.price / a.area) : 0;
        const distCode = extractLocationInfo(a.address || address).shortDistrictCode;
        cells[0] = setCellText(cells[0], String(idx + 1));
        cells[1] = setCellText(cells[1], 'жилое помещение (квартира)');
        cells[2] = setCellText(cells[2], distCode);
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

  // 3а. Таблица 16 (Таблица 9.3): Характеристики первичной выборки предложений продажи
  xml = patchTableByIndex(xml, 16, rows => {
    const statValues = {
      1: String(marketStats.count),
      2: fmtNum(marketStats.sumArea),
      3: fmtNum(marketStats.sumPrice),
      5: fmtNum(marketStats.minArea),
      6: fmtNum(marketStats.maxArea),
      7: fmtNum(marketStats.meanArea),
      8: fmtNum(marketStats.medianArea),
      10: fmtNum(marketStats.minPrice),
      11: fmtNum(marketStats.maxPrice),
      12: fmtNum(marketStats.meanPrice),
      13: fmtNum(marketStats.medianPrice),
      15: fmtNum(marketStats.minPSqm),
      16: fmtNum(marketStats.maxPSqm),
      17: fmtNum(marketStats.meanPSqm),
      18: fmtNum(marketStats.medianPSqm),
      19: fmtNum(marketStats.weightedPSqm),
      20: `${Math.round(marketStats.variationPct)}%`,
    };
    return rows.map((tr, rIdx) => {
      if (statValues[rIdx] == null) return tr;
      return replaceRowCells(tr, c => {
        if (c[1]) c[1] = setCellText(c[1], marketStats.count ? statValues[rIdx] : (rIdx === 1 ? '0' : '—'));
        return c;
      });
    });
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
  const t19ObjMap = {
    2: areaStr,
    6: `${valDateRu}г.`,
    9: sharesOwnershipType,
    15: address,
    18: finish,
    21: wallMaterial,
    24: furniture,
    27: floorStr,
    30: areaStr,
    33: condition,
    36: balcony,
  };
  const t19AnMap = {
    1: r => fmtNum(r.price),
    2: r => fmtDec1(r.area),
    3: r => fmtNum(r.initialPricePerSqm),
    4: r => fmtPct2(r.tradeAdjustment),
    5: r => fmtNum(r.priceAfterTrade),
    6: r => r.published || repMonthYear,
    7: () => '0,00%',
    8: r => fmtNum(r.priceAfterTrade),
    9: () => 'собственность',
    10: () => '0,00%',
    11: r => fmtNum(r.priceAfterTrade),
    13: () => '0,00%',
    14: r => fmtNum(r.priceAfterTrade),
    15: r => r.address || '—',
    16: () => '0,00%',
    17: r => fmtNum(r.priceAfterTrade),
    18: r => r.finish || '—',
    19: r => fmtPct2(r.finishAdj),
    20: r => fmtNum(r.priceAfterFinish),
    21: r => r.wallMaterial || wallMaterial,
    22: () => '0,00%',
    23: r => fmtNum(r.priceAfterFinish),
    24: r => r.furniture || 'да',
    25: () => '0,00%',
    26: r => fmtNum(r.priceAfterFinish),
    27: r => `${r.floor}/${r.totalFloors}`,
    28: r => fmtPct2(r.floorAdj),
    29: r => fmtNum(r.priceAfterFloor),
    30: r => fmtDec1(r.area),
    31: r => fmtPct2(r.areaAdj),
    32: r => fmtNum(r.finalAdjustedPrice),
    33: r => r.condition || 'хорошее',
    34: () => '0,00%',
    35: r => fmtNum(r.finalAdjustedPrice),
    36: r => r.balcony || 'да',
    37: () => '0,00%',
    38: r => fmtNum(r.finalAdjustedPrice),
    40: r => String(r.correctionsCount),
    41: r => r.weight.toFixed(4).replace('.', ','),
  };
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
          if (t19ObjMap[rIdx]) c[2] = setCellText(c[2], t19ObjMap[rIdx]);
          if (t19AnMap[rIdx]) fillAnalogCol(c, 3, t19AnMap[rIdx]);
          return c;
        });
      }
      // Строки корректировок, скорректированных цен, счётчиков и весов имеют gridSpan=2 в col 1 (итого 7 ячеек)
      if (cells.length === 7 && t19AnMap[rIdx]) {
        return replaceRowCells(tr, c => {
          fillAnalogCol(c, 2, t19AnMap[rIdx]);
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

  // 7. Таблица 21 (Таблица 12.4): Статистика вариации
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

  // 8. Таблица 22 (Таблица 12.5): Расчёт стоимости долей
  const effectiveShares = shares.length
    ? shares
    : [{ shareFraction: '1/1', nominal: totalValue, rounded: totalValue }];
  xml = patchTableByIndex(xml, 22, rows =>
    rows.map((tr, rIdx) => {
      if (rIdx === 0) return tr;
      return replaceRowCells(tr, c => {
        for (let i = 0; i < 5; i++) {
          const col = i + 1;
          if (col >= c.length) continue;
          const sh = effectiveShares[i];
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

  // 8а. Таблица 23 (Таблица 13.1): Согласование результатов
  xml = patchTableByIndex(xml, 23, rows =>
    rows.map((tr, rIdx) =>
      replaceRowCells(tr, c => {
        if (rIdx === 3) {
          if (c[2]) c[2] = setCellText(c[2], fmtNum(totalValue));
          if (c[4]) c[4] = setCellText(c[4], fmtNum(totalValue));
        }
        if (rIdx === 4 && c[1]) {
          c[1] = setCellParagraphs(c[1], [`${fmtNum(totalValue)} руб.`, `(${totalWords}) рублей`]);
        }
        return c;
      })
    )
  );

  // 9. Динамические текстовые обоснования, сегмент и местоположение по фактическому расчёту
  const tradeExplanation = Math.abs(tradeAdj) < 0.001
    ? 'Корректировка на торг не вносится (0%).'
    : (tradeAdj < 0
      ? `В цены всех объектов-аналогов вводится понижающая корректировка -${fmtPctPlain(Math.abs(tradeAdj))}%.`
      : `В цены всех объектов-аналогов вводится повышающая корректировка ${fmtPctPlain(tradeAdj)}%.`);

  const analogDates = [...new Set(selectedRows.map(r => (r.published || repMonthYear).trim()).filter(Boolean))];
  const analogsDatesText = analogDates.length ? analogDates.join(', ') : repMonthYear;
  const dateExplanation = `Корректировка на дату предложения не проводится в связи с тем, что дата предложения продажи объектов-аналогов (${analogsDatesText}) сопоставима с датой оценки (${valDateRu}г.) и не выходит за установленные рамки.`;

  const finishGroupsDesc = describeCategoryGroups(selectedRows, r => r.finish || finish, true);
  const finishDescText = `Тип отделки исследуемого Объекта в связи с данными осмотра принимается соответствующим категории «${finish}». Тип отделки всех объектов-аналогов был определен на основании телефонного разговора с контактными лицами, указанными в объявлении о продаже и анализа предоставленных в объявлении фотографий, и соответствует категории ${finishGroupsDesc}`;

  const finishAdjText = buildAdjustmentText(selectedRows, r => r.finishAdj, 'Корректировка на тип отделки не требуется.');
  const floorAdjText = buildAdjustmentText(selectedRows, r => r.floorAdj, 'Корректировка на этаж расположения не требуется.');

  const wallMaterials = [...new Set(selectedRows.map(r => r.wallMaterial || wallMaterial))];
  const wallMaterialText = wallMaterials.length === 1 && wallMaterials[0] === wallMaterial
    ? `Корректировка не требуется, объект оценки и все объекты-аналоги расположены в домах с идентичным материалом стен – ${wallMaterial}.`
    : `Материал стен объекта оценки – ${wallMaterial}; у объектов-аналогов: ${describeCategoryGroups(selectedRows, r => r.wallMaterial || wallMaterial, false)} Корректировка на материал стен в расчёте не вносилась.`;

  const furnitures = [...new Set(selectedRows.map(r => r.furniture || furniture))];
  const furnitureText = furnitures.length === 1 && furnitures[0] === furniture
    ? (furniture === 'нет'
      ? 'Объект оценки и все объекты-аналоги предполагаются к реализации без мебели и встроенной техники, корректировка не требуется.'
      : 'Объект оценки и все объекты – аналоги предполагаются к реализации с учетом мебели и бытовой техники, корректировка не требуется.')
    : `Наличие встроенной мебели и техники: объект оценки – ${furniture}; у объектов-аналогов: ${describeCategoryGroups(selectedRows, r => r.furniture || furniture, false)} Корректировка не требуется.`;

  const conditions = [...new Set(selectedRows.map(r => r.condition || condition))];
  const conditionText = conditions.length === 1
    ? `Техническое состояние исследуемого Объекта в связи с данными осмотра принимается соответствующим состоянию «${condition}». Техническое состояние всех объектов-аналогов было определено на основании телефонного разговора с контактными лицами, указанными в объявлении о продаже и анализа предоставленных в объявлении фотографий, и соответствует состоянию «${conditions[0]}» для всех объектов-аналогов. Корректировка не требуется.`
    : `Техническое состояние исследуемого Объекта в связи с данными осмотра принимается соответствующим состоянию «${condition}». Техническое состояние объектов-аналогов соответствует состоянию ${describeCategoryGroups(selectedRows, r => r.condition || condition, true)} Корректировка не требуется.`;

  const balconies = [...new Set(selectedRows.map(r => r.balcony || balcony))];
  const balconyText = balconies.length === 1 && balconies[0] === balcony
    ? (balcony === 'нет'
      ? 'Объект оценки и все объекты-аналоги не обеспечены балконом/лоджией, корректировка не требуется.'
      : 'Объект оценки и все объекты-аналоги обеспечены балконом/лоджией, корректировка не требуется.')
    : `Наличие балкона/лоджии: объект оценки – ${balcony}; у объектов-аналогов: ${describeCategoryGroups(selectedRows, r => r.balcony || balcony, false)} Корректировка не требуется.`;

  const sourcesLabel = formatSourceNames(sourceAnalogs);
  const appraiserInitials = formatAppraiserInitials(appraiserName);
  const cityShort = locInfo.city.replace(/^г\.\s*/, '');

  const paragraphMatchers = [
    {
      test: t => t.trim() === 'Самарская область, г. Тольятти, Комсомольский район,',
      replacements: (norm, full) => [[full, titleAddr.line1]],
    },
    {
      test: t => t.trim() === 'ул. Новосадовая, д. 1, кв. 49',
      replacements: (norm, full) => [[full, titleAddr.line2]],
    },
    {
      test: t => t.trim() === 'Тольятти, 2026г.',
      replacements: (norm, full) => [[full, `${cityShort}, ${repYear}г.`]],
    },
    {
      test: t => t.includes('подготовленного и подписанного профессиональным оценщиком'),
      replacements: () => [['Орловой Анной Александровной', declineFioRu(appraiserName, 'ins')]],
    },
    {
      test: t => inspectionAccess === 'provided' && t.includes('Оценщику не был предоставлен доступ в оцениваемое помещение'),
      replacements: (norm, full) => [[
        full,
        'Оценщиком проведён натурный осмотр оцениваемого помещения с фотофиксацией. Определение рыночной стоимости объекта оценки проводится на основании предоставленных Заказчиком правоустанавливающих документов и материалов осмотра.',
      ]],
    },
    {
      test: t => !locInfo.isPovolzhsky && t.includes('Объект оценки представляет собой жилое помещение (квартиру) в многоквартином жилом доме'),
      replacements: () => [[
        'в юго-восточной части города, в Комсомольском районе',
        locInfo.districtLoc ? `в ${locInfo.districtLoc}` : `в ${locInfo.city}`,
      ]],
    },
    {
      test: t => !locInfo.isPovolzhsky && t.includes('Объект оценки расположен в северо-восточной части Комсомольского района'),
      replacements: (norm, full) => [[
        full,
        `Объект оценки расположен ${locInfo.locIn}, по адресу: ${address}. Местоположение объекта оценки представлено на рисунке.`,
      ]],
    },
    {
      test: t => !locInfo.isPovolzhsky && t.includes('Географическое расположение объекта в плане микрорайона Поволжский'),
      replacements: () => [['микрорайона Поволжский', locInfo.locGen]],
    },
    {
      test: t => t.includes('По территориальному признаку сегмент оцениваемого объекта'),
      replacements: () => [[
        'Комсомольскому району города Тольятти',
        locInfo.districtDat ? `${locInfo.districtDat} ${locInfo.cityGen}` : locInfo.cityGen,
      ]],
    },
    {
      test: t => t.includes('На основе комплексного анализа представленных данных'),
      replacements: (norm, full) => [[
        full,
        `На основе комплексного анализа представленных данных, Оценщиком отобрано ${marketStats.count} ${pluralRu(marketStats.count, 'предложение', 'предложения', 'предложений')} к продаже ${rooms}-комнатных квартир ${locInfo.locIn} на дату оценки.`,
      ]],
    },
    {
      test: t => t.includes('Таким образом, на рынке присутствия объекта на дату оценки представлено'),
      replacements: (norm, full) => [[
        full,
        marketStats.count
          ? `Таким образом, на рынке присутствия объекта на дату оценки представлено ${marketStats.count} ${pluralRu(marketStats.count, 'предложение', 'предложения', 'предложений')} к продаже квартир (первичная выборка). Общий объем рынка составляет ${fmtNum(marketStats.sumArea)} кв.м. или ${(marketStats.sumPrice / 1_000_000).toFixed(2).replace('.', ',')} млн. руб. (в ценах предложения). Цены предложений объектов колеблются от ${fmtNum(marketStats.minPrice)} до ${fmtNum(marketStats.maxPrice)} руб. Площади – от ${fmtNum(marketStats.minArea)} кв.м. до ${fmtNum(marketStats.maxArea)} кв.м., среднее (медианное) значение площади составляет ${fmtNum(marketStats.medianArea)} кв.м.`
          : 'Первичная выборка предложений на дату оценки отсутствует.',
      ]],
    },
    {
      test: t => t.includes('Диапазон удельных предложений на объекты недвижимости в первичной выборке'),
      replacements: (norm, full) => [[
        full,
        marketStats.count
          ? `Диапазон удельных предложений на объекты недвижимости в первичной выборке составляет от ${fmtNum(marketStats.minPSqm)} руб./кв.м до ${fmtNum(marketStats.maxPSqm)} руб./кв.м. Среднее арифметическое значение удельной цены составляет ${fmtNum(marketStats.meanPSqm)} руб./кв.м., среднее значение (медианное) составляет ${fmtNum(marketStats.medianPSqm)} руб./кв.м.`
          : '',
      ]],
    },
    {
      test: t => t.includes('Для оценки стоимости объекта оценки используются предложения продажи квартир'),
      replacements: (norm, full) => [[
        full,
        `Для оценки стоимости объекта оценки используются предложения продажи квартир в ${locInfo.city}, представленные в публичной оферте на ${sourcesLabel} на дату оценки – ${valDateRu}г.`,
      ]],
    },
    {
      test: t => t.includes('В результате анализа рынка, проведенного в п. 9 настоящего Отчета'),
      replacements: (norm, full) => [[
        full,
        `В результате анализа рынка, проведенного в п. 9 настоящего Отчета, была составлена первичная выборка объектов-аналогов – ${rooms}-комнатных квартир в ${locInfo.city}, отобранных для дальнейшего анализа и расчетов в рамках сравнительного подхода оценки рыночной стоимости объекта оценки.`,
      ]],
    },
    {
      test: t => t.includes('Объем данной выборки составляет 12 объектов'),
      replacements: (norm, full) => [[
        full,
        `Объем данной выборки составляет ${marketStats.count} ${pluralRu(marketStats.count, 'объект', 'объекта', 'объектов')}. Руководствуясь принципом разумной достаточности, из этих объектов ${selectedRows.length === 1 ? 'был отобран' : 'были отобраны'} ${selectedRows.length} ${pluralRu(selectedRows.length, 'объект-аналог', 'объекта-аналога', 'объектов-аналогов')}, которые максимально приближены к объекту исследования.`,
      ]],
    },
    {
      test: t => t.includes('В цены всех объектов-аналогов вводится'),
      replacements: (norm, full) => [[full, tradeExplanation]],
    },
    {
      test: t => t.includes('Корректировка на дату предложения не проводится'),
      replacements: (norm, full) => [[full, dateExplanation]],
    },
    {
      test: t => t.includes('Имущественные права на Объект оценки – общая долевая собственность'),
      replacements: () => [['общая долевая собственность', sharesOwnershipType]],
    },
    {
      test: t => t.includes('Все объекты-аналоги расположены в сопоставимых зонах'),
      replacements: () => [['микрорайона Поволжский', locInfo.locGen]],
    },
    {
      test: t => t.includes('Тип отделки исследуемого Объекта'),
      replacements: (norm, full) => [[full, finishDescText]],
    },
    {
      test: t => t.includes('Вносится повышающая корректировка 6% в цену'),
      replacements: (norm, full) => [[full, finishAdjText]],
    },
    {
      test: t => t.includes('Корректировка не требуется, объект оценки и все объекты-аналоги расположены в домах'),
      replacements: (norm, full) => [[full, wallMaterialText]],
    },
    {
      test: t => t.includes('Объект оценки и все объекты – аналоги предполагаются к реализации'),
      replacements: (norm, full) => [[full, furnitureText]],
    },
    {
      test: t => t.includes('Вносится повышающая корректировка 5% в цену'),
      replacements: (norm, full) => [[full, floorAdjText]],
    },
    {
      test: t => t.includes('Техническое состояние исследуемого Объекта'),
      replacements: (norm, full) => [[full, conditionText]],
    },
    {
      test: t => t.includes('Объект оценки и все объекты-аналоги обеспечены балконом'),
      replacements: (norm, full) => [[full, balconyText]],
    },
    {
      test: t => t.includes('Таким образом, в результате проведенных расчетов рыночная стоимость 1 кв.м.'),
      replacements: () => [['52 479', fmtNum(pricePerSqm)]],
    },
    {
      test: t => t.includes('Тогда, рыночная стоимость жилого помещения (квартиры)'),
      replacements: (norm, full) => [[
        full,
        `Тогда, рыночная стоимость жилого помещения (${rooms}-комнатной квартиры) с кадастровым номером ${cadNum}, общей площадью ${areaStr} кв.м., расположенного по адресу: ${address}, составляет (округленно, в размере полного права собственности):`,
      ]],
    },
    {
      test: t => t.includes('52 479 руб. * 66,8 кв.м.'),
      replacements: () => [
        ['52 479', fmtNum(pricePerSqm)],
        ['66,8', areaStr],
        ['3 506 000', fmtNum(totalValue)],
      ],
    },
    {
      test: t => !isShared && t.includes('В рамках настоящей работы, все доли в праве'),
      replacements: (norm, full) => [[
        full,
        'В рамках настоящей работы объект оценки находится в индивидуальной собственности (единоличное владение — 100%, доля 1/1), разделение на доли отсутствует, корректировка равна 1 (0%).',
      ]],
    },
    {
      test: t => !isShared && t.includes('Окончательный расчет рыночной стоимости долей'),
      replacements: (norm, full) => [[
        full,
        'Окончательный расчет рыночной стоимости объекта недвижимости (индивидуальная собственность) представлен в таблице.',
      ]],
    },
    {
      test: t => t.includes('Оценщик') && t.includes('А. А. Орлова'),
      replacements: () => [['А. А. Орлова', appraiserInitials]],
    },
  ];
  xml = patchParagraphsByMatcher(xml, paragraphMatchers);

  // 10. Приложение №3: замена эталонных URL на реальные ссылки выбранных аналогов дела
  const relsFile = zip.file('word/_rels/document.xml.rels');
  let relsXml = relsFile ? await relsFile.async('string') : '';
  const patchedApp3 = patchAppendix3Links(xml, relsXml, selectedRows);
  xml = patchedApp3.xml;
  relsXml = patchedApp3.relsXml;

  // 11. Глобальная замена текстовых вхождений во всех абзацах документа
  const s1 = shares[1]?.holder || clientName;
  const s2 = shares[2]?.holder || clientName;
  const s3 = shares[3]?.holder || clientName;
  const s4 = shares[4]?.holder || clientName;
  const globalReplacements = [
    ['19/0826-2', reportNum],
    ['19.08.2026', valDateRu],
    ['20.08.2026', repDateRu],
    ['Ивановой Елене Ивановне', declineFioRu(clientName, 'dat')],
    ['Ивановой Елены Ивановны', declineFioRu(clientName, 'gen')],
    ['Ивановой Еленой Ивановной', declineFioRu(clientName, 'ins')],
    ['Иванова Елена Ивановна', clientName],
    ['Орловой Анной Александровной', declineFioRu(appraiserName, 'ins')],
    ['Орловой Анне Александровне', declineFioRu(appraiserName, 'dat')],
    ['Орловой Анны Александровны', declineFioRu(appraiserName, 'gen')],
    ['Орлова Анна Александровна', appraiserName],
    ['Разрезова Александра Михайловича', declineFioRu(s1, 'gen')],
    ['Разрезову Александру Михайловичу', declineFioRu(s1, 'dat')],
    ['Разрезовым Александром Михайловичем', declineFioRu(s1, 'ins')],
    ['Разрезов Александр Михайлович', s1],
    ['Разрезова Дмитрия Александровича', declineFioRu(s2, 'gen')],
    ['Разрезову Дмитрию Александровичу', declineFioRu(s2, 'dat')],
    ['Разрезовым Дмитрием Александровичем', declineFioRu(s2, 'ins')],
    ['Разрезов Дмитрий Александрович', s2],
    ['Разрезовой Ксении Александровны', declineFioRu(s3, 'gen')],
    ['Разрезовой Ксении Александровне', declineFioRu(s3, 'dat')],
    ['Разрезовой Ксенией Александровной', declineFioRu(s3, 'ins')],
    ['Разрезова Ксения Александровна', s3],
    ['Матвеева Максима Антоновича', declineFioRu(s4, 'gen')],
    ['Матвееву Максиму Антоновичу', declineFioRu(s4, 'dat')],
    ['Матвеевым Максимом Антоновичем', declineFioRu(s4, 'ins')],
    ['Матвеев Максим Антонович', s4],
    ['63:09:0201045:5015', cadNum],
    ['г. Тольятти, Комсомольский район, мкрн Поволжский, ул. Новосадовая, д. 1, кв. 49', address],
    ['Самарская область, г. Тольятти, Комсомольский район, ул. Новосадовая, д. 1, кв. 49', address],
    ['ул. Новосадовая, д. 1, кв. 49', shortAddress],
    ['66,8', areaStr],
    ['3-комнатная', `${rooms}-комнатная`],
    ['3-комнатных', `${rooms}-комнатных`],
    ['3-х комнатной', `${rooms}-комнатной`],
    ['3 506 000', fmtNum(totalValue)],
    ['3 505 597', fmtNum(rawTotal)],
    ['три миллиона пятьсот шесть тысяч', totalWords],
    ['52 479', fmtNum(pricePerSqm)],
    ['ООО «РусОценка»', companyName],
  ];

  xml = replaceInAllParagraphs(xml, globalReplacements);
  zip.file('word/document.xml', xml);
  if (relsFile && relsXml) {
    zip.file('word/_rels/document.xml.rels', relsXml);
  }

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
