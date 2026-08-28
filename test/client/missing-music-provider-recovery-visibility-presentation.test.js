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
  buildMissingMusicProviderRecoveryVisibility,
  isMissingMusicProviderReadyRecoveryContext,
  MISSING_MUSIC_PROVIDER_READY_RECOVERY_CONTEXT,
  omitMissingMusicProviderReadyRecoveryQuery,
} from '../../src/client/lib/missing-music-provider-recovery-visibility-presentation.js';

test('Missing Music recovery accepts only its fixed ready return context', () => {
  assert.equal(isMissingMusicProviderReadyRecoveryContext(MISSING_MUSIC_PROVIDER_READY_RECOVERY_CONTEXT), true);
  assert.equal(isMissingMusicProviderReadyRecoveryContext('music_queue'), false);
  assert.equal(isMissingMusicProviderReadyRecoveryContext('/app/music-queue'), false);
  assert.equal(isMissingMusicProviderReadyRecoveryContext('https://outside.example'), false);
});

test('Missing Music recovery consumes only its one-time query key', () => {
  assert.deepEqual(omitMissingMusicProviderReadyRecoveryQuery({
    recovery: MISSING_MUSIC_PROVIDER_READY_RECOVERY_CONTEXT,
    release: 'wanted-1',
  }), {
    release: 'wanted-1',
  });
  assert.deepEqual(omitMissingMusicProviderReadyRecoveryQuery(null), {});
});

test('Missing Music recovery reports the first API-ordered release waiting for a normal search', () => {
  const visibility = buildMissingMusicProviderRecoveryVisibility({
    releases: [
      { artistName: 'Forest Frank', id: 'active', releaseTitle: 'Good Day', statusCode: 'searching' },
      { artistName: 'Forest Frank', id: 'first-waiting', releaseTitle: 'New Hymns', statusCode: 'queued_for_search' },
      { artistName: 'Forest Frank', id: 'second-waiting', releaseTitle: 'Sunset', statusCode: 'queued_for_search' },
    ],
  });

  assert.deepEqual(visibility, {
    copy: 'New Hymns by Forest Frank is waiting for its next normal search check. Harmoniarr has not started a download yet.',
    outcome: 'waiting_for_search',
    releaseId: 'first-waiting',
    title: 'Missing Music is ready',
    tone: 'success',
  });
});

test('Missing Music recovery does not mislabel active or blocked work as waiting', () => {
  const visibility = buildMissingMusicProviderRecoveryVisibility({
    releases: [
      { id: 'searching', statusCode: 'searching' },
      { id: 'downloading', statusCode: 'downloading' },
      { id: 'quality', statusCode: 'quality_choice_needed' },
    ],
  });

  assert.equal(visibility.outcome, 'no_waiting_release');
  assert.match(visibility.copy, /No release is waiting for a normal search check/);
  assert.match(visibility.title, /Missing Music/);
});

test('Missing Music recovery keeps failed refresh feedback generic', () => {
  const visibility = buildMissingMusicProviderRecoveryVisibility({
    refreshFailed: true,
    releases: [{ id: 'waiting', statusCode: 'queued_for_search' }],
  });

  assert.equal(visibility.outcome, 'refresh_failed');
  assert.match(visibility.title, /Missing Music/);
  assert.doesNotMatch(JSON.stringify(visibility), /secret|https?:|path/i);
});
