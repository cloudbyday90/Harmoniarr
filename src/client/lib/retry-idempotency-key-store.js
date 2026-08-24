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

import { createControlPlaneIdempotencyKey } from './control-plane-idempotency.js';

function normalizeRequiredValue(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${name} is required`);
  }

  return value.trim();
}

/**
 * Retains a generated idempotency key only while a client action has no
 * confirmed response. Reusing that key on a transport retry lets the server
 * return a completed mutation's stored result instead of repeating it.
 */
export function createRetryIdempotencyKeyStore({
  createIdempotencyKey = createControlPlaneIdempotencyKey,
} = {}) {
  const keysByAction = new Map();

  function getOrCreate({ actionKey, scope }) {
    const normalizedActionKey = normalizeRequiredValue(actionKey, 'actionKey');
    const normalizedScope = normalizeRequiredValue(scope, 'scope');
    const existingKey = keysByAction.get(normalizedActionKey);
    if (existingKey) {
      return existingKey;
    }

    const idempotencyKey = createIdempotencyKey(normalizedScope);
    keysByAction.set(normalizedActionKey, idempotencyKey);
    return idempotencyKey;
  }

  function clear(actionKey) {
    return keysByAction.delete(normalizeRequiredValue(actionKey, 'actionKey'));
  }

  return {
    clear,
    getOrCreate,
  };
}
