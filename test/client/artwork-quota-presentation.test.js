import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatProviderLabel,
  formatQuotaPercentage,
  formatQuotaRemaining,
  formatQuotaUsage,
  resolveQuotaTone,
  buildSparklineData,
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

test('buildSparklineData returns empty array for empty history', () => {
  const result = buildSparklineData([], 100);
  assert.deepEqual(result, []);
});

test('buildSparklineData returns empty array for null history', () => {
  const result = buildSparklineData(null, 100);
  assert.deepEqual(result, []);
});

test('buildSparklineData maps request counts to heights relative to limit', () => {
  const history = [
    { date: '2026-05-14', requestCount: 50 },
    { date: '2026-05-15', requestCount: 100 },
  ];
  const result = buildSparklineData(history, 100);

  assert.equal(result.length, 2);
  assert.equal(result[0].height, 50);
  assert.equal(result[1].height, 100);
  assert.equal(result[0].date, '2026-05-14');
  assert.equal(result[1].date, '2026-05-15');
});

test('buildSparklineData uses limit as max when all counts are below limit', () => {
  const history = [
    { date: '2026-05-14', requestCount: 10 },
    { date: '2026-05-15', requestCount: 20 },
  ];
  const result = buildSparklineData(history, 100);

  assert.equal(result[0].height, 10);
  assert.equal(result[1].height, 20);
});

test('buildSparklineData uses max count as scale when it exceeds limit', () => {
  const history = [
    { date: '2026-05-14', requestCount: 150 },
  ];
  const result = buildSparklineData(history, 100);

  assert.equal(result[0].height, 100);
});

test('buildSparklineData assigns correct tone per bar', () => {
  const history = [
    { date: '2026-05-12', requestCount: 50 },
    { date: '2026-05-13', requestCount: 85 },
    { date: '2026-05-14', requestCount: 100 },
  ];
  const result = buildSparklineData(history, 100);

  assert.equal(result[0].tone, 'success');
  assert.equal(result[1].tone, 'warning');
  assert.equal(result[2].tone, 'danger');
});

test('buildSparklineData ensures minimum height of 1 for non-zero counts', () => {
  const history = [
    { date: '2026-05-14', requestCount: 1 },
  ];
  const result = buildSparklineData(history, 10000);

  assert.ok(result[0].height >= 1);
  assert.equal(result[0].requestCount, 1);
});
