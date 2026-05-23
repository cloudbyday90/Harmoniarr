import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildRequestListRouteQuery,
  getRequestListRouteStateKey,
  normalizeRequestListRouteState,
} from '../../src/client/lib/request-list-route-state.js';

test('normalizeRequestListRouteState returns empty for empty query', () => {
  const state = normalizeRequestListRouteState({});
  assert.equal(state.requestState, '');
  assert.equal(state.requestKind, '');
  assert.equal(state.search, '');
  assert.equal(state.sortBy, '');
});

test('normalizeRequestListRouteState returns empty for unknown values', () => {
  const state = normalizeRequestListRouteState({
    requestKind: 'unknown',
    requestState: 'bogus',
    search: '  ',
    sortBy: 'reverse',
  });
  assert.equal(state.requestKind, '');
  assert.equal(state.requestState, '');
  assert.equal(state.search, '');
  assert.equal(state.sortBy, '');
});

test('normalizeRequestListRouteState preserves valid values', () => {
  const state = normalizeRequestListRouteState({
    requestKind: 'track',
    requestState: 'needs_fetch',
    search: 'daft punk',
    sortBy: 'oldest',
  });
  assert.equal(state.requestKind, 'track');
  assert.equal(state.requestState, 'needs_fetch');
  assert.equal(state.search, 'daft punk');
  assert.equal(state.sortBy, 'oldest');
});

test('normalizeRequestListRouteState trims search', () => {
  const state = normalizeRequestListRouteState({ search: '  daft  ' });
  assert.equal(state.search, 'daft');
});

test('normalizeRequestListRouteState handles non-string values', () => {
  const state = normalizeRequestListRouteState({ requestState: undefined, search: null });
  assert.equal(state.requestState, '');
  assert.equal(state.search, '');
});

test('buildRequestListRouteQuery omits empty fields', () => {
  assert.deepEqual(buildRequestListRouteQuery({}), {});
});

test('buildRequestListRouteQuery includes only non-empty fields', () => {
  const query = buildRequestListRouteQuery({
    requestState: 'needs_review',
    sortBy: 'state',
  });
  assert.equal(query.requestState, 'needs_review');
  assert.equal(query.sortBy, 'state');
  assert.equal(Object.prototype.hasOwnProperty.call(query, 'requestKind'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(query, 'search'), false);
});

test('buildRequestListRouteQuery strips unknown values', () => {
  const query = buildRequestListRouteQuery({ requestKind: 'bogus' });
  assert.equal(Object.prototype.hasOwnProperty.call(query, 'requestKind'), false);
});

test('getRequestListRouteStateKey returns same key for same state', () => {
  const a = getRequestListRouteStateKey({ requestState: 'needs_fetch', sortBy: 'oldest' });
  const b = getRequestListRouteStateKey({ requestState: 'needs_fetch', sortBy: 'oldest' });
  assert.equal(a, b);
});

test('getRequestListRouteStateKey returns different key for different state', () => {
  const a = getRequestListRouteStateKey({ requestState: 'needs_fetch' });
  const b = getRequestListRouteStateKey({ requestState: 'needs_review' });
  assert.notEqual(a, b);
});
