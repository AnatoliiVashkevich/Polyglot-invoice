// Repeating tasks and notes: the choices and how a rule reads. Run: cd mobile && npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { choiceOf, parseEvery, repeatLabel } from './repeat-rule.ts';

test('a rule reads plainly', () => {
  assert.equal(repeatLabel(null), 'Does not repeat');
  assert.equal(repeatLabel({ every: 1, unit: 'week', until: null }), 'Every week');
  assert.equal(repeatLabel({ every: 3, unit: 'day', until: null }), 'Every 3 days');
  assert.equal(repeatLabel({ every: 1, unit: 'month', until: '2027-03-01' }, (d) => `[${d}]`), 'Every month until [2027-03-01]');
});

test('the ready choice a rule matches, or custom', () => {
  assert.equal(choiceOf(null), 'never');
  assert.equal(choiceOf({ every: 2, unit: 'week', until: '2027-01-01' }), '2weeks');
  assert.equal(choiceOf({ every: 10, unit: 'day', until: null }), 'custom');
});

test('custom every N: whole numbers 1 to 365', () => {
  assert.equal(parseEvery('3'), 3);
  assert.equal(parseEvery('0'), null);
  assert.equal(parseEvery('1.5'), null);
  assert.equal(parseEvery('400'), null);
});
