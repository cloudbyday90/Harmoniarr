/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildMissingReleaseDecisionPresentation,
  buildMissingReleaseMusicQueueRoute,
} from '../../src/client/lib/missing-release-decision-presentation.js';

test('buildMissingReleaseMusicQueueRoute uses only the durable wanted-release identity', () => {
  assert.deepEqual(
    buildMissingReleaseMusicQueueRoute({
      id: 'wanted-amber',
      musicbrainzReleaseId: 'musicbrainz-amber',
    }),
    {
      name: 'acquisition-music-queue-release',
      params: { wantedReleaseId: 'wanted-amber' },
    },
  );
});

test('buildMissingReleaseMusicQueueRoute returns null without a release identity', () => {
  assert.equal(buildMissingReleaseMusicQueueRoute({ title: 'Amber' }), null);
});

test('buildMissingReleaseDecisionPresentation keeps visible labels and accessible names aligned', () => {
  assert.deepEqual(
    buildMissingReleaseDecisionPresentation({
      artistCredit: 'Autechre',
      title: 'Amber',
    }),
    {
      openMusicQueue: {
        accessibleLabel: 'Open Music Queue for Autechre — Amber',
        label: 'Open Music Queue',
      },
      startSearch: {
        accessibleLabel: 'Start a search for Autechre — Amber',
        label: 'Start search',
        summary: 'Start a search, then choose a match in Music Queue if Harmoniarr cannot decide automatically.',
      },
    },
  );
});
