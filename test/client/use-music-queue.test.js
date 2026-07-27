/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  hasActiveMusicQueueProgress,
  MUSIC_QUEUE_ACTIVE_PROGRESS_STATUSES,
} from '../../src/client/composables/useMusicQueue.js';

test('Music Queue polls only while release progress can advance automatically', () => {
  assert.equal(hasActiveMusicQueueProgress({
    releases: [{ statusCode: 'trying_next_match' }],
  }), true);
  assert.equal(hasActiveMusicQueueProgress({
    releases: [{ status: { code: 'downloading' } }],
  }), true);
  assert.equal(hasActiveMusicQueueProgress({
    releases: [{ statusCode: 'in_library' }],
  }), false);
  assert.equal(hasActiveMusicQueueProgress({
    releases: [{ statusCode: 'quality_choice_needed' }],
  }), false);
  assert.equal(hasActiveMusicQueueProgress({ releases: [] }), false);
  assert.equal(hasActiveMusicQueueProgress(null), false);
});

test('Music Queue active progress statuses cover automatic search, recovery, download, and add work', () => {
  assert.deepEqual(MUSIC_QUEUE_ACTIVE_PROGRESS_STATUSES, [
    'adding_to_library',
    'checking_matches',
    'downloading',
    'ready_to_add',
    'searching',
    'trying_next_match',
  ]);
});
