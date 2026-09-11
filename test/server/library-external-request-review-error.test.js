/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiError } from '../../src/server/auth.js';
import { normalizeExternalRequestReviewError } from '../../src/server/library/library-external-request-review-error.js';

test('unexpected review failures preserve the internal cause without disclosing it', () => {
  for (const code of ['23514', '40P01', 'unexpected']) {
    const original = Object.assign(new Error('private SQL constraint, audit payload and path'), { code });
    const result = normalizeExternalRequestReviewError(original);
    assert.equal(result.status, 500);
    assert.equal(result.cause, original);
    assert.doesNotMatch(result.message, /private|constraint|audit|path/);
    assert.match(result.message, /Refresh/);
  }
});

test('review policy failures stay actionable and connection failures remain bounded', () => {
  const policy = createApiError(409, 'external_request_review_conflict', 'This provider album already has a different approval.');
  assert.equal(normalizeExternalRequestReviewError(policy), policy);
  const connection = normalizeExternalRequestReviewError(Object.assign(new Error('private host'), { code: 'ECONNREFUSED' }));
  assert.equal(connection.status, 503);
  assert.doesNotMatch(connection.message, /private host/);
});
