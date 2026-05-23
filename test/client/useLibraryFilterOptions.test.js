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
import { useLibraryFilterOptions } from '../../src/client/composables/useLibraryFilterOptions.js';

test('useLibraryFilterOptions options is null initially', () => {
  const { options, destroy } = useLibraryFilterOptions({
    fetchOptions: async () => ({ formats: [], genres: [] }),
    pollIntervalMs: 0,
  });

  assert.equal(options.value, null);
  destroy();
});

test('useLibraryFilterOptions load populates options on success', async () => {
  const { options, load, destroy } = useLibraryFilterOptions({
    fetchOptions: async () => ({ formats: ['FLAC', 'MP3'], genres: ['Rock'] }),
    pollIntervalMs: 0,
  });

  await load();
  assert.deepEqual(options.value, { formats: ['FLAC', 'MP3'], genres: ['Rock'] });
  destroy();
});

test('useLibraryFilterOptions load silently suppresses errors', async () => {
  const { options, load, destroy } = useLibraryFilterOptions({
    fetchOptions: async () => { throw new Error('network error'); },
    pollIntervalMs: 0,
  });

  await load();
  assert.equal(options.value, null);
  destroy();
});

test('useLibraryFilterOptions load handles null response', async () => {
  const { options, load, destroy } = useLibraryFilterOptions({
    fetchOptions: async () => null,
    pollIntervalMs: 0,
  });

  await load();
  assert.equal(options.value, null);
  destroy();
});

test('useLibraryFilterOptions revalidate preserves stale data on error', async () => {
  let callCount = 0;
  const { options, load, revalidate, destroy } = useLibraryFilterOptions({
    fetchOptions: async () => {
      callCount += 1;
      if (callCount === 1) return { formats: ['FLAC'], genres: [] };
      throw new Error('poll failure');
    },
    pollIntervalMs: 0,
  });

  await load();
  assert.deepEqual(options.value?.formats, ['FLAC']);

  await revalidate();
  assert.deepEqual(options.value?.formats, ['FLAC'], 'stale data preserved on revalidation error');
  destroy();
});

test('useLibraryFilterOptions load is callable multiple times', async () => {
  let callCount = 0;
  const { options, load, destroy } = useLibraryFilterOptions({
    fetchOptions: async () => {
      callCount += 1;
      return { formats: [`fmt${callCount}`], genres: [] };
    },
    pollIntervalMs: 0,
  });

  await load();
  assert.deepEqual(options.value?.formats, ['fmt1']);

  await load();
  assert.deepEqual(options.value?.formats, ['fmt2']);

  assert.equal(callCount, 2);
  destroy();
});

test('useLibraryFilterOptions isRevalidating is true during revalidate', async () => {
  const { isRevalidating, load, revalidate, destroy } = useLibraryFilterOptions({
    fetchOptions: async () => ({ formats: [], genres: [] }),
    pollIntervalMs: 0,
  });

  await load();
  assert.equal(isRevalidating.value, false);

  const p = revalidate();
  assert.equal(isRevalidating.value, true);
  await p;
  assert.equal(isRevalidating.value, false);
  destroy();
});

test('useLibraryFilterOptions destroy stops polling', async () => {
  let callCount = 0;
  const { load, destroy } = useLibraryFilterOptions({
    fetchOptions: async () => {
      callCount += 1;
      return { formats: [], genres: [] };
    },
    pollIntervalMs: 50,
  });

  await load();
  assert.equal(callCount, 1);
  destroy();

  await new Promise((resolve) => { setTimeout(resolve, 120); });
  assert.equal(callCount, 1, 'no additional fetch after destroy');
});

test('useLibraryFilterOptions revalidate is no-op after destroy', async () => {
  let callCount = 0;
  const { load, revalidate, destroy } = useLibraryFilterOptions({
    fetchOptions: async () => {
      callCount += 1;
      return { formats: [], genres: [] };
    },
    pollIntervalMs: 0,
  });

  await load();
  assert.equal(callCount, 1);
  destroy();

  await revalidate();
  assert.equal(callCount, 1, 'no fetch after destroy');
});
