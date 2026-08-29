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
  buildArtistDetailCacheBrowserEvidence,
  buildArtistDetailRequestTimingEvidence,
} from '../../testing/browser/artist-detail-cache-browser-evidence.js';

function createResourceTiming({
  description = 'cold/foreground/fresh',
  durationMs = 19.8,
  serverDurationMs = 7,
} = {}) {
  return {
    durationMs,
    responseEndMs: 31.5,
    serverTiming: [{
      description,
      durationMs: serverDurationMs,
      name: 'harmoniarr-cache',
    }],
    startTimeMs: 11.7,
  };
}

test('buildArtistDetailCacheBrowserEvidence retains only the fixed phase, cache state, and timing fields', () => {
  const evidence = buildArtistDetailCacheBrowserEvidence({
    endpoint: 'discography',
    phase: 'cold',
    resourceTiming: createResourceTiming(),
    serverTiming: 'harmoniarr-cache;desc="cold/foreground/fresh";dur=7',
  });

  assert.deepEqual(evidence, {
    cache: {
      lookup: 'cold',
      refresh: 'foreground',
      state: 'fresh',
    },
    endpoint: 'discography',
    phase: 'cold',
    timing: {
      clientRequestDurationMs: 20,
      serverRefreshDurationMs: 7,
    },
  });
  assert.equal(JSON.stringify(evidence).includes('http'), false);
});

test('buildArtistDetailCacheBrowserEvidence accepts a stale response whose background refresh has no duration', () => {
  const evidence = buildArtistDetailCacheBrowserEvidence({
    endpoint: 'related_artists',
    phase: 'stale',
    resourceTiming: createResourceTiming({
      description: 'stale/background/stale',
      durationMs: 4.2,
      serverDurationMs: 0,
    }),
    serverTiming: 'harmoniarr-cache;desc="stale/background/stale"',
  });

  assert.deepEqual(evidence, {
    cache: {
      lookup: 'stale',
      refresh: 'background',
      state: 'stale',
    },
    endpoint: 'related_artists',
    phase: 'stale',
    timing: {
      clientRequestDurationMs: 4,
      serverRefreshDurationMs: null,
    },
  });
});

test('buildArtistDetailCacheBrowserEvidence rejects malformed or mismatched timing without echoing it', () => {
  assert.throws(() => {
    buildArtistDetailCacheBrowserEvidence({
      endpoint: 'discography',
      phase: 'cold',
      resourceTiming: createResourceTiming(),
      serverTiming: 'harmoniarr-cache;desc="cold/foreground/fresh";dur=private-value',
    });
  }, /Server-Timing is invalid/u);

  assert.throws(() => {
    buildArtistDetailCacheBrowserEvidence({
      endpoint: 'discography',
      phase: 'fresh',
      resourceTiming: createResourceTiming({ description: 'cold/foreground/fresh' }),
      serverTiming: 'harmoniarr-cache;desc="fresh/none/fresh"',
    });
  }, /metric description does not match/u);
});

test('buildArtistDetailRequestTimingEvidence retains only allowlisted local request timing', () => {
  const evidence = buildArtistDetailRequestTimingEvidence({
    endpoint: 'operator_projection',
    resourceTiming: createResourceTiming({ durationMs: 19.8 }),
  });

  assert.deepEqual(evidence, {
    endpoint: 'operator_projection',
    timing: {
      clientRequestDurationMs: 20,
      responseEndMs: 32,
      startTimeMs: 12,
    },
  });
  assert.equal(JSON.stringify(evidence).includes('http'), false);
});

test('buildArtistDetailRequestTimingEvidence rejects unknown endpoints and inverted timings', () => {
  assert.throws(() => {
    buildArtistDetailRequestTimingEvidence({
      endpoint: 'discography',
      resourceTiming: createResourceTiming(),
    });
  }, /request timing endpoint is invalid/u);

  assert.throws(() => {
    buildArtistDetailRequestTimingEvidence({
      endpoint: 'local_metadata',
      resourceTiming: {
        ...createResourceTiming(),
        responseEndMs: 11,
        startTimeMs: 12,
      },
    });
  }, /timing order is invalid/u);
});
