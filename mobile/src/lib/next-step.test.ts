// The decisions table "The job is… / The big button says". Run: cd mobile && npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { nextSteps } from './next-step.ts';

test('the big button for every stage', () => {
  assert.deepEqual(nextSteps({ kind: 'estimate', status: 'created' }), ['send-estimate']);
  assert.deepEqual(nextSteps({ kind: 'estimate', status: 'sent' }), ['schedule', 'make-invoice']);
  assert.deepEqual(nextSteps({ kind: 'task', status: 'created' }), ['job-done']);
  assert.deepEqual(nextSteps({ kind: 'invoice', status: 'created' }, { hasTask: true }), ['send-invoice']);
  assert.deepEqual(nextSteps({ kind: 'invoice', status: 'requested' }, { hasTask: true }), ['mark-paid']);
});

test('finished jobs have no big button', () => {
  assert.deepEqual(nextSteps({ kind: 'invoice', status: 'paid' }, { hasTask: true }), []);
});

test('a repeating task: big Done, Make invoice smaller; a note: Done', () => {
  assert.deepEqual(nextSteps({ kind: 'task', status: 'created', series_id: 's1' }), ['done', 'invoice-from-task']);
  assert.deepEqual(nextSteps({ kind: 'note', status: 'created' }), ['done']);
  assert.deepEqual(nextSteps({ kind: 'note', status: 'done' }), []);
});

test('pay after the job: a done task without an invoice can still get one', () => {
  assert.deepEqual(nextSteps({ kind: 'task', status: 'done' }), ['invoice-from-task']);
  assert.deepEqual(nextSteps({ kind: 'task', status: 'done', series_id: 's1' }), ['invoice-from-task']);
});

test('pay before the job: invoice -> Schedule the job -> task with just Job finished (the invoice is a card)', () => {
  assert.deepEqual(nextSteps({ kind: 'invoice', status: 'created' }), ['send-invoice', 'schedule']);
  assert.deepEqual(nextSteps({ kind: 'invoice', status: 'requested' }), ['mark-paid', 'schedule']);
  assert.deepEqual(nextSteps({ kind: 'invoice', status: 'paid' }), ['schedule']);
  assert.deepEqual(nextSteps({ kind: 'task', status: 'created' }, { hasInvoice: true }), ['done']);
  assert.deepEqual(nextSteps({ kind: 'task', status: 'done' }, { hasInvoice: true }), []);
});
