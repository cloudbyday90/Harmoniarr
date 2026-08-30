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

import { observeArtistDetailPresentation } from '../../scripts/artist-detail-local-presentation-observer.js';

function createFakePage({ articleWaitError, busyWaitError, observedAtMs = 18 } = {}) {
  const calls = [];
  const busyRegion = {
    waitFor: async (options) => {
      calls.push({ target: 'busy', options });
      if (busyWaitError) {
        throw busyWaitError;
      }
    },
  };
  const article = {
    locator: (selector) => {
      calls.push({ selector, target: 'article' });
      return busyRegion;
    },
    waitFor: async (options) => {
      calls.push({ target: 'article', options });
      if (articleWaitError) {
        throw articleWaitError;
      }
    },
  };

  return {
    calls,
    evaluate: async (callback) => {
      assert.equal(typeof callback, 'function');
      return observedAtMs;
    },
    getByRole: (role, options) => {
      calls.push({ role, target: 'page', options });
      return article;
    },
  };
}

test('Artist Detail presentation observer waits for the named busy region to finish', async () => {
  const page = createFakePage({ observedAtMs: 23.7 });

  const evidence = await observeArtistDetailPresentation({ page, timeoutMs: 50 });

  assert.deepEqual(evidence, { observedAtMs: 24, state: 'ready' });
  assert.deepEqual(page.calls, [
    {
      options: { exact: true, name: 'Discography' },
      role: 'article',
      target: 'page',
    },
    { options: { state: 'visible', timeout: 50 }, target: 'article' },
    { selector: '[aria-busy="true"]', target: 'article' },
    { options: { state: 'detached', timeout: 50 }, target: 'busy' },
  ]);
});

test('Artist Detail presentation observer exposes only fixed unavailable and loading results', async () => {
  const unavailablePage = createFakePage({
    articleWaitError: new Error('missing named article'),
    observedAtMs: 37,
  });
  const loadingPage = createFakePage({
    busyWaitError: new Error('busy state persisted'),
    observedAtMs: 61,
  });

  assert.deepEqual(
    await observeArtistDetailPresentation({ page: unavailablePage, timeoutMs: 50 }),
    { observedAtMs: 37, state: 'unavailable' },
  );
  assert.deepEqual(
    await observeArtistDetailPresentation({ page: loadingPage, timeoutMs: 50 }),
    { observedAtMs: 61, state: 'still_loading' },
  );
  await assert.rejects(
    observeArtistDetailPresentation({ page: loadingPage, timeoutMs: 0 }),
    /bounded positive integer/u,
  );
});
