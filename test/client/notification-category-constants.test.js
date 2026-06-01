import assert from 'node:assert/strict';
import test from 'node:test';
import { NOTIFICATION_CATEGORIES } from '../../src/client/lib/notification-category-constants.js';

test('NOTIFICATION_CATEGORIES is an array', () => {
  assert.ok(Array.isArray(NOTIFICATION_CATEGORIES));
});

test('NOTIFICATION_CATEGORIES has at least 5 categories', () => {
  assert.ok(NOTIFICATION_CATEGORIES.length >= 5);
});

test('every category has a non-empty string key', () => {
  for (const cat of NOTIFICATION_CATEGORIES) {
    assert.equal(typeof cat.key, 'string', `key must be string: ${cat.key}`);
    assert.ok(cat.key.length > 0, `key must not be empty: ${JSON.stringify(cat)}`);
  }
});

test('every category has a non-empty string label', () => {
  for (const cat of NOTIFICATION_CATEGORIES) {
    assert.equal(typeof cat.label, 'string', `label must be string for ${cat.key}`);
    assert.ok(cat.label.length > 0, `label must not be empty for ${cat.key}`);
  }
});

test('every category has a non-empty string description', () => {
  for (const cat of NOTIFICATION_CATEGORIES) {
    assert.equal(typeof cat.description, 'string', `description must be string for ${cat.key}`);
    assert.ok(cat.description.length > 0, `description must not be empty for ${cat.key}`);
  }
});

test('every category has a boolean adminOnly field', () => {
  for (const cat of NOTIFICATION_CATEGORIES) {
    assert.equal(typeof cat.adminOnly, 'boolean', `adminOnly must be boolean for ${cat.key}`);
  }
});

test('all keys are unique', () => {
  const keys = NOTIFICATION_CATEGORIES.map((c) => c.key);
  assert.equal(new Set(keys).size, keys.length);
});

test('includes requestFulfilled category', () => {
  assert.ok(NOTIFICATION_CATEGORIES.some((c) => c.key === 'requestFulfilled'));
});

test('includes admin-only categories', () => {
  const adminOnly = NOTIFICATION_CATEGORIES.filter((c) => c.adminOnly);
  assert.ok(adminOnly.length > 0, 'must have at least one admin-only category');
  assert.ok(adminOnly.some((c) => c.key === 'discoveryRequestExhausted'));
  assert.ok(adminOnly.some((c) => c.key === 'downloadRecoveryExhausted'));
});

test('includes non-admin categories', () => {
  const nonAdmin = NOTIFICATION_CATEGORIES.filter((c) => !c.adminOnly);
  assert.ok(nonAdmin.length > 0, 'must have at least one non-admin category');
});
