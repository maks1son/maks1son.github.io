import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { exportApartmentReport, numberToWordsRu } from '../src/report.js';
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
