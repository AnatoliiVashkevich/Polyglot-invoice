// Which phone notifications get scheduled. Run: cd mobile && npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { IOS_LIMIT, planNotifications, type PlanItem } from './notification-plan.ts';

const NOW = new Date(2026, 10, 19, 12, 0);
const base: PlanItem = {
  id: 'x', kind: 'task', status: 'created', date: '2026-11-20', time: '09:00', reminder_minutes: 60,
  title: 'Mount TV', address: '12 Palm St', client_name: 'Ann Lee', total: 0, due_date: null,
};

test('a task reminds before the visit and opens its job', () => {
  const [p] = planNotifications([base], NOW);
  assert.equal(p.at.getTime(), new Date(2026, 10, 20, 8, 0).getTime());
  assert.equal(p.title, 'Ann Lee at 09:00');
  assert.equal(p.body, 'Mount TV · 12 Palm St');
  assert.equal(p.url, '/job/x');
});

test('a note without a time counts from 9:00; done ones, past ones and no-reminder ones are skipped', () => {
  const note = { ...base, id: 'n', kind: 'note', time: '', reminder_minutes: 60, title: 'Pay insurance', client_name: '' };
  const [p] = planNotifications([note, { ...base, status: 'done' }, { ...base, reminder_minutes: null }, { ...base, date: '2026-11-18' }], NOW);
  assert.equal(p.at.getTime(), new Date(2026, 10, 20, 8, 0).getTime()); // 1 hour before 9:00 on the 20th
  assert.equal(p.title, '📝 Note');
  assert.equal(planNotifications([note, { ...base, status: 'done' }], NOW).length, 1);
  assert.equal(planNotifications([{ ...note, reminder_minutes: 1440 }], NOW).length, 0); // 9:00 today has passed
});

test('an invoice waiting for money: one notice 3 days after it is due, with the ready reminder', () => {
  const inv = { ...base, id: 'i', kind: 'invoice', status: 'requested', total: 450, due_date: '2026-11-20' };
  const [p] = planNotifications([inv, { ...inv, id: 'paid', status: 'paid' }], NOW);
  assert.equal(p.at.getTime(), new Date(2026, 10, 23, 9, 0).getTime());
  assert.match(p.title, /Ann Lee’s invoice \$450 is 3 days late/);
  assert.equal(p.url, '/job/i?remind=1');
});

test('soonest first, and never more than iOS keeps', () => {
  const many = Array.from({ length: 80 }, (_, i) => ({ ...base, id: `t${i}`, date: `2027-0${1 + (i % 9)}-1${i % 10}` }));
  const plan = planNotifications(many, NOW);
  assert.equal(plan.length, IOS_LIMIT);
  assert.ok(plan.every((p, i) => i === 0 || plan[i - 1].at <= p.at));
});
