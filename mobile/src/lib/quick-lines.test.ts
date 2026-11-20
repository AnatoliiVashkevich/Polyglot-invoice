// "Describe the work and prices" without the AI. Run: cd mobile && npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { quickLines } from './quick-lines.ts';

const rows = (text: string) => quickLines(text).map((l) => [l.text, l.qty, l.price]);

test('one line per part, the amount at the end is the price', () => {
  assert.deepEqual(rows('door installation 300\nhang 2 shelves 80'), [
    ['Door installation', 1, 300],
    ['Hang 2 shelves', 1, 80],
  ]);
});

test('commas split lines but not thousands', () => {
  assert.deepEqual(rows('deck repair 1,500, paint $200'), [
    ['Deck repair', 1, 1500],
    ['Paint', 1, 200],
  ]);
});

test('counts: each / x / at, and one amount with a count is the total', () => {
  assert.deepEqual(rows('2 doors 200 each'), [['Doors', 2, 200]]);
  assert.deepEqual(rows('labor 3 x 60'), [['Labor', 3, 60]]);
  assert.deepEqual(rows('labor 3 at 60'), [['Labor', 3, 60]]);
  assert.deepEqual(rows('2 double swing doors installation and adjustment 700'), [['Double swing doors installation and adjustment', 2, 350]]);
  assert.deepEqual(rows('kitchen 1.5k'), [['Kitchen', 1, 1500]]);
});

test('no amount: the line stays, the price is left for the user', () => {
  assert.deepEqual(rows('clean up the yard'), [['Clean up the yard', 1, 0]]);
  assert.deepEqual(rows(' \n , '), []);
});

test('other languages keep their words', () => {
  assert.deepEqual(rows('установка двери 300'), [['Установка двери', 1, 300]]);
  assert.deepEqual(rows('2 puertas 200 cada'), [['Puertas', 2, 200]]);
});
