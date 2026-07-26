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

import { resolveDockerFileBackedMusicQueueValidationInputs } from '../../scripts/docker-file-backed-music-queue-validation.js';

test('file-backed Music Queue validation builds the local image by default', () => {
  assert.deepEqual(resolveDockerFileBackedMusicQueueValidationInputs({
    args: [],
    env: {},
  }), {
    buildImage: true,
    imageRef: null,
    startupTimeoutSeconds: 180,
  });
});

test('file-backed Music Queue validation requires an explicit local image for no-build mode', () => {
  assert.throws(
    () => resolveDockerFileBackedMusicQueueValidationInputs({
      args: ['--no-build'],
      env: {},
    }),
    /--no-build requires HARMONIARR_FILE_BACKED_VALIDATION_IMAGE/u,
  );
});

test('file-backed Music Queue validation accepts a prebuilt image and startup timeout', () => {
  assert.deepEqual(resolveDockerFileBackedMusicQueueValidationInputs({
    args: ['--no-build'],
    env: {
      HARMONIARR_FILE_BACKED_VALIDATION_IMAGE: 'harmoniarr:file-backed-test',
      HARMONIARR_FILE_BACKED_VALIDATION_STARTUP_TIMEOUT_SECONDS: '240',
    },
  }), {
    buildImage: false,
    imageRef: 'harmoniarr:file-backed-test',
    startupTimeoutSeconds: 240,
  });
});
