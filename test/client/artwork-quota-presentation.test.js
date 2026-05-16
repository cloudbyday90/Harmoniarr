import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatProviderLabel,
  formatQuotaPercentage,
  formatQuotaRemaining,
  formatQuotaUsage,
  resolveQuotaTone,
} from '../../src/client/lib/artwork-quota-presentation.js';

test('formatProviderLabel returns human-readable names', () => {
  assert.equal(formatProviderLabel('coverArtArchive'), 'Cover Art Archive');
  assert.equal(formatProviderLabel('fanartTv'), 'Fanart.tv');
  assert.equal(formatProviderLabel('unknown'), 'unknown');
});

test('formatQuotaUsage formats used and limit', () => {
  assert.equal(formatQuotaUsage(50, 1000), '50 / 1000');
  assert.equal(formatQuotaUsage(0, 0), '0');
});

test('formatQuotaPercentage calculates correct percentage', () => {
  assert.equal(formatQuotaPercentage(50, 1000), 5);
  assert.equal(formatQuotaPercentage(800, 1000), 80);
  assert.equal(formatQuotaPercentage(1000, 1000), 100);
  assert.equal(formatQuotaPercentage(2000, 1000), 100);
  assert.equal(formatQuotaPercentage(5, 0), 0);
});

test('formatQuotaRemaining shows remaining count or limit reached', () => {
  assert.equal(formatQuotaRemaining(50), '50 remaining');
  assert.equal(formatQuotaRemaining(0), 'Limit reached');
});

test('resolveQuotaTone returns danger when exceeded', () => {
  assert.equal(resolveQuotaTone(true, 100, 100), 'danger');
});

test('resolveQuotaTone returns warning at 80% usage', () => {
  assert.equal(resolveQuotaTone(false, 800, 1000), 'warning');
});

test('resolveQuotaTone returns success under 80%', () => {
  assert.equal(resolveQuotaTone(false, 50, 1000), 'success');
});
