import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { exportApartmentReport, numberToWordsRu, declineFioRu } from '../src/report.js';
import { defaultObject, defaultAnalogs } from '../src/model.js';

test('numberToWordsRu: корректно переводит суммы в слова на русском', () => {
  assert.equal(numberToWordsRu(3506000), 'три миллиона пятьсот шесть тысяч');
  assert.equal(numberToWordsRu(1468000), 'один миллион четыреста шестьдесят восемь тысяч');
  assert.equal(numberToWordsRu(190000), 'сто девяносто тысяч');
  assert.equal(numberToWordsRu(0), 'ноль');
  assert.equal(numberToWordsRu(1), 'один');
  assert.equal(numberToWordsRu(12), 'двенадцать');
});

test('exportApartmentReport: формирует полноценный официальный отчет об оценке по стандарту РусОценки', async () => {
  const customObject = {
    ...defaultObject(),
    reportNumber: '19/0826-2',
    client: 'Иванова Елена Ивановна',
  };

  const buffer = await exportApartmentReport(customObject, defaultAnalogs());
  assert.ok(buffer && buffer.length > 10_000, 'Документ успешно сформирован в формате DOCX');

  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file('word/document.xml').async('string');

  // Проверяем наличие ключевых официальных разделов ФСО
  assert.ok(xml.includes('ОСНОВНЫЕ ФАКТЫ И ВЫВОДЫ'), 'Документ содержит раздел 1');
  assert.ok(xml.includes('ЗАДАНИЕ НА ОЦЕНКУ'), 'Документ содержит раздел 2');
  assert.ok(xml.includes('СВЕДЕНИЯ О ЗАКАЗЧИКЕ ОЦЕНКИ И ОБ ОЦЕНЩИКЕ'), 'Документ содержит раздел 3');
  assert.ok(xml.includes('СТАНДАРТЫ ОЦЕНКИ'), 'Документ содержит раздел 4');
  assert.ok(xml.includes('РусОценка'), 'Документ содержит реквизиты ООО РусОценка');
  assert.ok(xml.includes('Орлова'), 'Документ содержит ФИО оценщика Орловой');

  // Проверяем наличие ключевых расчетов
  assert.ok(xml.includes('19/0826-2'), 'Номер дела отражен в документе');
  assert.ok(/3[\s\u00a0]*506[\s\u00a0]*000/.test(xml), 'Итоговая стоимость 3 506 000 руб. присутствует в документе');
  assert.ok(xml.includes('три миллиона пятьсот шесть тысяч'), 'Сумма прописью присутствует в документе');
  assert.ok(/52[\s\u00a0]*479/.test(xml), 'Средневзвешенная цена 52 479 руб./кв.м. присутствует в документе');

  // Проверяем корректную геометрию таблиц в twips (DXA), чтобы столбцы не схлопывались
  const gridCols = xml.match(/<w:gridCol w:w="(\d+)"\/>/g) || [];
  assert.ok(gridCols.length > 0, 'В таблицах определены gridCol ширины');
  for (const col of gridCols) {
    const w = Number(col.match(/w:w="(\d+)"/)[1]);
    assert.ok(w >= 400, `Ширина столбца ${w} twips должна быть >= 400 чтобы исключить вертикальные буквы`);
  }
});

test('exportApartmentReport: строго соответствует введенным данным нового дела и не содержит чужих данных', async () => {
  const customCase = {
    reportNumber: '25/1101-1',
    valuationDate: '2026-11-01',
    reportDate: '2026-11-02',
    propertyType: 'Жилое помещение (квартира)',
    rooms: 1,
    address: 'г. Тольятти, Автозаводский район, ул. 40 лет Победы, д. 10, кв. 88',
    cadastralNumber: '63:09:9999999:1111',
    area: 38.5,
    floor: 7,
    totalFloors: 14,
    wallMaterial: 'кирпич',
    finish: 'простая',
    condition: 'хорошее',
    balcony: 'да',
    furniture: 'нет',
    purpose: 'Оценка для совершения сделки купли-продажи',
    client: 'Кузнецов Михаил Викторович',
    appraiser: 'Орлова Анна Александровна',
    company: 'ООО «РусОценка»',
    tradeAdjustment: -5.0,
    shares: [
      { id: 's1', holder: 'Кузнецов Михаил Викторович', num: 1, den: 1 }
    ],
  };

  const customAnalogs = [
    {
      id: 'a1',
      number: 1,
      selected: true,
      address: 'г. Тольятти, Автозаводский район, ул. 40 лет Победы, д. 14',
      price: 2500000,
      area: 38.0,
      floor: 6,
      totalFloors: 14,
      wallMaterial: 'кирпич',
      finish: 'простая',
      condition: 'хорошее',
      balcony: 'да',
      furniture: 'нет',
      source: 'Циан',
      url: 'https://cian.ru/test1',
      published: 'ноябрь 2026г.',
      floorAdj: 0.0,
      finishAdj: 0.0,
      areaAdj: 0.0,
    },
    {
      id: 'a2',
      number: 2,
      selected: true,
      address: 'г. Тольятти, Автозаводский район, ул. Дзержинского, д. 22',
      price: 2600000,
      area: 39.0,
      floor: 1,
      totalFloors: 14,
      wallMaterial: 'кирпич',
      finish: 'простая',
      condition: 'хорошее',
      balcony: 'да',
      furniture: 'нет',
      source: 'Авито',
      url: 'https://avito.ru/test2',
      published: 'ноябрь 2026г.',
      floorAdj: 5.0,
      finishAdj: 0.0,
      areaAdj: 0.0,
    },
  ];

  const buffer = await exportApartmentReport(customCase, customAnalogs);
  assert.ok(buffer && buffer.length > 10_000);

  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file('word/document.xml').async('string');

  // Проверяем, что в документе отражены именно данные введенного дела:
  assert.ok(xml.includes('25/1101-1'), 'Номер нового дела присутствует в документе');
  assert.ok(xml.includes('Кузнецов Михаил Викторович'), 'Заказчик нового дела присутствует в документе');
  assert.ok(xml.includes('63:09:9999999:1111'), 'Кадастровый номер нового дела присутствует в документе');
  assert.ok(xml.includes('40 лет Победы, д. 10'), 'Адрес нового объекта присутствует в документе');
  assert.ok(xml.includes('38,5') || xml.includes('38.5'), 'Площадь нового объекта 38,5 м² присутствует в документе');
  assert.ok(xml.includes('1-комнатная'), 'Количество комнат (1-комнатная) присутствует в документе');
  assert.ok(xml.includes('40 лет Победы, д. 14'), 'Аналог №1 нового дела присутствует в документе');
  assert.ok(xml.includes('Дзержинского, д. 22'), 'Аналог №2 нового дела присутствует в документе');

  // Документ НЕ содержит чужих данных из другого дела:
  assert.ok(!xml.includes('Иванова Елена Ивановна'), 'В отчете нет чужого заказчика Ивановой');
  assert.ok(!xml.includes('Разрезов'), 'В отчете нет чужих сособственников Разрезовых');
  assert.ok(!xml.includes('Новосадовая, д. 1, кв. 49'), 'В отчете нет чужого адреса Новосадовой');
  assert.ok(!xml.includes('66,8') && !xml.includes('66.8'), 'В отчете нет чужой площади 66,8');
});

test('declineFioRu: корректно склоняет мужские и женские ФИО в Р.п., Д.п. и Т.п.', () => {
  assert.equal(declineFioRu('Иванова Елена Ивановна', 'gen'), 'Ивановой Елены Ивановны');
  assert.equal(declineFioRu('Иванова Елена Ивановна', 'dat'), 'Ивановой Елене Ивановне');
  assert.equal(declineFioRu('Иванова Елена Ивановна', 'ins'), 'Ивановой Еленой Ивановной');

  assert.equal(declineFioRu('Орлова Анна Александровна', 'ins'), 'Орловой Анной Александровной');
  assert.equal(declineFioRu('Ивановская Ксения Ильинична', 'gen'), 'Ивановской Ксении Ильиничны');
  assert.equal(declineFioRu('Ивановская Ксения Ильинична', 'dat'), 'Ивановской Ксении Ильиничне');

  assert.equal(declineFioRu('Кузнецов Михаил Викторович', 'gen'), 'Кузнецова Михаила Викторовича');
  assert.equal(declineFioRu('Кузнецов Михаил Викторович', 'dat'), 'Кузнецову Михаилу Викторовичу');
  assert.equal(declineFioRu('Кузнецов Михаил Викторович', 'ins'), 'Кузнецовым Михаилом Викторовичем');

  assert.equal(declineFioRu('Волков Пётр Алексеевич', 'gen'), 'Волкова Петра Алексеевича');
  assert.equal(declineFioRu('Волков Пётр Алексеевич', 'dat'), 'Волкову Петру Алексеевичу');
  assert.equal(declineFioRu('Ивановский Сергей Игоревич', 'gen'), 'Ивановского Сергея Игоревича');
  assert.equal(declineFioRu('Ивановский Сергей Игоревич', 'dat'), 'Ивановскому Сергею Игоревичу');
  assert.equal(declineFioRu('Коваленко Илья Никитич', 'gen'), 'Коваленко Ильи Никитича');
  assert.equal(declineFioRu('Коваленко Ольга Павловна', 'dat'), 'Коваленко Ольге Павловне');
});

test('exportApartmentReport: индивидуальная собственность (1/1), нестандартные поправки, статистика рынка и Приложение №3 без следов эталона', async () => {
  const customCase = {
    reportNumber: '30/1205-4',
    valuationDate: '2026-12-05',
    reportDate: '2026-12-06',
    propertyType: 'Жилое помещение (квартира)',
    rooms: 2,
    address: 'г. Тольятти, Центральный район, ул. Мира, д. 50, кв. 12',
    cadastralNumber: '63:09:0301018:7777',
    area: 50.0,
    floor: 2,
    totalFloors: 9,
    wallMaterial: 'монолит',
    finish: 'простая',
    condition: 'отличное',
    balcony: 'нет',
    furniture: 'нет',
    purpose: 'Определение рыночной стоимости для ипотечного кредитования',
    client: 'Соколова Светлана Николаевна',
    appraiser: 'Волков Пётр Алексеевич',
    company: 'ООО «РусОценка»',
    tradeAdjustment: -4.0,
    shares: [
      { id: 's1', holder: 'Соколова Светлана Николаевна', num: 1, den: 1 },
    ],
  };

  const customAnalogs = [
    {
      id: 'a1',
      number: 1,
      selected: true,
      address: 'г. Тольятти, Центральный район, ул. Мира, д. 48',
      price: 3100000,
      area: 50.0,
      floor: 1,
      totalFloors: 9,
      wallMaterial: 'монолит',
      finish: 'простая',
      condition: 'отличное',
      balcony: 'нет',
      furniture: 'нет',
      source: 'Циан',
      url: 'https://cian.ru/custom-analog-1',
      published: 'декабрь 2026г.',
      floorAdj: 5.0,
      finishAdj: 0.0,
      areaAdj: 0.0,
    },
    {
      id: 'a2',
      number: 2,
      selected: true,
      address: 'г. Тольятти, Центральный район, ул. Карла Маркса, д. 12',
      price: 3400000,
      area: 50.0,
      floor: 9,
      totalFloors: 9,
      wallMaterial: 'монолит',
      finish: 'улучшенная',
      condition: 'отличное',
      balcony: 'нет',
      furniture: 'нет',
      source: 'Домклик',
      url: 'https://domclick.ru/custom-analog-2',
      published: 'декабрь 2026г.',
      floorAdj: 4.0,
      finishAdj: -6.0,
      areaAdj: 0.0,
    },
    {
      id: 'a3',
      number: 3,
      selected: true,
      address: 'г. Тольятти, Центральный район, ул. Победы, д. 30',
      price: 3250000,
      area: 50.0,
      floor: 5,
      totalFloors: 9,
      wallMaterial: 'монолит',
      finish: 'простая',
      condition: 'отличное',
      balcony: 'нет',
      furniture: 'нет',
      source: 'Циан',
      url: 'https://cian.ru/custom-analog-3',
      published: 'декабрь 2026г.',
      floorAdj: 0.0,
      finishAdj: 0.0,
      areaAdj: 0.0,
    },
  ];

  const buffer = await exportApartmentReport(customCase, customAnalogs);
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file('word/document.xml').async('string');
  const rels = await zip.file('word/_rels/document.xml.rels').async('string');
  const plainText = xml.replace(/<[^>]+>/g, '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ');
  const tables = xml.match(/<w:tbl(?:\s+[^>]*)?>[\s\S]*?<\/w:tbl>/g) || [];

  // 1. В итоговых таблицах (2 и 24) при 1/1 только 1 строка полного права без 1/1 доли
  for (const idx of [2, 24]) {
    const rows = tables[idx].match(/<w:tr(?:\s+[^>]*)?>[\s\S]*?<\/w:tr>/g) || [];
    assert.equal(rows.length, 2, `Таблица ${idx} при индивидуальной собственности должна иметь заголовок и 1 строку`);
    assert.ok(!tables[idx].includes('1/1 доли'), `Таблица ${idx} не содержит лишней строки 1/1 доли`);
  }

  // 2. В таблицах 3, 5, 13, 18, 19 и в тексте после таблицы 19 указана индивидуальная собственность
  for (const idx of [3, 5, 13, 18, 19]) {
    const tblText = tables[idx].replace(/<[^>]+>/g, '').toLowerCase();
    assert.ok(tblText.includes('индивидуальная собственность'), `Таблица ${idx} содержит «индивидуальная собственность»`);
  }
  assert.ok(plainText.includes('Имущественные права на Объект оценки – индивидуальная собственность'), 'Текст после таблицы 19 указывает индивидуальную собственность');
  assert.ok(plainText.includes('единоличное владение'), 'Абзац о долях адаптирован для единоличного владения');
  assert.ok(!plainText.includes('все доли в праве на объект оценки реализуются совместно'));

  // 3. В таблице 5 заменено описание этажа и материала стен
  const t5Text = tables[5].replace(/<[^>]+>/g, '');
  assert.ok(t5Text.includes('2-м этаже 9-этажного монолитного'), 'Таблица 5 отражает реальный этаж, этажность и материал стен');

  // 4. Динамические пояснения под Таблицей 12.2
  assert.ok(plainText.includes('понижающая корректировка -4%'), 'Торг отражен с фактическим процентом -4%');
  assert.ok(plainText.includes('декабрь 2026г.'), 'Дата предложения отражена фактически');
  assert.ok(plainText.includes('05.12.2026г.'), 'Дата оценки отражена фактически');
  assert.ok(plainText.includes('соответствует категории «простая» для объектов-аналогов №№1,3 и «улучшенная» для объекта-аналога №2'), 'Группировка отделки верная');
  assert.ok(plainText.includes('понижающая корректировка -6% в цену объекта-аналога №2'), 'Поправка на отделку отражает аналог №2');
  assert.ok(plainText.includes('повышающая корректировка 5% в цену объекта-аналога №1 и повышающая корректировка 4% в цену объекта-аналога №2'), 'Группировка поправок на этаж точная');
  assert.ok(plainText.includes('с идентичным материалом стен – монолит'), 'Материал стен в пояснении обновлен');
  assert.ok(plainText.includes('соответствующим состоянию «отличное»'), 'Состояние в пояснении обновлено');
  assert.ok(plainText.includes('не обеспечены балконом/лоджией'), 'Балкон/лоджия в пояснении обновлен');
  assert.ok(plainText.includes('без мебели и встроенной техники'), 'Мебель в пояснении обновлена');
  assert.ok(plainText.includes('62 787 руб. * 50,0 кв.м. = 3 139 000 руб.'), 'Итоговая формула под таблицей 12.2 рассчитана точно');
  assert.ok(plainText.includes('Волковым Петром Алексеевичем'), 'ФИО оценщика в Т.п. просклонено корректно');
  assert.ok(plainText.includes('П. А. Волков'), 'Инициалы и фамилия оценщика в подписи обновлены');

  // 5. Таблица 16 и абзацы рынка, сегмент, Приложение №3
  const t16Text = tables[16].replace(/<[^>]+>/g, '').replace(/\u00a0/g, ' ');
  assert.ok(t16Text.includes('9 750 000'), 'Объем рынка в Таблице 16 рассчитан по аналогам дела');
  assert.ok(plainText.includes('3 предложения к продаже 2-комнатных квартир в Центральном районе'), 'Сегмент (кол-во комнат и район) обновлен');
  assert.ok(plainText.includes('2-комнатных квартир в г. Тольятти'), 'Сегмент в разделе 12 обновлен');
  assert.ok(plainText.includes('Объем данной выборки составляет 3 объекта'), 'Объем выборки в разделе 12 обновлен');
  assert.ok(plainText.includes('https://cian.ru/custom-analog-1'));
  assert.ok(plainText.includes('https://domclick.ru/custom-analog-2'));
  assert.ok(plainText.includes('https://cian.ru/custom-analog-3'));
  assert.ok(rels.includes('https://cian.ru/custom-analog-1'));
  assert.ok(rels.includes('https://domclick.ru/custom-analog-2'));

  // 6. Отсутствуют чужие фразы и ссылки из эталона
  const forbiddenPhrases = [
    '№№3,4',
    '№№3,5',
    '66,8',
    'август 2026г.',
    'Ивановой',
    'Разрезов',
    '4504033738',
    '2861826719',
    'realty317893',
    'realty306332',
    'realty305309',
    '12 предложений',
    '809 кв.м',
    '42,86',
  ];
  for (const phrase of forbiddenPhrases) {
    assert.ok(!xml.includes(phrase), `В document.xml не должно быть эталонного следа: ${phrase}`);
  }
  assert.ok(!rels.includes('4504033738') && !rels.includes('realty317893'), 'В rels нет старых ссылок Авито/Волга-Инфо');
});

test('exportApartmentReport: переносит новые жёлтые поля (осмотр, санузел, ЕГРН, дом, окружение) в таблицы 5, 11–14', async () => {
  const customObj = {
    ...defaultObject(),
    reportNumber: '26/1201-5',
    inspectionAccess: 'provided',
    bathroom: 'Совмещённый',
    basisDoc: 'Договор долевого участия №45-Д от 12.04.2021г.',
    encumbrances: 'Ипотека в силу закона',
    domclickUrl: 'https://tolyatti.domclick.ru/building/test-building-99',
    buildYear: '2018',
    series: 'Монолитно-каркасный',
    playground: 'нет',
    sportsGround: 'да',
    entranceSecurity: 'консьерж, видеонаблюдение',
    parking: 'подземный паркинг',
    stopDistance: 'в 150 м от дома на ул. Фрунзе.',
    envDesc: 'Закрытый двор без машин, озеленение',
    infra: {
      school: true,
      kindergarten: false,
      bank: false,
      services: true,
      retail: true,
      pharmacy: false,
    },
  };

  const buffer = await exportApartmentReport(customObj, defaultAnalogs());
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file('word/document.xml').async('string');
  const tables = xml.match(/<w:tbl\b[\s\S]*?<\/w:tbl>/g) || [];
  const strip = s => s.replace(/<[^>]+>/g, ' ').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();

  const t5 = strip(tables[5]);
  assert.ok(t5.includes('проведён натурный осмотр объекта оценки с фотофиксацией'), 'Таблица 5 r11c2 отражает натурный осмотр');
  assert.ok(!strip(xml).includes('Оценщику не был предоставлен доступ в оцениваемое помещение'), 'Отсутствует фраза про отсутствие доступа при provided');

  const t11 = strip(tables[11]);
  assert.ok(t11.includes('в 150 м от дома на ул. Фрунзе.'), 'Таблица 11 r3c1 содержит stopDistance');
  assert.ok(t11.includes('Детский сад Нет'), 'Таблица 11 отражает отключенный детский сад');
  assert.ok(t11.includes('Аптека Нет'), 'Таблица 11 отражает отключенную аптеку');
  assert.ok(t11.includes('Закрытый двор без машин, озеленение'), 'Таблица 11 r15c1 содержит envDesc');

  const t12 = strip(tables[12]);
  assert.ok(t12.includes('https://tolyatti.domclick.ru/building/test-building-99'), 'Таблица 12 содержит domclickUrl');
  assert.ok(t12.includes('2018'), 'Таблица 12 содержит buildYear');
  assert.ok(t12.includes('Монолитно-каркасный'), 'Таблица 12 содержит series');
  assert.ok(t12.includes('детская площадка нет'), 'Таблица 12 содержит playground');
  assert.ok(t12.includes('спортивная площадка да'), 'Таблица 12 содержит sportsGround');
  assert.ok(t12.includes('консьерж, видеонаблюдение'), 'Таблица 12 содержит entranceSecurity');
  assert.ok(t12.includes('подземный паркинг'), 'Таблица 12 содержит parking');

  const t13 = strip(tables[13]);
  assert.ok(t13.includes('Договор долевого участия №45-Д от 12.04.2021г.'), 'Таблица 13 содержит basisDoc');
  assert.ok(t13.includes('Ипотека в силу закона'), 'Таблица 13 содержит encumbrances');

  const t14 = strip(tables[14]);
  assert.ok(t14.includes('Совмещённый'), 'Таблица 14 r8c1 содержит bathroom');
  assert.ok(t14.includes('Акт натурного осмотра и фотофиксация'), 'Таблица 14 отражает источник осмотра');
});
