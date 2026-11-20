// "What kind of work do you do?" — saving and reading back. Run: cd mobile && npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { joinTrade, splitTrade } from './trades.ts';

test('chips and Other become one text, in list order', () => {
  assert.equal(joinTrade(['Cleaning', 'Handyman / repair'], ' Mobile car detailing '), 'Handyman / repair, Cleaning, Mobile car detailing');
  assert.equal(joinTrade([], ''), '');
  assert.equal(joinTrade([], 'x'.repeat(400)).length, 300);
});

test('the saved text comes back as the same chips and Other', () => {
  assert.deepEqual(splitTrade('Handyman / repair, Cleaning, Mobile car detailing, Pressure washing'), {
    chosen: ['Handyman / repair', 'Cleaning'],
    other: 'Mobile car detailing, Pressure washing',
  });
  assert.deepEqual(splitTrade(''), { chosen: [], other: '' });
});
