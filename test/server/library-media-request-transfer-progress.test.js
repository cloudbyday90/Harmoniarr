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
import { buildMediaRequestTransferProgress } from '../../src/server/library/library-media-request-transfer-progress.js';

test('buildMediaRequestTransferProgress projects the persisted summary', () => {
  assert.deepEqual(buildMediaRequestTransferProgress({
    execution: {
      latestTransferSnapshot: {
        lastReconciledAt: '2026-05-31T12:01:02Z',
        summary: {
          percentComplete: 42,
          status: 'active',
        },
      },
    },
  }), {
    observedAt: '2026-05-31T12:01:02.000Z',
    percentComplete: 42,
    status: 'active',
  });
});

test('buildMediaRequestTransferProgress clamps numeric progress and rejects internal statuses', () => {
  assert.deepEqual(buildMediaRequestTransferProgress({
    execution: {
      latestTransferSnapshot: {
        lastReconciledAt: 'not-a-date',
        summary: {
          percentComplete: 140.4,
          status: 'not_found',
        },
      },
    },
  }), {
    observedAt: null,
    percentComplete: 100,
    status: null,
  });
});

test('buildMediaRequestTransferProgress preserves indeterminate progress', () => {
  assert.deepEqual(buildMediaRequestTransferProgress({
    execution: {
      latestTransferSnapshot: {
        lastReconciledAt: '2026-05-31T12:01:02Z',
        summary: {
          percentComplete: null,
          status: 'queued',
        },
      },
    },
  }), {
    observedAt: '2026-05-31T12:01:02.000Z',
    percentComplete: null,
    status: 'queued',
  });
});

test('buildMediaRequestTransferProgress returns null without useful persisted data', () => {
  assert.equal(buildMediaRequestTransferProgress(null), null);
  assert.equal(buildMediaRequestTransferProgress({ execution: {} }), null);
  assert.equal(buildMediaRequestTransferProgress({
    execution: {
      latestTransferSnapshot: {
        summary: {
          percentComplete: ' ',
          status: 'internal_only',
        },
      },
    },
  }), null);
});
