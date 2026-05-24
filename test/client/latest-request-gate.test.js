import assert from 'node:assert/strict';
import test from 'node:test';
import { createLatestRequestGate } from '../../src/client/lib/latest-request-gate.js';

test('begin returns a handle with isCurrent true', () => {
  const gate = createLatestRequestGate();
  const handle = gate.begin();
  assert.equal(handle.isCurrent(), true);
});

test('begin returns a handle with an AbortSignal', () => {
  const gate = createLatestRequestGate();
  const handle = gate.begin();
  assert.ok(handle.signal instanceof AbortSignal);
});

test('second begin makes the first handle no longer current', () => {
  const gate = createLatestRequestGate();
  const first = gate.begin();
  const second = gate.begin();
  assert.equal(first.isCurrent(), false);
  assert.equal(second.isCurrent(), true);
});

test('begin aborts the previous request signal', () => {
  const gate = createLatestRequestGate();
  const first = gate.begin();
  assert.equal(first.signal.aborted, false);
  gate.begin();
  assert.equal(first.signal.aborted, true);
});

test('invalidate makes the current handle no longer current', () => {
  const gate = createLatestRequestGate();
  const handle = gate.begin();
  gate.invalidate();
  assert.equal(handle.isCurrent(), false);
});

test('invalidate aborts the active request signal', () => {
  const gate = createLatestRequestGate();
  const handle = gate.begin();
  assert.equal(handle.signal.aborted, false);
  gate.invalidate();
  assert.equal(handle.signal.aborted, true);
});

test('invalidate without a prior begin does not throw', () => {
  const gate = createLatestRequestGate();
  gate.invalidate();
});

test('multiple begins track the latest correctly', () => {
  const gate = createLatestRequestGate();
  const handles = [gate.begin(), gate.begin(), gate.begin()];
  assert.equal(handles[0].isCurrent(), false);
  assert.equal(handles[1].isCurrent(), false);
  assert.equal(handles[2].isCurrent(), true);
});

test('all previous signals are aborted after multiple begins', () => {
  const gate = createLatestRequestGate();
  const first = gate.begin();
  const second = gate.begin();
  const third = gate.begin();
  assert.equal(first.signal.aborted, true);
  assert.equal(second.signal.aborted, true);
  assert.equal(third.signal.aborted, false);
});

test('invalidate followed by begin returns a new current handle', () => {
  const gate = createLatestRequestGate();
  const first = gate.begin();
  gate.invalidate();
  const second = gate.begin();
  assert.equal(first.isCurrent(), false);
  assert.equal(second.isCurrent(), true);
});
