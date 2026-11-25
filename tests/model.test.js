import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultObject,
  defaultAnalogs,
  defaultCases,
  calculateValuation,
  evaluateCaseQuality,
  sumSharesFraction,
  getRemainingShareFraction,
} from '../src/model.js';

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

test('evaluateCaseQuality: блокирует фиктивный статус «Готов» и пропускает эталонное дело', () => {
  const [annaCase, inProgressCase, draftCase] = defaultCases();

  const annaQuality = evaluateCaseQuality(annaCase);
  assert.equal(annaQuality.score, 100);
  assert.equal(annaQuality.canMarkReady, true);
  assert.equal(annaQuality.blockers.length, 0);

  // Дело без полного самоконтроля не может быть закрыто как «Готов»
  const lyudaQuality = evaluateCaseQuality(inProgressCase);
  assert.equal(lyudaQuality.canMarkReady, false);

  // Черновик без аналогов и с неполным чеклистом блокируется
  const draftQuality = evaluateCaseQuality(draftCase);
  assert.equal(draftQuality.canMarkReady, false);
  assert.ok(draftQuality.blockers.length >= 3);

  // Дело с отсутствующими ссылками и долями != 100% блокируется
  const badCase = structuredClone(annaCase);
  badCase.analogs[0].url = '';
  badCase.objectData.shares = [{ id: 's1', holder: 'Тест', num: 1, den: 2 }];
  const badQuality = evaluateCaseQuality(badCase);
  assert.equal(badQuality.canMarkReady, false);
  assert.ok(badQuality.blockers.some(b => b.includes('Ссылки-источники')));
  assert.ok(badQuality.blockers.some(b => b.includes('Долевая собственность')));
});

test('sumSharesFraction и getRemainingShareFraction: точный расчёт остатка до 100%', () => {
  const s1 = [{ num: 1, den: 3 }, { num: 1, den: 3 }];
  const rem = getRemainingShareFraction(s1);
  assert.equal(rem.num, 1);
  assert.equal(rem.den, 3);

  const full = sumSharesFraction([{ num: 1, den: 2 }, { num: 1, den: 2 }]);
  assert.equal(full.num, 1);
  assert.equal(full.den, 1);
  assert.equal(full.percent, 100);
});
