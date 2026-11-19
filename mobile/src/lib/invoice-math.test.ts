// Run: cd mobile && npm test   (plain Node, no extra packages)
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { dueDate, parseAmount, totals, type Line } from './invoice-math.ts';

const LINES: Line[] = [
  { text: 'Single swing door', qty: 2, price: 200, kind: 'work' },
  { text: 'Double swing door', qty: 1, price: 300, kind: 'work' },
  { text: 'Materials', qty: 1, price: 64.5, kind: 'material' },
];

test('no tax by default', () => {
  assert.deepEqual(totals(LINES), { subtotal: 764.5, tax: 0, total: 764.5 });
});

test('sales tax on materials only (the decisions example: 7% → $4.52)', () => {
  assert.deepEqual(totals(LINES, 7, 'materials'), { subtotal: 764.5, tax: 4.52, total: 769.02 });
});

test('sales tax on everything', () => {
  assert.deepEqual(totals(LINES, 7, 'everything'), { subtotal: 764.5, tax: 53.52, total: 818.02 });
});

test('cents are exact', () => {
  assert.equal(totals([{ text: '', qty: 3, price: 0.1, kind: 'work' }]).total, 0.3);
  assert.equal(totals([{ text: '', qty: 1, price: 10, kind: 'work' }], 6.5, 'everything').tax, 0.65);
  assert.equal(totals([{ text: '', qty: 1.5, price: 33.33, kind: 'work' }]).total, 50); // 49.995 → 50.00
});

test('the same as the server for the server test cases', () => {
  // server/tests/test_api.py: 2 × 200 + materials 64.50 at 7% materials = 469.02
  const lines: Line[] = [
    { text: 'Door', qty: 2, price: 200, kind: 'work' },
    { text: 'Materials', qty: 1, price: 64.5, kind: 'material' },
  ];
  assert.equal(totals(lines, 7, 'materials').total, 469.02);
});

test('typed amounts', () => {
  assert.equal(parseAmount('200'), 200);
  assert.equal(parseAmount('$1,250.50'), 1250.5);
  assert.equal(parseAmount('64.'), 64);
  assert.equal(parseAmount('.5'), 0.5);
  assert.ok(Number.isNaN(parseAmount('abc')));
  assert.ok(Number.isNaN(parseAmount('')));
});

test('due date', () => {
  assert.equal(dueDate('2026-11-19', 0), '2026-11-19');
  assert.equal(dueDate('2026-11-19', 15), '2026-12-04');
  assert.equal(dueDate('2026-12-20', 30), '2027-01-19');
});
