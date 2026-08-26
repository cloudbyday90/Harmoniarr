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
  buildAcquisitionOverviewCards,
  buildAcquisitionTransferPanel,
  buildAcquisitionTransferRows,
} from '../../src/client/lib/acquisition-overview-presentation.js';

function createDownloaderQueue(overrides = {}) {
  return {
    providerState: { enabled: true, message: 'Download provider is configured.' },
    queueHealth: {
      counts: { active: 1, queued: 1 },
    },
    transfers: [
      {
        averageSpeed: 1024,
        filename: '/downloads/Zeta.flac',
        id: 'transfer-active',
        progress: { percentComplete: 65, size: 4096 },
        sourceUser: 'source-a',
        state: { code: 'active', label: 'Downloading', tone: 'warning' },
        transferKey: 'source-a::transfer-active',
      },
      {
        averageSpeed: 0,
        filename: '/downloads/Alpha.flac',
        id: 'transfer-queued',
        progress: { percentComplete: null, size: 8192 },
        sourceUser: 'source-b',
        state: { code: 'queued', label: 'Queued', tone: 'info' },
        transferKey: 'source-b::transfer-queued',
      },
      {
        filename: '/downloads/Completed.flac',
        id: 'transfer-complete',
        sourceUser: 'source-c',
        state: { code: 'completed', label: 'Completed', tone: 'success' },
        transferKey: 'source-c::transfer-complete',
      },
    ],
    ...overrides,
  };
}

test('Acquisition overview keeps release and transfer summary counts in separate lanes', () => {
  const cards = buildAcquisitionOverviewCards({
    canViewDownloader: true,
    downloaderQueue: createDownloaderQueue(),
    releases: [
      { statusCode: 'pick_match' },
      { statusCode: 'downloading' },
      { statusCode: 'in_library' },
    ],
  });

  assert.deepEqual(cards.map((card) => ({ key: card.key, value: card.value })), [
    { key: 'release-actions', value: 1 },
    { key: 'release-progress', value: 1 },
    { key: 'active-transfers', value: 1 },
    { key: 'queued-transfers', value: 1 },
  ]);
});

test('Acquisition overview omits downloader metrics when the session cannot view provider rows', () => {
  const cards = buildAcquisitionOverviewCards({
    canViewDownloader: false,
    downloaderQueue: createDownloaderQueue(),
    releases: [{ statusCode: 'pick_match' }],
  });

  assert.deepEqual(cards.map((card) => card.key), [
    'release-actions',
    'release-progress',
  ]);
});

test('Acquisition transfer rows show only live work and retain the Downloader handoff', () => {
  const rows = buildAcquisitionTransferRows(createDownloaderQueue());

  assert.deepEqual(rows.map((row) => row.id), [
    'source-a::transfer-active',
    'source-b::transfer-queued',
  ]);
  assert.equal(rows[0].title, 'Zeta.flac');
  assert.equal(rows[0].progressValue, 65);
  assert.equal(rows[0].location.name, 'downloader');
  assert.deepEqual(rows[0].location.query, {
    open: 'details',
    transferId: 'transfer-active',
    username: 'source-a',
  });
  assert.equal(rows[1].progressLabel, 'Queued');
});

test('Acquisition transfer rows use a release-scoped handoff for a verified Music Queue link', () => {
  const queue = createDownloaderQueue({
    transfers: [
      {
        ...createDownloaderQueue().transfers[0],
        diagnostics: {
          importLinkage: {
            musicQueueRelease: {
              artistName: 'Forest Frank',
              releaseTitle: 'Child of God',
              wantedReleaseId: 'wanted-forest-frank',
            },
          },
        },
      },
    ],
  });

  const [row] = buildAcquisitionTransferRows(queue);

  assert.equal(row.action.label, 'View download progress');
  assert.equal(row.action.accessibleLabel, 'View download progress for Forest Frank — Child of God');
  assert.deepEqual(row.location, {
    name: 'downloader',
    query: { wantedReleaseId: 'wanted-forest-frank' },
  });
  assert.doesNotMatch(JSON.stringify(row.location), /source-a|transfer-active/);
});

test('Acquisition transfer panel distinguishes setup and role-restricted states from an empty queue', () => {
  assert.deepEqual(buildAcquisitionTransferPanel(createDownloaderQueue(), {
    canViewDownloader: false,
  }), {
    body: 'Download progress is available to administrators.',
    rows: [],
    state: 'restricted',
    title: 'Download progress',
  });

  assert.deepEqual(buildAcquisitionTransferPanel({
    providerState: { enabled: false, message: 'Soulseek downloads are turned off in Settings.' },
    queueHealth: { status: 'disabled' },
    transfers: [],
  }, {
    canViewDownloader: true,
  }), {
    body: 'Soulseek downloads are turned off in Settings.',
    rows: [],
    state: 'setup',
    title: 'Set up Soulseek',
  });

  assert.equal(buildAcquisitionTransferPanel(createDownloaderQueue({
    transfers: [],
  }), {
    canViewDownloader: true,
  }).state, 'empty');
});
