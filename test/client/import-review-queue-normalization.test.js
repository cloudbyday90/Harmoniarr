import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createEmptyQueue,
  defaultImportReviewFilters,
  normalizeCandidatePayload,
  normalizeFilterValue,
  normalizeQueuePayload,
  normalizeReviewPayload,
} from '../../src/client/lib/import-review-queue-normalization.js';

// ---------------------------------------------------------------------------
// defaultImportReviewFilters
// ---------------------------------------------------------------------------

test('defaultImportReviewFilters is frozen', () => {
  assert.ok(Object.isFrozen(defaultImportReviewFilters));
});

test('defaultImportReviewFilters has expected shape', () => {
  assert.equal(defaultImportReviewFilters.status, 'pending');
  assert.equal(defaultImportReviewFilters.limit, 25);
  assert.equal(defaultImportReviewFilters.offset, 0);
  assert.equal(defaultImportReviewFilters.folderPath, '');
  assert.equal(defaultImportReviewFilters.sourceSearchId, '');
  assert.equal(defaultImportReviewFilters.username, '');
});

// ---------------------------------------------------------------------------
// createEmptyQueue
// ---------------------------------------------------------------------------

test('createEmptyQueue returns an object with an empty candidates array', () => {
  const queue = createEmptyQueue();
  assert.ok(Array.isArray(queue.candidates));
  assert.equal(queue.candidates.length, 0);
});

test('createEmptyQueue returns pagination with zero total', () => {
  const queue = createEmptyQueue();
  assert.equal(queue.pagination.total, 0);
});

test('createEmptyQueue returns pagination limit matching defaultImportReviewFilters', () => {
  const queue = createEmptyQueue();
  assert.equal(queue.pagination.limit, defaultImportReviewFilters.limit);
});

test('createEmptyQueue returns pagination offset matching defaultImportReviewFilters', () => {
  const queue = createEmptyQueue();
  assert.equal(queue.pagination.offset, defaultImportReviewFilters.offset);
});

test('createEmptyQueue returns filters with null values', () => {
  const queue = createEmptyQueue();
  assert.equal(queue.filters.folderPath, null);
  assert.equal(queue.filters.sourceSearchId, null);
  assert.equal(queue.filters.status, null);
  assert.equal(queue.filters.username, null);
});

test('createEmptyQueue returns a new object on each call', () => {
  const a = createEmptyQueue();
  const b = createEmptyQueue();
  assert.notEqual(a, b);
  assert.notEqual(a.candidates, b.candidates);
});

// ---------------------------------------------------------------------------
// normalizeFilterValue
// ---------------------------------------------------------------------------

test('normalizeFilterValue returns the string unchanged when no surrounding whitespace', () => {
  assert.equal(normalizeFilterValue('pending'), 'pending');
});

test('normalizeFilterValue trims leading whitespace', () => {
  assert.equal(normalizeFilterValue('  pending'), 'pending');
});

test('normalizeFilterValue trims trailing whitespace', () => {
  assert.equal(normalizeFilterValue('pending  '), 'pending');
});

test('normalizeFilterValue trims both sides', () => {
  assert.equal(normalizeFilterValue('  pending  '), 'pending');
});

test('normalizeFilterValue returns empty string for empty string', () => {
  assert.equal(normalizeFilterValue(''), '');
});

test('normalizeFilterValue returns empty string for whitespace-only string', () => {
  assert.equal(normalizeFilterValue('   '), '');
});

test('normalizeFilterValue returns empty string for null', () => {
  assert.equal(normalizeFilterValue(null), '');
});

test('normalizeFilterValue returns empty string for undefined', () => {
  assert.equal(normalizeFilterValue(undefined), '');
});

test('normalizeFilterValue returns empty string for a number', () => {
  assert.equal(normalizeFilterValue(42), '');
});

test('normalizeFilterValue returns empty string for a boolean', () => {
  assert.equal(normalizeFilterValue(true), '');
});

test('normalizeFilterValue returns empty string for an object', () => {
  assert.equal(normalizeFilterValue({}), '');
});

// ---------------------------------------------------------------------------
// normalizeQueuePayload
// ---------------------------------------------------------------------------

test('normalizeQueuePayload extracts importCandidates from wrapped payload', () => {
  const candidates = [{ id: 'c1' }];
  const result = normalizeQueuePayload({ importCandidates: candidates });
  assert.equal(result, candidates);
});

test('normalizeQueuePayload returns payload directly when not wrapped', () => {
  const payload = { candidates: [], pagination: { total: 0, limit: 25, offset: 0 } };
  assert.equal(normalizeQueuePayload(payload), payload);
});

test('normalizeQueuePayload returns empty queue for null', () => {
  const result = normalizeQueuePayload(null);
  assert.ok(Array.isArray(result.candidates));
  assert.equal(result.candidates.length, 0);
});

test('normalizeQueuePayload returns empty queue for undefined', () => {
  const result = normalizeQueuePayload(undefined);
  assert.ok(Array.isArray(result.candidates));
  assert.equal(result.candidates.length, 0);
});

test('normalizeQueuePayload prefers importCandidates over the root payload', () => {
  const wrapped = { importCandidates: [{ id: 'a' }], candidates: [{ id: 'b' }] };
  const result = normalizeQueuePayload(wrapped);
  assert.deepEqual(result, [{ id: 'a' }]);
});

// ---------------------------------------------------------------------------
// normalizeCandidatePayload
// ---------------------------------------------------------------------------

test('normalizeCandidatePayload extracts importCandidate from wrapped payload', () => {
  const candidate = { id: 'cand-1', status: 'pending' };
  const result = normalizeCandidatePayload({ importCandidate: candidate });
  assert.equal(result, candidate);
});

test('normalizeCandidatePayload returns payload directly when not wrapped', () => {
  const candidate = { id: 'cand-1', status: 'pending' };
  assert.equal(normalizeCandidatePayload(candidate), candidate);
});

test('normalizeCandidatePayload returns null for null', () => {
  assert.equal(normalizeCandidatePayload(null), null);
});

test('normalizeCandidatePayload returns null for undefined', () => {
  assert.equal(normalizeCandidatePayload(undefined), null);
});

test('normalizeCandidatePayload prefers importCandidate over root when both present', () => {
  const inner = { id: 'inner' };
  const outer = { importCandidate: inner, id: 'outer' };
  assert.equal(normalizeCandidatePayload(outer), inner);
});

// ---------------------------------------------------------------------------
// normalizeReviewPayload
// ---------------------------------------------------------------------------

test('normalizeReviewPayload extracts review from wrapped payload', () => {
  const review = { id: 'rev-1', status: 'selected' };
  const result = normalizeReviewPayload({ review });
  assert.equal(result, review);
});

test('normalizeReviewPayload returns payload directly when not wrapped', () => {
  const review = { id: 'rev-1', status: 'selected' };
  assert.equal(normalizeReviewPayload(review), review);
});

test('normalizeReviewPayload returns null for null', () => {
  assert.equal(normalizeReviewPayload(null), null);
});

test('normalizeReviewPayload returns null for undefined', () => {
  assert.equal(normalizeReviewPayload(undefined), null);
});

test('normalizeReviewPayload prefers review over root when both present', () => {
  const inner = { id: 'inner-rev' };
  const outer = { review: inner, id: 'outer' };
  assert.equal(normalizeReviewPayload(outer), inner);
});
