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
import { buildMissingMusicProgressStrip } from '../../src/client/lib/missing-music-progress-presentation.js';

function createRelease({
  id,
  statusCode,
  statusLabel = statusCode,
  statusTone = 'info',
  action = { type: 'review' },
  lastActivityAt = '2026-07-25T12:00:00.000Z',
} = {}) {
  return {
    action,
    artistName: 'Forest Frank',
    detailText: `${statusLabel} detail`,
    id,
    lastActivityAt,
    releaseTitle: `Release ${id}`,
    status: { label: statusLabel, tone: statusTone },
    statusCode,
  };
}

test('Missing Music progress prioritizes recoverable attention before automatic work', () => {
  const result = buildMissingMusicProgressStrip([
    createRelease({ id: 'queued', statusCode: 'queued_for_search', statusLabel: 'Waiting' }),
    createRelease({ id: 'downloading', statusCode: 'downloading', statusLabel: 'Downloading' }),
    createRelease({ id: 'quality', statusCode: 'quality_choice_needed', statusLabel: 'Quality choice needed', statusTone: 'warning' }),
    createRelease({ id: 'failed', statusCode: 'failed', statusLabel: 'Download needs attention', statusTone: 'danger' }),
  ]);

  assert.equal(result.attentionCount, 2);
  assert.equal(result.totalCount, 4);
  assert.deepEqual(result.rows.map((row) => row.id), ['quality', 'failed', 'downloading']);
  assert.match(result.summary, /2 releases need your attention/);
  assert.equal(result.rows[0].action.label, 'Review');
  assert.deepEqual(result.rows[0].action.to, {
    name: 'missing-decision',
    params: { decisionId: 'quality' },
  });
});

test('Missing Music progress links setup blockers to their dedicated safe route', () => {
  const result = buildMissingMusicProgressStrip([
    createRelease({
      action: { label: 'Set up folders', routeName: 'settings-media-storage', type: 'route' },
      id: 'setup',
      statusCode: 'needs_setup',
      statusLabel: 'Needs setup',
      statusTone: 'warning',
    }),
  ]);

  assert.deepEqual(result.rows[0].action, {
    label: 'Set up folders',
    to: {
      name: 'settings-media-storage',
      query: {
        returnReleaseId: 'setup',
        returnTo: 'missing_music_decision',
      },
    },
  });
});

test('Missing Music progress describes an empty scoped queue without a false completion claim', () => {
  const result = buildMissingMusicProgressStrip([]);

  assert.equal(result.attentionCount, 0);
  assert.equal(result.totalCount, 0);
  assert.deepEqual(result.rows, []);
  assert.equal(result.summary, 'Nothing is waiting in Missing Music right now.');
});

test('Home progress omits idle releases and sends active or attention states to release detail', () => {
  const result = buildMissingMusicProgressStrip([
    createRelease({ id: 'in-library', statusCode: 'in_library', statusLabel: 'In library' }),
    createRelease({ id: 'queued', statusCode: 'queued_for_search', statusLabel: 'Waiting' }),
    createRelease({ id: 'searching', statusCode: 'searching', statusLabel: 'Searching' }),
    createRelease({ id: 'match', statusCode: 'pick_match', statusLabel: 'Choose a match', statusTone: 'warning' }),
  ], {
    activeOrAttentionOnly: true,
    releaseDetailsOnly: true,
  });

  assert.equal(result.activeCount, 1);
  assert.equal(result.attentionCount, 1);
  assert.equal(result.totalCount, 2);
  assert.deepEqual(result.rows.map((row) => row.id), ['match', 'searching']);
  assert.match(result.summary, /1 release needs your attention\. 1 is still moving automatically\./);
  assert.deepEqual(result.rows[0].action, {
    label: 'View details',
    to: {
      name: 'missing-decision',
      params: { decisionId: 'match' },
    },
  });
});

test('Missing Music progress gives a linked live transfer an explicit Downloader handoff', () => {
  const result = buildMissingMusicProgressStrip([
    createRelease({ id: 'downloading', statusCode: 'downloading', statusLabel: 'Downloading' }),
  ], {
    transferProgressByRelease: {
      downloading: {
        handoff: {
          accessibleLabel: 'View download progress for Forest Frank — Release downloading',
          label: 'View download progress',
          location: {
            name: 'acquisition-downloader',
            query: { wantedReleaseId: 'downloading' },
          },
        },
        summary: '1 transfer is downloading',
      },
    },
  });

  assert.deepEqual(result.rows[0].action, {
    accessibleLabel: 'View download progress for Forest Frank — Release downloading',
    label: 'View download progress',
    to: {
      name: 'acquisition-downloader',
      query: { wantedReleaseId: 'downloading' },
    },
  });
  assert.equal(result.rows[0].transferProgress.summary, '1 transfer is downloading');
});

test('Home progress keeps its release-detail destination when download progress is linked', () => {
  const result = buildMissingMusicProgressStrip([
    createRelease({ id: 'downloading', statusCode: 'downloading', statusLabel: 'Downloading' }),
  ], {
    activeOrAttentionOnly: true,
    releaseDetailsOnly: true,
    transferProgressByRelease: {
      downloading: {
        handoff: {
          label: 'View download progress',
          location: { name: 'acquisition-downloader', query: { wantedReleaseId: 'downloading' } },
        },
        summary: '1 transfer is downloading',
      },
    },
  });

  assert.equal(result.rows[0].action.label, 'View details');
  assert.deepEqual(result.rows[0].action.to, {
    name: 'missing-decision',
    params: { decisionId: 'downloading' },
  });
});
