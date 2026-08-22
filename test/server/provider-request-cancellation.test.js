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
  awaitProviderRequest,
  waitForProviderRequestDelay,
} from '../../src/server/integrations/provider-request-cancellation.js';

test('awaitProviderRequest returns the internal response-budget abort reason without waiting for settlement', async () => {
  let resolveRequest;
  const pendingRequest = new Promise((resolve) => {
    resolveRequest = resolve;
  });
  const controller = new AbortController();
  const abortReason = new Error('related artists response budget exhausted');

  const waiting = awaitProviderRequest(pendingRequest, { signal: controller.signal });
  controller.abort(abortReason);

  await assert.rejects(waiting, (error) => error === abortReason);
  resolveRequest({ ok: true });
});

test('waitForProviderRequestDelay does not invoke sleep after an internal deadline has expired', async (t) => {
  const controller = new AbortController();
  const sleepImpl = t.mock.fn(async () => {});
  const abortReason = new Error('related artists response budget exhausted');
  controller.abort(abortReason);

  await assert.rejects(
    () => waitForProviderRequestDelay(1000, { signal: controller.signal, sleepImpl }),
    (error) => error === abortReason,
  );

  assert.equal(sleepImpl.mock.callCount(), 0);
});
