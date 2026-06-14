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
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { useAddArtistModal } from '../../src/client/composables/useAddArtistModal.js';

const DISCOVER_VIEW_PATH = new URL('../../src/client/views/DiscoverView.vue', import.meta.url);
const SEARCH_VIEW_PATH = new URL('../../src/client/views/SearchView.vue', import.meta.url);

function buildMonitoringStub({ addResult } = {}) {
  const monitored = new Set();
  const monitoringNow = new Set();
  return {
    monitored,
    isMonitored: (id) => monitored.has(id),
    isMonitoring: (id) => monitoringNow.has(id),
    addArtistWithPolicy: async () => addResult,
  };
}

test('useAddArtistModal opens for a fresh artist and no-ops for an added one', () => {
  const monitoring = buildMonitoringStub();
  monitoring.monitored.add('already');
  const modal = useAddArtistModal({ monitoring });

  modal.openAddArtistModal({ id: 'fresh', name: 'Fresh' });
  assert.equal(modal.addArtistModalOpen.value, true);
  assert.equal(modal.addArtistCandidate.value.id, 'fresh');

  modal.closeAddArtistModal();
  assert.equal(modal.addArtistModalOpen.value, false);
  assert.equal(modal.addArtistCandidate.value, null);

  // Already-monitored artists must not open the dialog.
  modal.openAddArtistModal({ id: 'already', name: 'Already' });
  assert.equal(modal.addArtistModalOpen.value, false);
});

test('useAddArtistModal honours a custom isAlreadyAdded predicate', () => {
  const monitoring = buildMonitoringStub();
  const modal = useAddArtistModal({ monitoring });
  const addedIds = new Set(['candidate']);

  modal.openAddArtistModal({ id: 'candidate', name: 'Candidate' }, (id) => addedIds.has(id));
  assert.equal(modal.addArtistModalOpen.value, false);
});

test('useAddArtistModal submit runs onAdded then closes on success', async () => {
  const monitoring = buildMonitoringStub({
    addResult: { success: true, policy: { useAsDefault: false } },
  });
  const modal = useAddArtistModal({ monitoring });
  modal.openAddArtistModal({ id: 'fresh', name: 'Fresh' });

  const added = [];
  await modal.submitAddArtist({ any: 'policy' }, { onAdded: (artist) => added.push(artist.id) });

  assert.deepEqual(added, ['fresh']);
  assert.equal(modal.lastAddedArtistId.value, 'fresh');
  assert.equal(modal.addArtistModalOpen.value, false);
});

test('useAddArtistModal surfaces a submit error and keeps the dialog open', async () => {
  const monitoring = buildMonitoringStub({
    addResult: { error: { message: 'nope' } },
  });
  const modal = useAddArtistModal({ monitoring });
  modal.openAddArtistModal({ id: 'fresh', name: 'Fresh' });

  await modal.submitAddArtist({ any: 'policy' });
  assert.equal(modal.addArtistErrorMessage.value, 'nope');
  assert.equal(modal.addArtistModalOpen.value, true);
});

test('Discover and Search both drive the shared add-artist policy flow', async () => {
  const discover = await readFile(DISCOVER_VIEW_PATH, 'utf8');
  assert.match(discover, /import \{ useAddArtistModal \} from '\.\.\/composables\/useAddArtistModal\.js'/);
  assert.match(discover, /useAddArtistModal\(\{ monitoring \}\)/);
  assert.match(discover, /<AddArtistModal/);

  const search = await readFile(SEARCH_VIEW_PATH, 'utf8');
  assert.match(search, /import \{ useAddArtistModal \} from '\.\.\/composables\/useAddArtistModal\.js'/);
  assert.match(search, /useAddArtistModal\(\{ monitoring \}\)/);
  assert.match(search, /<AddArtistModal/);

  // Search must no longer use the legacy one-tap monitor affordance.
  assert.doesNotMatch(search, /monitorArtist/);
});
