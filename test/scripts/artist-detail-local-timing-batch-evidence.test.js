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
  assertArtistDetailLocalTimingArtifactContract,
  assertArtistDetailLocalTimingBatchEvidenceContract,
  createArtistDetailLocalTimingBatchEvidence,
} from '../../scripts/artist-detail-local-timing-batch-evidence.js';
import { createArtistDetailLocalTimingEvidence } from '../../scripts/artist-detail-local-timing-evidence.js';

function createSample({
  duration,
  outcome = 'local_projection',
  presentationObservedAtMs = duration + 100,
  presentationState = 'ready',
  projectionDuration = duration + 10,
}) {
  return createArtistDetailLocalTimingEvidence({
    capturedAt: '2026-08-29T12:00:00.000Z',
    outcome,
    presentation: {
      observedAtMs: presentationObservedAtMs,
      state: presentationState,
    },
    requests: outcome === 'provider_fallback_after_local_lookup'
      ? [
        {
          endpoint: 'local_metadata',
          statusFamily: '2xx',
          timing: { clientRequestDurationMs: duration, responseEndMs: duration, startTimeMs: 0 },
        },
        {
          endpoint: 'discography',
          statusFamily: '2xx',
          timing: { clientRequestDurationMs: projectionDuration, responseEndMs: duration + projectionDuration, startTimeMs: duration },
        },
      ]
      : [
        {
          endpoint: 'local_metadata',
          statusFamily: '2xx',
          timing: { clientRequestDurationMs: duration, responseEndMs: duration, startTimeMs: 0 },
        },
        {
          endpoint: 'operator_projection',
          statusFamily: '2xx',
          timing: { clientRequestDurationMs: projectionDuration, responseEndMs: duration + projectionDuration, startTimeMs: duration },
        },
      ],
  });
}

test('Artist Detail timing batch evidence aggregates only bounded sample data', () => {
  const evidence = createArtistDetailLocalTimingBatchEvidence({
    capturedAt: '2026-08-29T13:00:00.000Z',
    samples: [
      createSample({ duration: 10 }),
      createSample({ duration: 20 }),
      createSample({ duration: 30 }),
    ],
  });

  assert.deepEqual(evidence.outcomeCounts, {
    local_projection: 3,
    provider_fallback_after_local_lookup: 0,
    provider_fallback_after_operator_projection: 0,
  });
  assert.equal(evidence.outcomeIsConsistent, true);
  assert.deepEqual(evidence.presentation, {
    observedAtMs: { maximumMs: 130, minimumMs: 110, p50Ms: 120, p95Ms: 129 },
    stateCounts: { ready: 3, still_loading: 0, unavailable: 0 },
    stateIsConsistent: true,
  });
  assert.deepEqual(evidence.endpointTimings[0], {
    clientRequestDurationMs: { maximumMs: 30, minimumMs: 10, p50Ms: 20, p95Ms: 29 },
    endpoint: 'local_metadata',
    responseEndMs: { maximumMs: 30, minimumMs: 10, p50Ms: 20, p95Ms: 29 },
    sampleCount: 3,
    startTimeMs: { maximumMs: 0, minimumMs: 0, p50Ms: 0, p95Ms: 0 },
  });
  assert.equal(JSON.stringify(evidence).includes('http'), false);
  assert.equal(JSON.stringify(evidence).includes('username'), false);
  assert.deepEqual(assertArtistDetailLocalTimingBatchEvidenceContract(evidence), evidence);
  assert.deepEqual(assertArtistDetailLocalTimingArtifactContract(evidence), evidence);
});

test('Artist Detail timing batch evidence detects a varied cache outcome and rejects altered summaries', () => {
  const evidence = createArtistDetailLocalTimingBatchEvidence({
    capturedAt: '2026-08-29T13:00:00.000Z',
    samples: [
      createSample({ duration: 10 }),
      createSample({
        duration: 20,
        outcome: 'provider_fallback_after_local_lookup',
        presentationState: 'still_loading',
      }),
    ],
  });

  assert.equal(evidence.outcomeIsConsistent, false);
  assert.equal(evidence.presentation.stateIsConsistent, false);
  assert.equal(evidence.endpointTimings.some(({ endpoint }) => endpoint === 'discography'), true);
  assert.throws(
    () => assertArtistDetailLocalTimingBatchEvidenceContract({
      ...evidence,
      endpointTimings: evidence.endpointTimings.map((entry) => entry.endpoint === 'local_metadata'
        ? { ...entry, clientRequestDurationMs: { ...entry.clientRequestDurationMs, p95Ms: 18 } }
        : entry),
    }),
    /summary does not match samples/u,
  );
  assert.throws(
    () => assertArtistDetailLocalTimingBatchEvidenceContract({
      ...evidence,
      presentation: {
        ...evidence.presentation,
        stateCounts: { ...evidence.presentation.stateCounts, ready: 2, still_loading: 0 },
      },
    }),
    /summary does not match samples/u,
  );
  assert.throws(
    () => createArtistDetailLocalTimingBatchEvidence({ samples: [createSample({ duration: 10 })] }),
    /between 2 and 5/u,
  );
});
