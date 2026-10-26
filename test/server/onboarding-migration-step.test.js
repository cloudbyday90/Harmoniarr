/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOnboardingMigrationStep } from '../../src/server/onboarding-migration-step.js';

test('known migration state reports current or actual pending count without exposing filenames', () => {
  const current = buildOnboardingMigrationStep({ status: 'fulfilled', value: { applied: 115, pending: [] } });
  assert.equal(current.status, 'complete'); assert.equal(current.message, 'Database migrations are current.');
  for (const count of [1, 2]) {
    const pending = buildOnboardingMigrationStep({ status: 'fulfilled', value: { applied: 115 - count, pending: Array(count).fill('private.sql') } });
    assert.equal(pending.status, 'attention'); assert.match(pending.message, new RegExp(`^${count} migration`));
    assert.doesNotMatch(JSON.stringify(pending), /private/u);
  }
});
test('failed and malformed migration observations remain explicitly unavailable without raw failure text', () => {
  const inputs = [undefined, { status: 'rejected', reason: new Error('private SELECT /secret 42P01') }, { status: 'rejected', reason: null },
    ...[null, { applied: null, pending: [] }, { applied: 115, pending: null }].map(value => ({ status: 'fulfilled', value }))];
  for (const input of inputs) {
    const result = buildOnboardingMigrationStep(input);
    assert.equal(result.id, 'database'); assert.equal(result.status, 'unavailable');
    assert.equal(result.message, 'Database migration status is unavailable. Refresh to try again.');
    assert.doesNotMatch(JSON.stringify(result), /private|secret|SELECT|42P01|pending|1 migration/u);
  }
});
