import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultCases } from '../src/model.js';
import { toggleCasePin } from '../src/storage.js';

test('Реестр дел содержит эталонное, незаконченное и черновик дела с поддержкой закрепления', () => {
  const cases = defaultCases();
  assert.equal(cases.length, 3, 'В реестре по умолчанию должно быть 3 дела');

  const annaCase = cases.find(c => c.number === '19/0826-2');
  assert.ok(annaCase, 'Дело № 19/0826-2 присутствует');
  assert.equal(annaCase.status, 'Готов');
  assert.equal(annaCase.isPinned, true, 'Эталонное дело Анны закреплено на главной');
  assert.equal(annaCase.progress, 100);

  const inProgressCase = cases.find(c => c.status === 'В работе');
  assert.ok(inProgressCase, 'Есть дело в работе');
  assert.equal(inProgressCase.number, '21/0926-1');
  assert.equal(inProgressCase.progress, 75);

  const draftCase = cases.find(c => c.status === 'Черновик');
  assert.ok(draftCase, 'Есть незаконченное дело-черновик');
  assert.equal(draftCase.number, '24/1105-3');
  assert.equal(draftCase.progress, 25);
});

test('toggleCasePin: корректно переключает статус закрепления дела', () => {
  const cases = defaultCases();
  const target = cases[0];
  const initialPinned = target.isPinned;

  toggleCasePin(cases, target.id);
  assert.equal(target.isPinned, !initialPinned, 'Статус закрепления должен инвертироваться');

  toggleCasePin(cases, target.id);
  assert.equal(target.isPinned, initialPinned, 'Повторный клик возвращает исходный статус');
});
