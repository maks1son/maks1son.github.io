/**
 * Модель сравнительного подхода для оценки жилой недвижимости (квартир).
 * Построена строго по официальной методике и формулам ООО «РусОценка»
 * (Отчет об оценке № 19/0826-2, ФСО I-VI №200, ФСО №7).
 */

export const money = value => {
  if (value == null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.round(value)) + ' ₽';
};

export const moneyPerSqm = value => {
  if (value == null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.round(value)) + ' ₽/м²';
};

export const sqm = value => {
  if (value == null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value) + ' м²';
};

export const percent = value => {
  if (value == null || !Number.isFinite(value)) return '0,00%';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2).replace('.', ',')}%`;
};

export const weightFmt = value => {
  if (value == null || !Number.isFinite(value)) return '0,0%';
  return `${(value * 100).toFixed(1).replace('.', ',')}%`;
};

export function defaultObject() {
  return {
    reportNumber: '19/0826-2',
    valuationDate: '2026-08-19',
    reportDate: '2026-08-20',
    propertyType: 'Жилое помещение (квартира)',
    rooms: 3,
    address: 'Самарская область, г. Тольятти, Комсомольский район, мкрн Поволжский, ул. Новосадовая, д. 1, кв. 49',
    cadastralNumber: '63:09:0201045:5015',
    area: 66.8,
    floor: 3,
    totalFloors: 4,
    wallMaterial: 'панель',
    finish: 'улучшенная',
    condition: 'хорошее',
    balcony: 'да',
    furniture: 'да',
    purpose: 'Определение рыночной стоимости для совершения сделки купли-продажи (ст. 30 ГК РФ)',
    client: 'Иванова Елена Ивановна',
    appraiser: 'Орлова Анна Александровна',
    company: 'ООО «РусОценка»',
    tradeAdjustment: -6.0,
    shares: [
      { id: 's1', holder: 'Иванова Елена Ивановна', num: 193, den: 461 },
      { id: 's2', holder: 'Разрезов Александр Михайлович', num: 193, den: 461 },
      { id: 's3', holder: 'Разрезов Дмитрий Александрович', num: 25, den: 461 },
      { id: 's4', holder: 'Разрезова Ксения Александровна', num: 25, den: 461 },
      { id: 's5', holder: 'Матвеев Максим Антонович', num: 25, den: 461 },
    ],
  };
}

export function defaultAnalogs() {
  return [
    {
      id: 'a1',
      number: 1,
      selected: true,
      address: 'г. Тольятти, Комсомольский район, мкрн Поволжский, ул. 60 лет СССР, д. 9',
      price: 3750000,
      area: 69.9,
      floor: 2,
      totalFloors: 5,
      wallMaterial: 'панель',
      finish: 'улучшенная',
      condition: 'хорошее',
      balcony: 'да',
      furniture: 'да',
      source: 'Авито',
      url: 'https://www.avito.ru/tolyatti/kvartiry/3-k._kvartira_699_m_25_et._4504033738',
      published: 'август 2026г.',
      floorAdj: 0.0,
      finishAdj: 0.0,
      areaAdj: 0.51,
      note: 'Средний этаж, улучшенная отделка. Поправка только на масштаб площади и торг.',
    },
    {
      id: 'a2',
      number: 2,
      selected: true,
      address: 'г. Тольятти, Комсомольский район, мкрн Поволжский, ул. Академика Вавилова, д. 21',
      price: 3590000,
      area: 67.9,
      floor: 1,
      totalFloors: 4,
      wallMaterial: 'панель',
      finish: 'улучшенная',
      condition: 'хорошее',
      balcony: 'да',
      furniture: 'да',
      source: 'Авито',
      url: 'https://www.avito.ru/tolyatti/kvartiry/3-k._kvartira_679_m_14_et._2861826719',
      published: 'август 2026г.',
      floorAdj: 5.0,
      finishAdj: 0.0,
      areaAdj: 0.18,
      note: 'Первый этаж уступает среднему (+5% по справочнику Лейфера).',
    },
    {
      id: 'a3',
      number: 3,
      selected: true,
      address: 'г. Тольятти, Комсомольский район, мкрн Поволжский, ул. Новосадовая, д. 8',
      price: 3500000,
      area: 68.0,
      floor: 4,
      totalFloors: 4,
      wallMaterial: 'панель',
      finish: 'простая',
      condition: 'хорошее',
      balcony: 'да',
      furniture: 'да',
      source: 'Волга-Инфо',
      url: 'https://volgainfo.net/togliatti/kvartiryi/realty317893',
      published: 'август 2026г.',
      floorAdj: 4.0,
      finishAdj: 6.0,
      areaAdj: 0.20,
      note: 'Последний этаж (+4%) и простая отделка (+6%).',
    },
    {
      id: 'a4',
      number: 4,
      selected: true,
      address: 'г. Тольятти, Комсомольский район, мкрн Поволжский, ул. Новосадовая, д. 8',
      price: 3400000,
      area: 67.1,
      floor: 2,
      totalFloors: 4,
      wallMaterial: 'панель',
      finish: 'простая',
      condition: 'хорошее',
      balcony: 'да',
      furniture: 'да',
      source: 'Волга-Инфо',
      url: 'https://volgainfo.net/togliatti/kvartiryi/realty306332',
      published: 'август 2026г.',
      floorAdj: 0.0,
      finishAdj: 6.0,
      areaAdj: 0.04,
      note: 'Средний этаж, простая отделка (+6%).',
    },
    {
      id: 'a5',
      number: 5,
      selected: true,
      address: 'г. Тольятти, Комсомольский район, мкрн Поволжский, ул. Олимпийская, д. 28',
      price: 3700000,
      area: 64.7,
      floor: 5,
      totalFloors: 5,
      wallMaterial: 'панель',
      finish: 'улучшенная',
      condition: 'хорошее',
      balcony: 'да',
      furniture: 'да',
      source: 'Волга-Инфо',
      url: 'https://volgainfo.net/togliatti/kvartiryi/realty305309',
      published: 'август 2026г.',
      floorAdj: 4.0,
      finishAdj: 0.0,
      areaAdj: -0.35,
      note: 'Последний этаж (+4%), площадь меньше объекта (−0,35%).',
    },
  ];
}

/**
 * Расчёт поправки на этаж по методике Лейфера
 */
export function calculateFloorAdjustment(objFloor, objTotal, analogFloor, analogTotal) {
  const getCategory = (f, t) => {
    if (f === 1) return 'first';
    if (f === t && t > 1) return 'last';
    return 'middle';
  };
  const objCat = getCategory(objFloor, objTotal);
  const anCat = getCategory(analogFloor, analogTotal);

  if (objCat === anCat) return 0.0;
  if (objCat === 'middle' && anCat === 'first') return 5.0;
  if (objCat === 'middle' && anCat === 'last') return 4.0;
  if (objCat === 'first' && anCat === 'middle') return -5.0;
  if (objCat === 'last' && anCat === 'middle') return -4.0;
  if (objCat === 'first' && anCat === 'last') return -1.0;
  if (objCat === 'last' && anCat === 'first') return 1.0;
  return 0.0;
}

/**
 * Расчёт поправки на отделку
 */
export function calculateFinishAdjustment(objFinish, analogFinish) {
  if (objFinish === analogFinish) return 0.0;
  if (objFinish === 'улучшенная' && analogFinish === 'простая') return 6.0;
  if (objFinish === 'простая' && analogFinish === 'улучшенная') return -6.0;
  return 0.0;
}

/**
 * Расчёт поправки на масштаб общей площади (Лейфер)
 */
export function calculateAreaAdjustment(objArea, analogArea) {
  if (!objArea || !analogArea || objArea === analogArea) return 0.0;
  const ratio = Math.pow(analogArea / objArea, 0.10) - 1;
  return Math.round(ratio * 10000) / 100;
}

/**
 * Полный сравнительный расчёт (Таблица 12.2, 12.5 и статистика вариации)
 */
export function calculateValuation(objectData, analogsList, tradeAdjustment = -6.0) {
  const selected = analogsList.filter(a => a.selected);
  if (!selected.length) {
    return {
      selectedCount: 0,
      total: null,
      pricePerSqm: null,
      meanPrice: null,
      stdDev: null,
      variationCoeff: null,
      variationPass: false,
      rows: [],
      shares: [],
    };
  }

  // 1. Построчный расчёт корректировок для каждого выбранного аналога
  const rows = selected.map(analog => {
    const rawPricePerSqm = analog.price / analog.area;
    const initialPricePerSqm = Math.round(rawPricePerSqm);

    // Последовательные корректировки в соответствии с таблицей 12.2
    const pTrade = rawPricePerSqm * (1 + tradeAdjustment / 100);
    const priceAfterTrade = Math.round(pTrade);

    const finishAdj = Number.isFinite(analog.finishAdj) ? analog.finishAdj : calculateFinishAdjustment(objectData.finish, analog.finish);
    const pFinish = pTrade * (1 + finishAdj / 100);
    const priceAfterFinish = Math.round(pFinish);

    const floorAdj = Number.isFinite(analog.floorAdj) ? analog.floorAdj : calculateFloorAdjustment(objectData.floor, objectData.totalFloors, analog.floor, analog.totalFloors);
    const pFloor = pFinish * (1 + floorAdj / 100);
    const priceAfterFloor = Math.round(pFloor);

    const areaAdj = Number.isFinite(analog.areaAdj) ? analog.areaAdj : calculateAreaAdjustment(objectData.area, analog.area);
    const pArea = pFloor * (1 + areaAdj / 100);
    const priceAfterArea = Math.round(pArea);

    // Подсчет количества ненулевых корректировок (Ki)
    let correctionsCount = 0;
    if (Math.abs(tradeAdjustment) > 0.001) correctionsCount++;
    if (Math.abs(finishAdj) > 0.001) correctionsCount++;
    if (Math.abs(floorAdj) > 0.001) correctionsCount++;
    if (Math.abs(areaAdj) > 0.001) correctionsCount++;

    return {
      ...analog,
      rawPricePerSqm,
      initialPricePerSqm,
      tradeAdjustment,
      priceAfterTrade,
      finishAdj,
      priceAfterFinish,
      floorAdj,
      priceAfterFloor,
      areaAdj,
      finalAdjustedPrice: priceAfterArea,
      correctionsCount,
    };
  });

  // 2. Расчёт весовых коэффициентов
  // Весовой коэффициент = (Общее кол-во корректировок - кол-во аналога) / (Общее кол-во * (N - 1))
  const N = rows.length;
  const totalCorrections = rows.reduce((sum, r) => sum + r.correctionsCount, 0);

  rows.forEach(r => {
    if (N === 1) {
      r.weight = 1.0;
    } else if (totalCorrections === 0) {
      r.weight = 1.0 / N;
    } else {
      const denom = totalCorrections * (N - 1);
      r.weight = denom > 0 ? (totalCorrections - r.correctionsCount) / denom : 1.0 / N;
    }
  });

  // 3. Средневзвешенная цена за 1 кв.м
  const weightedPricePerSqm = rows.reduce((sum, r) => sum + r.finalAdjustedPrice * r.weight, 0);
  const pricePerSqm = Math.round(weightedPricePerSqm);

  // 4. Итоговая рыночная стоимость полного права собственности (округление до 1 000 руб.)
  const rawTotal = pricePerSqm * objectData.area;
  const total = Math.round(rawTotal / 1000) * 1000;

  // 5. Статистический контроль выборки (Таблица 22 отчёта)
  const meanPrice = Math.round(rows.reduce((sum, r) => sum + r.finalAdjustedPrice, 0) / N);
  const variance = rows.reduce((sum, r) => sum + Math.pow(r.finalAdjustedPrice - meanPrice, 2), 0) / (N > 1 ? N - 1 : 1);
  const stdDev = Math.round(Math.sqrt(variance));
  const variationCoeff = meanPrice > 0 ? (stdDev / meanPrice) * 100 : 0;
  const variationPass = variationCoeff <= 33.0;

  // 6. Расчёт стоимости долей (Таблица 12.5 отчёта)
  const shares = (objectData.shares || []).map(sh => {
    const nominal = total * (sh.num / sh.den);
    const rounded = Math.round(nominal / 1000) * 1000;
    return {
      ...sh,
      nominal: Math.round(nominal),
      rounded,
      shareFraction: `${sh.num}/${sh.den}`,
      percentOfTotal: ((sh.num / sh.den) * 100).toFixed(2),
    };
  });

  return {
    selectedCount: N,
    total,
    rawTotal,
    pricePerSqm,
    exactWeightedPrice: weightedPricePerSqm,
    meanPrice,
    stdDev,
    variationCoeff,
    variationPass,
    totalCorrections,
    rows,
    shares,
  };
}
