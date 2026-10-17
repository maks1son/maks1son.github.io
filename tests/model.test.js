import test from 'node:test';
import assert from 'node:assert/strict';
import { adjustedPrice, calculate, newRecord } from '../src/model.js';
test('Поправки применяются последовательно, без промежуточного округления', () => assert.equal(adjustedPrice(200000, [-5, -2, -7, 0]), 173166));
test('В среднее попадают только выбранные аналоги; округление до тысячи', () => {
  const result = calculate(newRecord(true));
  assert.equal(result.rows.length, 3);
  assert.equal(result.total, 176000);
  assert.ok(Math.abs(result.exact - 175716.43333333332) < 0.01);
});
test('Без аналогов стоимость неизвестна, а не равна нулю', () => assert.equal(calculate(newRecord()).total, null));
test('Недопустимая цена или поправка не дают ложного результата', () => {
  for (const price of [0, -1, NaN, Infinity]) assert.throws(() => adjustedPrice(price, [0]));
  for (const adjustment of [-100, 101, NaN]) assert.throws(() => adjustedPrice(100, [adjustment]));
});
