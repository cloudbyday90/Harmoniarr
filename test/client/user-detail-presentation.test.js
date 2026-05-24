import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatAuditEventType,
  formatAuditEventTypeTone,
  formatRelativeTime,
  formatSessionStatus,
  summarizeRequestCounts,
} from '../../src/client/lib/user-detail-presentation.js';

test('formatSessionStatus returns Active for non-expired non-revoked session', () => {
  const future = new Date(Date.now() + 86400000).toISOString();
  const result = formatSessionStatus({ isRevoked: false, expiresAt: future });
  assert.deepEqual(result, { label: 'Active', tone: 'success' });
});

test('formatSessionStatus returns Revoked for revoked session', () => {
  const future = new Date(Date.now() + 86400000).toISOString();
  const result = formatSessionStatus({ isRevoked: true, expiresAt: future });
  assert.deepEqual(result, { label: 'Revoked', tone: 'danger' });
});

test('formatSessionStatus returns Expired for past expiry', () => {
  const past = new Date(Date.now() - 86400000).toISOString();
  const result = formatSessionStatus({ isRevoked: false, expiresAt: past });
  assert.deepEqual(result, { label: 'Expired', tone: 'warning' });
});

test('formatSessionStatus prefers Revoked over Expired', () => {
  const past = new Date(Date.now() - 86400000).toISOString();
  const result = formatSessionStatus({ isRevoked: true, expiresAt: past });
  assert.deepEqual(result, { label: 'Revoked', tone: 'danger' });
});

test('formatAuditEventType replaces underscores and title-cases', () => {
  assert.equal(formatAuditEventType('password_change'), 'Password Change');
});

test('formatAuditEventType handles single word', () => {
  assert.equal(formatAuditEventType('login'), 'Login');
});

test('formatAuditEventType returns "Unknown" for null', () => {
  assert.equal(formatAuditEventType(null), 'Unknown');
});

test('formatAuditEventType returns "Unknown" for undefined', () => {
  assert.equal(formatAuditEventType(undefined), 'Unknown');
});

test('formatAuditEventType returns non-string input as-is', () => {
  assert.equal(formatAuditEventType(42), 42);
});

test('formatAuditEventType handles multiple underscores', () => {
  assert.equal(formatAuditEventType('user_session_revoke'), 'User Session Revoke');
});

test('formatAuditEventTypeTone returns danger for delete', () => {
  assert.equal(formatAuditEventTypeTone('user_delete'), 'danger');
});

test('formatAuditEventTypeTone returns danger for remove', () => {
  assert.equal(formatAuditEventTypeTone('remove_link'), 'danger');
});

test('formatAuditEventTypeTone returns danger for revoke', () => {
  assert.equal(formatAuditEventTypeTone('session_revoke'), 'danger');
});

test('formatAuditEventTypeTone returns danger for disable', () => {
  assert.equal(formatAuditEventTypeTone('disable_account'), 'danger');
});

test('formatAuditEventTypeTone returns success for create', () => {
  assert.equal(formatAuditEventTypeTone('create_user'), 'success');
});

test('formatAuditEventTypeTone returns success for link', () => {
  assert.equal(formatAuditEventTypeTone('link_plex'), 'success');
});

test('formatAuditEventTypeTone returns success for enable', () => {
  assert.equal(formatAuditEventTypeTone('enable_mfa'), 'success');
});

test('formatAuditEventTypeTone returns warning for update', () => {
  assert.equal(formatAuditEventTypeTone('update_settings'), 'warning');
});

test('formatAuditEventTypeTone returns warning for change', () => {
  assert.equal(formatAuditEventTypeTone('password_change'), 'warning');
});

test('formatAuditEventTypeTone returns warning for reassign', () => {
  assert.equal(formatAuditEventTypeTone('reassign_request'), 'warning');
});

test('formatAuditEventTypeTone returns info for login', () => {
  assert.equal(formatAuditEventTypeTone('user_login'), 'info');
});

test('formatAuditEventTypeTone returns info for auth', () => {
  assert.equal(formatAuditEventTypeTone('auth_refresh'), 'info');
});

test('formatAuditEventTypeTone returns undefined for unmatched', () => {
  assert.equal(formatAuditEventTypeTone('unknown_event'), undefined);
});

test('formatAuditEventTypeTone returns undefined for null', () => {
  assert.equal(formatAuditEventTypeTone(null), undefined);
});

test('formatAuditEventTypeTone returns undefined for empty string', () => {
  assert.equal(formatAuditEventTypeTone(''), undefined);
});

test('formatRelativeTime returns empty string for null', () => {
  assert.equal(formatRelativeTime(null), '');
});

test('formatRelativeTime returns empty string for undefined', () => {
  assert.equal(formatRelativeTime(undefined), '');
});

test('formatRelativeTime returns empty string for empty string', () => {
  assert.equal(formatRelativeTime(''), '');
});

test('formatRelativeTime returns "just now" for very recent', () => {
  const now = new Date().toISOString();
  assert.equal(formatRelativeTime(now), 'just now');
});

test('formatRelativeTime returns minutes ago', () => {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  assert.equal(formatRelativeTime(fiveMinAgo), '5m ago');
});

test('formatRelativeTime returns hours ago', () => {
  const threeHrAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  assert.equal(formatRelativeTime(threeHrAgo), '3h ago');
});

test('formatRelativeTime returns days ago', () => {
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
  assert.equal(formatRelativeTime(fiveDaysAgo), '5d ago');
});

test('formatRelativeTime returns date string for older than 30 days', () => {
  const oldDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const result = formatRelativeTime(oldDate);
  assert.ok(typeof result === 'string');
  assert.ok(!result.includes('ago'));
  assert.ok(!result.includes('just now'));
});

test('summarizeRequestCounts returns empty array for null', () => {
  assert.deepEqual(summarizeRequestCounts(null), []);
});

test('summarizeRequestCounts returns empty array for undefined', () => {
  assert.deepEqual(summarizeRequestCounts(undefined), []);
});

test('summarizeRequestCounts returns 4 stat cards', () => {
  const result = summarizeRequestCounts({ total: 10 });
  assert.equal(result.length, 4);
});

test('summarizeRequestCounts maps total from summary', () => {
  const result = summarizeRequestCounts({ total: 42 });
  assert.equal(result[0].label, 'Total');
  assert.equal(result[0].value, 42);
});

test('summarizeRequestCounts sums needsFetch from asTarget and asRequester', () => {
  const result = summarizeRequestCounts({
    total: 10,
    asTarget: { needsFetch: 3 },
    asRequester: { needsFetch: 2 },
  });
  assert.equal(result[1].label, 'Needs fetch');
  assert.equal(result[1].value, 5);
  assert.equal(result[1].tone, 'info');
});

test('summarizeRequestCounts sums needsReview from asTarget and asRequester', () => {
  const result = summarizeRequestCounts({
    total: 10,
    asTarget: { needsReview: 4 },
    asRequester: { needsReview: 1 },
  });
  assert.equal(result[2].label, 'Needs review');
  assert.equal(result[2].value, 5);
  assert.equal(result[2].tone, 'warning');
});

test('summarizeRequestCounts sums cancelled from both roles', () => {
  const result = summarizeRequestCounts({
    total: 10,
    asTarget: { cancelled: 2 },
    asRequester: { cancelled: 3 },
  });
  assert.equal(result[3].label, 'Cancelled');
  assert.equal(result[3].value, 5);
  assert.equal(result[3].tone, 'danger');
});

test('summarizeRequestCounts defaults total to 0 when absent', () => {
  const result = summarizeRequestCounts({});
  assert.equal(result[0].value, 0);
});

test('summarizeRequestCounts defaults counts to 0 for missing nested objects', () => {
  const result = summarizeRequestCounts({ total: 0 });
  assert.equal(result[1].value, 0);
  assert.equal(result[2].value, 0);
  assert.equal(result[3].value, 0);
});
