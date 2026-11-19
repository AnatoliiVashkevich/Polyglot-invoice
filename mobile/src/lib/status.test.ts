// The red "overdue" mark. Run: cd mobile && npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isOverdue } from './status.ts';

const TODAY = '2026-11-19';

test('requested and past the due date = overdue', () => {
  assert.equal(isOverdue({ kind: 'invoice', status: 'requested', dueDate: '2026-11-18' }, TODAY), true);
});

test('due today is not overdue yet', () => {
  assert.equal(isOverdue({ kind: 'invoice', status: 'requested', dueDate: TODAY }, TODAY), false);
});

test('only invoices waiting for money can be overdue', () => {
  assert.equal(isOverdue({ kind: 'invoice', status: 'created', dueDate: '2026-11-01' }, TODAY), false); // not sent
  assert.equal(isOverdue({ kind: 'invoice', status: 'paid', dueDate: '2026-11-01' }, TODAY), false);
  assert.equal(isOverdue({ kind: 'estimate', status: 'sent', dueDate: '2026-11-01' }, TODAY), false);
  assert.equal(isOverdue({ kind: 'invoice', status: 'requested' }, TODAY), false); // no due date
});
