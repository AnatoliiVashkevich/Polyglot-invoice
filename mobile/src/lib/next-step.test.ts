// The decisions table "The job is… / The big button says". Run: cd mobile && npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { nextSteps } from './next-step.ts';

test('the big button for every stage', () => {
  assert.deepEqual(nextSteps({ kind: 'estimate', status: 'created' }), ['send-estimate']);
  assert.deepEqual(nextSteps({ kind: 'estimate', status: 'sent' }), ['schedule', 'make-invoice']);
  assert.deepEqual(nextSteps({ kind: 'task', status: 'created' }), ['job-done']);
  assert.deepEqual(nextSteps({ kind: 'invoice', status: 'created' }), ['send-invoice']);
  assert.deepEqual(nextSteps({ kind: 'invoice', status: 'requested' }), ['mark-paid']);
});

test('finished jobs have no big button', () => {
  assert.deepEqual(nextSteps({ kind: 'invoice', status: 'paid' }), []);
  assert.deepEqual(nextSteps({ kind: 'task', status: 'done' }, true), []);
});

test('a repeating task: big Done, Make invoice smaller; a note: Done', () => {
  assert.deepEqual(nextSteps({ kind: 'task', status: 'created', series_id: 's1' }), ['done', 'invoice-from-task']);
  assert.deepEqual(nextSteps({ kind: 'note', status: 'created' }), ['done']);
  assert.deepEqual(nextSteps({ kind: 'note', status: 'done' }), []);
});

test('a done task can still get its invoice, until one is made', () => {
  assert.deepEqual(nextSteps({ kind: 'task', status: 'done' }), ['invoice-from-task']);
  assert.deepEqual(nextSteps({ kind: 'task', status: 'done', series_id: 's1' }), ['invoice-from-task']);
  assert.deepEqual(nextSteps({ kind: 'task', status: 'done' }, true), []);
});
