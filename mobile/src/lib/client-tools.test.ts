// Clients: search, Call / Text / Navigate links, Paid total / Owes now. Run: cd mobile && npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { callUrl, clientMoney, filterJobs, mapsUrl, matches, monthGroups, newestFirst, phoneKey, textUrl } from './client-tools.ts';

test('search finds by any part of the name, email, or 3+ digits of the phone', () => {
  assert.equal(matches('ann', 'Ann Lee', '561-555-0101', ''), true);
  assert.equal(matches('lee ann', 'Ann Lee', '', ''), true);
  assert.equal(matches('5550101', 'Ann Lee', '(561) 555-0101', ''), true);
  assert.equal(matches('bob', 'Ann Lee', '561-555-0101', 'ann@x.com'), false);
});

test('the same phone written differently is the same number', () => {
  assert.equal(phoneKey('+1 (561) 555-0101'), phoneKey('561-555-0101'));
  assert.equal(phoneKey('12'), '');
});

test('Call / Text / Navigate links, and none without a number or address', () => {
  assert.equal(callUrl('+1 (561) 555-0101'), 'tel:+15615550101');
  assert.equal(textUrl('561 555 0101'), 'sms:5615550101');
  assert.equal(callUrl(''), '');
  assert.equal(mapsUrl('12 Palm St, Boca Raton FL'), 'https://maps.apple.com/?daddr=12%20Palm%20St%2C%20Boca%20Raton%20FL');
  assert.equal(mapsUrl('  '), '');
});

test('paid total counts paid invoices; owes counts sent invoices waiting for money', () => {
  const items = [
    { kind: 'invoice', status: 'paid', amount: 100.1 },
    { kind: 'invoice', status: 'paid', amount: 200.2 },
    { kind: 'invoice', status: 'requested', amount: 50 },
    { kind: 'invoice', status: 'created', amount: 999 }, // not sent yet: not owed
    { kind: 'estimate', status: 'sent', amount: 777 },
    { kind: 'task', status: 'done' },
  ];
  assert.deepEqual(clientMoney(items), { paid: 300.3, owes: 50 });
});

test('jobs newest first', () => {
  const rows = [
    { date: '2026-10-01' },
    { date: '2026-11-19', time: '09:00' },
    { date: '2026-11-19', time: '14:00' },
  ];
  assert.deepEqual(newestFirst(rows).map((r) => `${r.date} ${r.time ?? ''}`.trim()), ['2026-11-19 14:00', '2026-11-19 09:00', '2026-10-01']);
});

test('client page filters: invoices, estimates, tasks, and what is owed', () => {
  const items = [
    { kind: 'invoice', status: 'paid', amount: 100 },
    { kind: 'invoice', status: 'requested', amount: 50 },
    { kind: 'estimate', status: 'sent', amount: 70 },
    { kind: 'task', status: 'done' },
  ];
  assert.equal(filterJobs(items, 'all').length, 4);
  assert.equal(filterJobs(items, 'invoice').length, 2);
  assert.deepEqual(filterJobs(items, 'owes'), [items[1]]);
  assert.deepEqual(filterJobs(items, 'task'), [items[3]]);
});

test('jobs grouped by month with the invoiced amount', () => {
  const groups = monthGroups([
    { date: '2026-11-19', kind: 'invoice', status: 'paid', amount: 100.1 },
    { date: '2026-11-02', kind: 'task', status: 'done' },
    { date: '2026-11-01', kind: 'invoice', status: 'requested', amount: 200.2 },
    { date: '2026-10-30', kind: 'estimate', status: 'sent', amount: 900 },
  ]);
  assert.deepEqual(groups.map((g) => [g.month, g.items.length, g.invoiced]), [['2026-11', 3, 300.3], ['2026-10', 1, 0]]);
});
