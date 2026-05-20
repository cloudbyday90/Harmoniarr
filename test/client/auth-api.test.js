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
import { suite, test } from 'node:test';
import { startPlexSignIn } from '../../src/client/lib/auth-api.js';

function createJsonResponse({ ok = true, payload = { ok: true }, status = 200 } = {}) {
  return {
    headers: new Headers({ 'content-type': 'application/json' }),
    ok,
    status,
    async json() {
      return payload;
    },
  };
}

suite('auth-api', () => {
  test('startPlexSignIn posts the redirect target to the shared auth route', async (t) => {
    globalThis.fetch = t.mock.fn(async () => createJsonResponse({ payload: { ok: true, provider: 'plex' } }));

    await startPlexSignIn({ redirect: '/app/activity/blocklist' });

    assert.equal(globalThis.fetch.mock.callCount(), 1);
    const [url, options] = globalThis.fetch.mock.calls[0].arguments;
    assert.equal(url, '/api/v1/auth/plex/start');
    assert.equal(options.method, 'POST');
    assert.equal(options.body, JSON.stringify({ redirect: '/app/activity/blocklist' }));
  });
});
