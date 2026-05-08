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

import webPush from 'web-push';

/**
 * Environment variable names used to supply VAPID keys to the server process.
 * Generate a key pair once with `web-push generate-vapid-keys --json` and set
 * these in your `.env` or container environment before starting.
 */
export const VAPID_PUBLIC_KEY_ENV = 'VAPID_PUBLIC_KEY';
export const VAPID_PRIVATE_KEY_ENV = 'VAPID_PRIVATE_KEY';

/**
 * Generates a new VAPID key pair and returns it as
 * `{ publicKey, privateKey }` (both base64url-encoded).
 *
 * Thin wrapper around `web-push.generateVAPIDKeys` to keep imports
 * centralised and allow injection in tests.
 *
 * @param {object} [options]
 * @param {function} [options.generateFn]
 * @returns {{ publicKey: string, privateKey: string }}
 */
export function generateVapidKeyPair({ generateFn = webPush.generateVAPIDKeys } = {}) {
  return generateFn();
}

/**
 * Resolves VAPID keys from the process environment.
 *
 * Returns `{ publicKey, privateKey }` when both variables are present and
 * non-empty. Returns `null` when either variable is missing so callers can
 * decide whether to auto-generate (dev) or throw (prod).
 *
 * @param {object} [options]
 * @param {object} [options.env] - Environment object (defaults to `process.env`).
 * @returns {{ publicKey: string, privateKey: string } | null}
 */
export function resolveVapidKeysFromEnv({ env = process.env } = {}) {
  const publicKey = typeof env[VAPID_PUBLIC_KEY_ENV] === 'string'
    ? env[VAPID_PUBLIC_KEY_ENV].trim()
    : '';
  const privateKey = typeof env[VAPID_PRIVATE_KEY_ENV] === 'string'
    ? env[VAPID_PRIVATE_KEY_ENV].trim()
    : '';

  if (!publicKey || !privateKey) {
    return null;
  }

  return { publicKey, privateKey };
}

/**
 * Resolves VAPID keys for use at runtime.
 *
 * - If both env vars are set, uses them directly.
 * - If either is missing, auto-generates a new pair, logs a prominent warning
 *   with the generated values so the operator can persist them, and returns
 *   the ephemeral pair.
 *
 * Ephemeral keys mean all browser subscriptions become invalid after each
 * restart. This is acceptable for development but **not** for production.
 *
 * @param {object} [options]
 * @param {object} [options.env]
 * @param {function} [options.generateFn]
 * @param {object} [options.stderr]
 * @returns {{ publicKey: string, privateKey: string }}
 */
export function resolveOrGenerateVapidKeys({
  env = process.env,
  generateFn = webPush.generateVAPIDKeys,
  stderr = process.stderr,
} = {}) {
  const resolved = resolveVapidKeysFromEnv({ env });
  if (resolved) {
    return resolved;
  }

  const generated = generateVapidKeyPair({ generateFn });

  stderr.write(
    `[harmoniarr-push] VAPID keys not set in environment. Generated an ephemeral pair for this run.\n` +
    `[harmoniarr-push] Push subscriptions will break on restart. Set these in your environment:\n` +
    `[harmoniarr-push]   ${VAPID_PUBLIC_KEY_ENV}=${generated.publicKey}\n` +
    `[harmoniarr-push]   ${VAPID_PRIVATE_KEY_ENV}=${generated.privateKey}\n`,
  );

  return generated;
}
