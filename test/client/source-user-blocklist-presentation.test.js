import assert from 'node:assert/strict';
import test from 'node:test';
import {
  filterBlockedSourceUsers,
  formatBlockedAt,
  formatBlockedByUser,
  formatBlockedUserCountLabel,
  formatBlockReason,
  formatOperatorNotes,
  formatSourceUsername,
} from '../../src/client/lib/source-user-blocklist-presentation.js';

test('formatBlockedUserCountLabel returns "No blocked source users" for 0', () => {
  assert.equal(formatBlockedUserCountLabel(0), 'No blocked source users');
});

test('formatBlockedUserCountLabel returns "No blocked source users" for negative', () => {
  assert.equal(formatBlockedUserCountLabel(-1), 'No blocked source users');
});

test('formatBlockedUserCountLabel returns "No blocked source users" for NaN', () => {
  assert.equal(formatBlockedUserCountLabel(NaN), 'No blocked source users');
});

test('formatBlockedUserCountLabel returns "No blocked source users" for non-finite', () => {
  assert.equal(formatBlockedUserCountLabel(Infinity), 'No blocked source users');
});

test('formatBlockedUserCountLabel returns singular for 1', () => {
  assert.equal(formatBlockedUserCountLabel(1), '1 blocked source user');
});

test('formatBlockedUserCountLabel returns plural for 5', () => {
  assert.equal(formatBlockedUserCountLabel(5), '5 blocked source users');
});

test('formatSourceUsername returns username for valid string', () => {
  assert.equal(formatSourceUsername('Alice'), 'Alice');
});

test('formatSourceUsername returns "Unknown peer" for empty string', () => {
  assert.equal(formatSourceUsername(''), 'Unknown peer');
});

test('formatSourceUsername returns "Unknown peer" for whitespace', () => {
  assert.equal(formatSourceUsername('   '), 'Unknown peer');
});

test('formatSourceUsername returns "Unknown peer" for null', () => {
  assert.equal(formatSourceUsername(null), 'Unknown peer');
});

test('formatSourceUsername returns "Unknown peer" for non-string', () => {
  assert.equal(formatSourceUsername(42), 'Unknown peer');
});

test('formatBlockReason returns reason for valid string', () => {
  assert.equal(formatBlockReason('Spam'), 'Spam');
});

test('formatBlockReason returns "No reason recorded" for empty string', () => {
  assert.equal(formatBlockReason(''), 'No reason recorded');
});

test('formatBlockReason returns "No reason recorded" for null', () => {
  assert.equal(formatBlockReason(null), 'No reason recorded');
});

test('formatBlockReason trims whitespace-only to "No reason recorded"', () => {
  assert.equal(formatBlockReason('  '), 'No reason recorded');
});

test('formatOperatorNotes returns notes for valid string', () => {
  assert.equal(formatOperatorNotes('Watch closely'), 'Watch closely');
});

test('formatOperatorNotes returns em dash for empty string', () => {
  assert.equal(formatOperatorNotes(''), '\u2014');
});

test('formatOperatorNotes returns em dash for null', () => {
  assert.equal(formatOperatorNotes(null), '\u2014');
});

test('formatBlockedByUser returns userId for valid string', () => {
  assert.equal(formatBlockedByUser('user-123'), 'user-123');
});

test('formatBlockedByUser returns "System" for empty string', () => {
  assert.equal(formatBlockedByUser(''), 'System');
});

test('formatBlockedByUser returns "System" for null', () => {
  assert.equal(formatBlockedByUser(null), 'System');
});

test('formatBlockedByUser returns "System" for whitespace', () => {
  assert.equal(formatBlockedByUser('  '), 'System');
});

test('formatBlockedAt returns em dash for null', () => {
  assert.equal(formatBlockedAt(null), '\u2014');
});

test('formatBlockedAt returns em dash for undefined', () => {
  assert.equal(formatBlockedAt(undefined), '\u2014');
});

test('formatBlockedAt returns em dash for empty string', () => {
  assert.equal(formatBlockedAt(''), '\u2014');
});

test('formatBlockedAt delegates to formatOperationTimestamp for valid input', () => {
  const result = formatBlockedAt('2025-06-15T10:30:00Z');
  assert.ok(typeof result === 'string');
  assert.ok(result.length > 0);
  assert.notEqual(result, '\u2014');
});

test('filterBlockedSourceUsers returns empty array for non-array', () => {
  assert.deepEqual(filterBlockedSourceUsers(null, 'test'), []);
});

test('filterBlockedSourceUsers returns empty array for undefined', () => {
  assert.deepEqual(filterBlockedSourceUsers(undefined, ''), []);
});

test('filterBlockedSourceUsers returns all entries when query is empty', () => {
  const entries = [{ username: 'a' }, { username: 'b' }];
  assert.deepEqual(filterBlockedSourceUsers(entries, ''), entries);
});

test('filterBlockedSourceUsers returns all entries when query is null', () => {
  const entries = [{ username: 'a' }];
  assert.deepEqual(filterBlockedSourceUsers(entries, null), entries);
});

test('filterBlockedSourceUsers filters by username', () => {
  const entries = [
    { username: 'alice', blockReason: 'spam' },
    { username: 'bob', blockReason: 'abuse' },
  ];
  const result = filterBlockedSourceUsers(entries, 'alice');
  assert.equal(result.length, 1);
  assert.equal(result[0].username, 'alice');
});

test('filterBlockedSourceUsers filters by blockReason', () => {
  const entries = [
    { username: 'alice', blockReason: 'spam' },
    { username: 'bob', blockReason: 'abuse' },
  ];
  const result = filterBlockedSourceUsers(entries, 'abuse');
  assert.equal(result.length, 1);
  assert.equal(result[0].username, 'bob');
});

test('filterBlockedSourceUsers filters by operatorNotes', () => {
  const entries = [
    { username: 'alice', operatorNotes: 'repeat offender' },
    { username: 'bob', operatorNotes: 'first warning' },
  ];
  const result = filterBlockedSourceUsers(entries, 'repeat');
  assert.equal(result.length, 1);
  assert.equal(result[0].username, 'alice');
});

test('filterBlockedSourceUsers is case-insensitive', () => {
  const entries = [{ username: 'Alice' }];
  const result = filterBlockedSourceUsers(entries, 'alice');
  assert.equal(result.length, 1);
});

test('filterBlockedSourceUsers returns empty when no matches', () => {
  const entries = [{ username: 'alice' }];
  const result = filterBlockedSourceUsers(entries, 'xyz');
  assert.equal(result.length, 0);
});

test('filterBlockedSourceUsers handles entries with null fields', () => {
  const entries = [{ username: 'alice', blockReason: null, operatorNotes: null }];
  const result = filterBlockedSourceUsers(entries, 'alice');
  assert.equal(result.length, 1);
});
