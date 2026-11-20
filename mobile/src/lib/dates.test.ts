// The calendar's date math. Run: cd mobile && npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addDays, addMonths, formatDay, formatMonth, formatTime, monthGrid, monthOf, weekdayNames, weeksIn } from './dates.ts';

test('a month shows only the weeks it needs (no extra row of next month)', () => {
  assert.equal(weeksIn('2026-11'), 5); // starts on Sunday, 30 days
  assert.equal(weeksIn('2026-02'), 4); // starts on Sunday, 28 days: exactly 4 weeks
  assert.equal(weeksIn('2026-08'), 6); // starts on Saturday, 31 days
  assert.equal(weeksIn('2027-02'), 5);
});

test('the grid starts on Sunday and covers the whole month', () => {
  const grid = monthGrid('2026-11');
  assert.equal(grid[0], '2026-11-01');
  const aug = monthGrid('2026-08').slice(0, weeksIn('2026-08') * 7);
  assert.equal(aug[0], '2026-07-26'); // the Sunday before Saturday, Aug 1
  assert.ok(aug.includes('2026-08-31'));
  assert.equal(aug.at(-1), '2026-09-05');
});

test('moving between months and days, across the year', () => {
  assert.equal(addMonths('2026-12', 1), '2027-01');
  assert.equal(addMonths('2026-01', -1), '2025-12');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(monthOf('2026-11-19'), '2026-11');
});

test('times show as AM / PM', () => {
  assert.equal(formatTime('14:30'), '2:30 PM');
  assert.equal(formatTime('00:05'), '12:05 AM');
  assert.equal(formatTime('12:00'), '12:00 PM');
});

test('month, day and weekday names for the calendar', () => {
  assert.equal(formatMonth('2026-11', 'en-US'), 'November');
  assert.equal(formatDay('2026-11-19', 'en-US'), 'Thursday, November 19');
  assert.deepEqual(weekdayNames('en-US'), ['S', 'M', 'T', 'W', 'T', 'F', 'S']);
});
