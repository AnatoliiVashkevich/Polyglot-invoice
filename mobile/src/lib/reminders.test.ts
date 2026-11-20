// Phone notification timing and the client reminder text. Run: cd mobile && npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { lateNoticeAt, localDateTime, reminderLabel, reminderMessage, taskReminderAt } from './reminders.ts';

const NOW = new Date(2026, 10, 19, 12, 0); // Nov 19, 2026, noon (months count from 0)

test('a task reminder fires the chosen time before the job', () => {
  const at = taskReminderAt({ date: '2026-11-20', time: '14:00', reminderMinutes: 60, status: 'created' }, NOW);
  assert.deepEqual(at, new Date(2026, 10, 20, 13, 0));
  const dayBefore = taskReminderAt({ date: '2026-11-20', time: '14:00', reminderMinutes: 1440, status: 'created' }, NOW);
  assert.deepEqual(dayBefore, new Date(2026, 10, 19, 14, 0));
});

test('no reminder: none chosen, already past, or the job is done', () => {
  assert.equal(taskReminderAt({ date: '2026-11-20', time: '14:00', reminderMinutes: null, status: 'created' }, NOW), null);
  assert.equal(taskReminderAt({ date: '2026-11-19', time: '12:30', reminderMinutes: 60, status: 'created' }, NOW), null);
  assert.equal(taskReminderAt({ date: '2026-11-20', time: '14:00', reminderMinutes: 60, status: 'done' }, NOW), null);
});

test('a task without a time counts as 9:00', () => {
  assert.deepEqual(localDateTime('2026-11-20'), new Date(2026, 10, 20, 9, 0));
});

test('the late invoice notice comes once, 3 days after the due date, at 9:00', () => {
  assert.deepEqual(lateNoticeAt({ status: 'requested', dueDate: '2026-11-18' }, NOW), new Date(2026, 10, 21, 9, 0));
  assert.equal(lateNoticeAt({ status: 'requested', dueDate: '2026-11-10' }, NOW), null); // already past
  assert.equal(lateNoticeAt({ status: 'paid', dueDate: '2026-11-18' }, NOW), null);
  assert.equal(lateNoticeAt({ status: 'created', dueDate: '2026-11-18' }, NOW), null); // not sent yet
  assert.equal(lateNoticeAt({ status: 'requested', dueDate: null }, NOW), null);
});

test('the reminder message is short and polite', () => {
  const text = reminderMessage({ clientName: 'Ann Lee', number: 'INV-0012', total: 450 }, 'Fix-It Pro');
  assert.match(text, /^Hi Ann, just a friendly reminder about invoice INV-0012 for \$450\./);
  assert.match(text, /If it's already paid, please ignore this message\./);
  assert.match(text, /Fix-It Pro$/);
  assert.match(reminderMessage({ total: 764.5 }), /^Hello, .* for \$764\.50\./);
});

test('reminder choices read plainly', () => {
  assert.deepEqual([null, 30, 60, 1440].map((m) => reminderLabel(m as never)), ['No reminder', '30 min before', '1 hour before', '1 day before']);
});
