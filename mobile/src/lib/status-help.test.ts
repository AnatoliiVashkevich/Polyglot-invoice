// The plain line under every status, and "is the visit still ahead?". Run: cd mobile && npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isAhead, statusHelp } from './status-help.ts';

test('a task says when its reminder comes, and that a done one has none', () => {
  assert.equal(statusHelp({ kind: 'task', status: 'created', date: '2026-11-27', reminderMinutes: 60 }), 'You get a reminder 1 hour before.');
  assert.equal(statusHelp({ kind: 'task', status: 'created', date: '2026-11-27', reminderMinutes: null }), 'No reminder is set.');
  assert.equal(statusHelp({ kind: 'note', status: 'done', date: '2026-11-27' }), 'Finished. No more reminders for it.');
});

test('invoices and estimates say who can see them and what to tap next', () => {
  assert.match(statusHelp({ kind: 'invoice', status: 'created', date: '2026-11-19' }), /Only you can see it/);
  assert.match(statusHelp({ kind: 'invoice', status: 'requested', date: '2026-11-19' }), /Mark Paid/);
  assert.match(statusHelp({ kind: 'estimate', status: 'sent', date: '2026-11-19' }), /Schedule the job/);
});

test('a visit later today or on a later day is still ahead', () => {
  const now = new Date(2026, 10, 19, 12, 0);
  assert.equal(isAhead({ date: '2026-11-19', time: '14:00' }, now), true);
  assert.equal(isAhead({ date: '2026-11-19', time: '09:00' }, now), false);
  assert.equal(isAhead({ date: '2026-11-20' }, now), true);
  assert.equal(isAhead({ date: '2026-11-18' }, now), false);
});

test('a paid invoice says it is locked', () => {
  assert.match(statusHelp({ kind: 'invoice', status: 'paid', date: '2026-11-19' }), /locked/);
  assert.match(statusHelp({ kind: 'estimate', status: 'created', date: '2026-11-19' }), /Send estimate/);
});
