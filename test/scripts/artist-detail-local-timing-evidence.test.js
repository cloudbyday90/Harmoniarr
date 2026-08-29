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
  assertArtistDetailLocalTimingEvidenceContract,
  createArtistDetailLocalTimingEvidence,
  createArtistDetailTimingRequest,
  getArtistDetailTimingStatusFamily,
} from '../../scripts/artist-detail-local-timing-evidence.js';

function createRequest(endpoint, status = 200) {
  return createArtistDetailTimingRequest({
    endpoint,
    status,
    timing: {
      duration: 14.9,
      responseEnd: 31.1,
      startTime: 16.2,
    },
  });
}

test('Artist Detail local timing evidence keeps only request categories, status families, and rounded timing', () => {
  const evidence = createArtistDetailLocalTimingEvidence({
    capturedAt: '2026-08-29T12:00:00.000Z',
    outcome: 'local_projection',
    requests: [
      createRequest('local_metadata'),
      createRequest('operator_projection'),
    ],
  });

  assert.deepEqual(evidence, {
    capturedAt: '2026-08-29T12:00:00.000Z',
    outcome: 'local_projection',
    requests: [
      {
        endpoint: 'local_metadata',
        statusFamily: '2xx',
        timing: {
          clientRequestDurationMs: 15,
          responseEndMs: 31,
          startTimeMs: 16,
        },
      },
      {
        endpoint: 'operator_projection',
        statusFamily: '2xx',
        timing: {
          clientRequestDurationMs: 15,
          responseEndMs: 31,
          startTimeMs: 16,
        },
      },
    ],
    schemaVersion: 1,
  });
  assert.equal(JSON.stringify(evidence).includes('artist-id'), false);
  assert.equal(JSON.stringify(evidence).includes('http'), false);
});

test('Artist Detail local timing evidence requires the request sequence implied by the observed outcome', () => {
  assert.throws(() => createArtistDetailLocalTimingEvidence({
    capturedAt: '2026-08-29T12:00:00.000Z',
    outcome: 'provider_fallback_after_operator_projection',
    requests: [
      createRequest('local_metadata'),
      createRequest('discography'),
    ],
  }), /requests do not match the outcome/u);

  assert.throws(() => createArtistDetailLocalTimingEvidence({
    capturedAt: '2026-08-29T12:00:00.000Z',
    outcome: 'local_projection',
    requests: [{
      ...createRequest('local_metadata'),
      url: 'http://127.0.0.1/private-artist',
    }, createRequest('operator_projection')],
  }), /url is not allowed/u);

  assert.throws(() => assertArtistDetailLocalTimingEvidenceContract({
    capturedAt: '2026-08-29T12:00:00.000Z',
    outcome: 'local_projection',
    requests: [createRequest('local_metadata'), createRequest('operator_projection')],
    schemaVersion: 1,
    username: 'local-admin',
  }), /username is not allowed/u);
});

test('Artist Detail local timing evidence bounds status and resource timing inputs', () => {
  assert.equal(getArtistDetailTimingStatusFamily(404), '4xx');
  assert.throws(() => getArtistDetailTimingStatusFamily(199), /response status is invalid/u);
  assert.throws(() => createArtistDetailTimingRequest({
    endpoint: 'local_metadata',
    status: 200,
    timing: {
      duration: 2,
      responseEnd: 1,
      startTime: 3,
    },
  }), /response end precedes start time/u);
});
