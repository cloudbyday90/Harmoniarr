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
import { buildReleaseEditionOptions, getReleaseEditionTarget, getAvailableReleaseEditionKey } from '../../src/client/lib/release-edition-options.js';

test('edition choices expose every supplied edition beyond six with distinct labels', () => {
  const options = buildReleaseEditionOptions(Array.from({ length: 12 }, (_, index) => ({
    id: `local-${index}`, country: 'US', releaseDate: '2026-09-12', trackCount: 10,
  })));
  assert.equal(options.length, 12);
  assert.equal(new Set(options.map((option) => option.label)).size, 12);
  assert.equal(options[11].target.preferReleaseId, 'local-11');
});

test('local and remote edition identities never confuse local IDs and MusicBrainz IDs', () => {
  assert.deepEqual(getReleaseEditionTarget({ id: 'local', musicbrainzReleaseId: 'remote' }), {
    key: 'local:local', preferReleaseId: 'local',
  });
  assert.deepEqual(getReleaseEditionTarget({ id: null, musicbrainzReleaseId: 'remote' }), {
    key: 'musicbrainz:remote', preferReleaseMbid: 'remote',
  });
  const options = buildReleaseEditionOptions([
    { id: null, musicbrainzReleaseId: 'first' }, { id: null, musicbrainzReleaseId: 'second' },
  ]);
  assert.notEqual(options[0].key, options[1].key);
});

test('missing identities remain visible but cannot produce a preview target', () => {
  const [option] = buildReleaseEditionOptions([{ id: ' ', musicbrainzReleaseId: null }]);
  assert.equal(option.target, null);
  assert.match(option.label, /Preview unavailable/);
  assert.equal(getReleaseEditionTarget(null), null);
});

test('edition labels use supplied disambiguation and full date without inventing formats', () => {
  const [option] = buildReleaseEditionOptions([{ id: 'local', disambiguation: 'Deluxe', releaseDate: '2001-02-03', trackCount: 4 }]);
  assert.match(option.label, /Country not specified/);
  assert.match(option.label, /2001-02-03/);
  assert.match(option.label, /4 tracks/);
  assert.match(option.label, /Deluxe/);
  assert.doesNotMatch(option.label, /CD|Vinyl/);
});

test('a current edition missing from supplied choices yields a usable placeholder selection', () => {
  const options = buildReleaseEditionOptions([{ id: 'local' }, { id: null, musicbrainzReleaseId: 'remote' }]);
  assert.equal(getAvailableReleaseEditionKey(options, { id: 'absent' }), '');
  assert.equal(getAvailableReleaseEditionKey(options, { id: null, musicbrainzReleaseId: 'remote' }), 'musicbrainz:remote');
  assert.equal(getAvailableReleaseEditionKey(options, null), '');
});

test('a remote option keeps its key when imported locally but previews the local release', () => {
  const [remote] = buildReleaseEditionOptions([{ id: null, musicbrainzReleaseId: 'remote' }]);
  const hydrated = { id: 'local', musicbrainzReleaseId: 'remote' };
  const [local] = buildReleaseEditionOptions([hydrated]);
  assert.equal(remote.key, local.key);
  assert.equal(local.target.preferReleaseId, 'local');
  assert.equal(getAvailableReleaseEditionKey([local], hydrated), remote.key);
  assert.equal(getAvailableReleaseEditionKey([local], { id: null, musicbrainzReleaseId: 'remote' }), remote.key);
});
