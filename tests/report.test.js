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

test('exportApartmentReport: формирует полноценный 60-страничный документ по официальному шаблону', async () => {
  const customObject = {
    ...defaultObject(),
    reportNumber: '19/0826-2',
    client: 'Иванова Елена Ивановна',
  };

  const buffer = await exportApartmentReport(customObject, defaultAnalogs());
  assert.ok(buffer && buffer.length > 5_000_000, 'Размер готового документа должен соответствовать 60-страничному оригиналу (>5 МБ)');

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
