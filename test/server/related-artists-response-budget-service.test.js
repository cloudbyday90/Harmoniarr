/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createRelatedArtistsResponseBudgetService,
  relatedArtistsResponseBudgetDefaults,
} from '../../src/server/metadata/related-artists-response-budget-service.js';

test('related artists response budget owns its timeout and fallback limits', () => {
  const controller = new AbortController();
  let receivedTimeoutMs = null;
  const service = createRelatedArtistsResponseBudgetService({
    createTimeoutSignal: (timeoutMs) => {
      receivedTimeoutMs = timeoutMs;
      return controller.signal;
    },
  });

  const budget = service.createResponseBudget();

  assert.equal(receivedTimeoutMs, relatedArtistsResponseBudgetDefaults.responseBudgetMs);
  assert.equal(budget.signal, controller.signal);
  assert.equal(budget.isExhausted(), false);
  assert.deepEqual(budget.fallbackLimits, {
    maxMusicBrainzFallbackSearchQueries: 1,
    maxRadioCandidatesToRerank: 0,
  });

  controller.abort();
  assert.equal(budget.isExhausted(), true);
});

test('related artists response budget rejects invalid server policy values', () => {
  assert.throws(
    () => createRelatedArtistsResponseBudgetService({ responseBudgetMs: 0 }),
    /responseBudgetMs must be a positive safe integer/,
  );
  assert.throws(
    () => createRelatedArtistsResponseBudgetService({ maxRadioCandidatesToRerank: -1 }),
    /maxRadioCandidatesToRerank must be a non-negative safe integer/,
  );
  assert.throws(
    () => createRelatedArtistsResponseBudgetService({ maxMusicBrainzFallbackSearchQueries: 0 }),
    /maxMusicBrainzFallbackSearchQueries must be a positive safe integer/,
  );
});
