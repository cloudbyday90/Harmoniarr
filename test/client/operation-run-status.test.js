import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getOperationRunStatusClass,
  getOperationRunStatusLabel,
} from '../../src/client/lib/operation-run-status.js';

test('getOperationRunStatusLabel returns shared operation labels', () => {
  assert.equal(getOperationRunStatusLabel('completed'), 'Completed');
  assert.equal(getOperationRunStatusLabel('running'), 'Running');
  assert.equal(getOperationRunStatusLabel('pending'), 'Queued');
  assert.equal(getOperationRunStatusLabel('cancelled'), 'Cancelled');
  assert.equal(getOperationRunStatusLabel('failed'), 'Failed');
  assert.equal(getOperationRunStatusLabel('unknown'), 'Not started');
  assert.equal(getOperationRunStatusLabel('unknown', { defaultLabel: 'Unknown' }), 'Unknown');
});

test('getOperationRunStatusClass returns shared operation pill classes', () => {
  assert.equal(getOperationRunStatusClass('completed'), 'review-status-selected');
  assert.equal(getOperationRunStatusClass('running'), 'review-status-pending');
  assert.equal(getOperationRunStatusClass('pending'), 'review-status-pending');
  assert.equal(getOperationRunStatusClass('cancelled'), 'review-status-failed');
  assert.equal(getOperationRunStatusClass('failed'), 'review-status-failed');
  assert.equal(getOperationRunStatusClass('unknown'), 'review-status-held');
});