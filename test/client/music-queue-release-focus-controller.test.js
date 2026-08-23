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
  createMusicQueueReleaseFocusController,
  MUSIC_QUEUE_RELEASE_FOCUS_ORIGIN,
} from '../../src/client/lib/music-queue-release-focus-controller.js';

test('Music Queue preserves the row origin before the queue-heading Close fallback', () => {
  const controller = createMusicQueueReleaseFocusController();
  const trigger = { focus() {} };
  const queueHeading = { focus() {} };
  const pageHeading = { focus() {} };

  controller.selectFromRow({ releaseId: ' wanted-quality ', trigger });
  assert.deepEqual(controller.synchronizeRouteSelection('wanted-quality'), {
    origin: MUSIC_QUEUE_RELEASE_FOCUS_ORIGIN.ROW,
    releaseId: 'wanted-quality',
    trigger,
  });
  assert.equal(controller.shouldFocusDirectInspectorHeading({
    isReady: true,
    releaseId: 'wanted-quality',
  }), false);

  assert.deepEqual(controller.takeCloseFocusTargets(queueHeading, pageHeading), [
    trigger,
    queueHeading,
    pageHeading,
  ]);
  assert.equal(controller.getSelection(), null);
});

test('Music Queue uses only the queue-heading Close fallback for a direct release URL', () => {
  const controller = createMusicQueueReleaseFocusController();
  const queueHeading = { focus() {} };
  const pageHeading = { focus() {} };

  controller.synchronizeRouteSelection('wanted-quality');
  assert.deepEqual(controller.takeCloseFocusTargets(queueHeading, pageHeading), [queueHeading, pageHeading]);
});

test('Music Queue de-duplicates a repeated row-origin and Close fallback target', () => {
  const controller = createMusicQueueReleaseFocusController();
  const target = { focus() {} };

  controller.selectFromRow({ releaseId: 'wanted-quality', trigger: target });
  assert.deepEqual(controller.takeCloseFocusTargets(target, target), [target]);
});

test('Music Queue focuses a direct release inspector only once after it is ready', () => {
  const controller = createMusicQueueReleaseFocusController();

  assert.deepEqual(controller.synchronizeRouteSelection('wanted-quality'), {
    origin: MUSIC_QUEUE_RELEASE_FOCUS_ORIGIN.DIRECT,
    releaseId: 'wanted-quality',
    trigger: null,
  });
  assert.equal(controller.shouldFocusDirectInspectorHeading({
    isLoading: true,
    isReady: false,
    releaseId: 'wanted-quality',
  }), false);
  assert.equal(controller.shouldFocusDirectInspectorHeading({
    isReady: true,
    releaseId: 'wanted-quality',
  }), true);
  assert.equal(controller.shouldFocusDirectInspectorHeading({
    isReady: true,
    releaseId: 'wanted-quality',
  }), false);
});

test('Music Queue treats a changed release URL as a new direct focus target', () => {
  const controller = createMusicQueueReleaseFocusController();

  controller.synchronizeRouteSelection('wanted-first');
  assert.equal(controller.shouldFocusDirectInspectorHeading({
    isReady: true,
    releaseId: 'wanted-first',
  }), true);

  assert.equal(controller.synchronizeRouteSelection('wanted-second').origin, MUSIC_QUEUE_RELEASE_FOCUS_ORIGIN.DIRECT);
  assert.equal(controller.shouldFocusDirectInspectorHeading({
    isReady: true,
    releaseId: 'wanted-second',
  }), true);
});
