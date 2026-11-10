import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultObject, defaultAnalogs, calculateValuation } from '../src/model.js';

test('Модель дает точное совпадение с официальным отчетом Анны (Дело № 19/0826-2)', () => {
  const obj = defaultObject();
  const analogs = defaultAnalogs();
  const result = calculateValuation(obj, analogs, -6.0);

  // 1. Все 5 аналогов отобраны
  assert.equal(result.selectedCount, 5);

  // 2. Итоговая рыночная стоимость: 3 506 000 руб.
  assert.equal(result.total, 3506000);

  // 3. Средневзвешенная цена 1 кв.м: 52 479 руб./кв.м
  assert.equal(result.pricePerSqm, 52479);

  // 4. Проверка количества поправок по каждому аналогу (строка 14 отчета)
  const corrections = result.rows.map(r => r.correctionsCount);
  assert.deepEqual(corrections, [2, 3, 4, 3, 3]);
  assert.equal(result.totalCorrections, 15);

  // 5. Проверка весов аналогов (строка 15 отчета: 0.2167, 0.2000, 0.1833, 0.2000, 0.2000)
  const weights = result.rows.map(r => Number(r.weight.toFixed(4)));
  assert.deepEqual(weights, [0.2167, 0.2000, 0.1833, 0.2000, 0.2000]);

  // 6. Проверка коэффициента вариации (Таблица 22: ~4.09% <= 33%)
  assert.ok(result.variationCoeff < 10.0);
  assert.equal(result.variationPass, true);

  // 7. Проверка расчета долей (Таблица 12.5)
  // Доли 193/461 должны давать 1 468 000 руб., а доли 25/461 — 190 000 руб.
  assert.equal(result.shares[0].rounded, 1468000);
  assert.equal(result.shares[1].rounded, 1468000);
  assert.equal(result.shares[2].rounded, 190000);
  assert.equal(result.shares[3].rounded, 190000);
  assert.equal(result.shares[4].rounded, 190000);

  // Сумма округленных долей
  const sumShares = result.shares.reduce((s, sh) => s + sh.rounded, 0);
  assert.equal(sumShares, 3506000);
});

test('Пересчет корректно реагирует на отключение аналога', () => {
  const obj = defaultObject();
  const analogs = defaultAnalogs();
  analogs[0].selected = false; // исключаем аналог 1

  const result = calculateValuation(obj, analogs, -6.0);
  assert.equal(result.selectedCount, 4);
  assert.ok(result.total > 0);
  // Сумма весов 4 оставшихся аналогов строго равна 1.0
  const sumWeights = result.rows.reduce((s, r) => s + r.weight, 0);
  assert.ok(Math.abs(sumWeights - 1.0) < 0.001);
});
