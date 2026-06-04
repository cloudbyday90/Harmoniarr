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
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  DEFAULT_TOAST_DURATION_MS,
  PERSIST_TOAST_DURATION_MS,
  isDuplicateToast,
  resolveToastDuration,
  resolveToastRole,
} from '../../src/client/lib/toast-feedback.js';

const USE_TOAST_PATH = new URL('../../src/client/composables/useToast.js', import.meta.url);
const TOAST_STACK_PATH = new URL('../../src/client/components/ToastStack.vue', import.meta.url);

test('resolveToastDuration: errors persist, other tones auto-dismiss', () => {
  assert.equal(resolveToastDuration('error'), PERSIST_TOAST_DURATION_MS);
  assert.equal(resolveToastDuration('success'), DEFAULT_TOAST_DURATION_MS);
  assert.equal(resolveToastDuration('info'), DEFAULT_TOAST_DURATION_MS);
  assert.equal(resolveToastDuration('warning'), DEFAULT_TOAST_DURATION_MS);
});

test('resolveToastDuration: explicit numeric override always wins', () => {
  assert.equal(resolveToastDuration('error', 1500), 1500);
  assert.equal(resolveToastDuration('success', 0), 0);
  // Negative durations are clamped to 0 (persist).
  assert.equal(resolveToastDuration('info', -200), 0);
  // Non-numeric overrides fall back to the tone default.
  assert.equal(resolveToastDuration('success', undefined), DEFAULT_TOAST_DURATION_MS);
  assert.equal(resolveToastDuration('error', Number.NaN), PERSIST_TOAST_DURATION_MS);
});

test('resolveToastRole: error/warning are assertive alerts, success/info are polite status', () => {
  assert.equal(resolveToastRole('error'), 'alert');
  assert.equal(resolveToastRole('warning'), 'alert');
  assert.equal(resolveToastRole('success'), 'status');
  assert.equal(resolveToastRole('info'), 'status');
});

test('isDuplicateToast detects identical tone + message pairs', () => {
  const toasts = [{ tone: 'success', message: 'Saved.' }];
  assert.equal(isDuplicateToast(toasts, 'success', 'Saved.'), true);
  assert.equal(isDuplicateToast(toasts, 'error', 'Saved.'), false);
  assert.equal(isDuplicateToast(toasts, 'success', 'Other.'), false);
  assert.equal(isDuplicateToast(null, 'success', 'Saved.'), false);
});

test('useToast composes the feedback convention and supports actions + dedupe', async () => {
  const source = await readFile(USE_TOAST_PATH, 'utf8');
  assert.match(source, /resolveToastDuration/, 'duration should derive from the shared convention');
  // Dedupe: identical tone + message is suppressed.
  assert.match(source, /toasts\.value\.find\(\(t\) => t\.tone === tone && t\.message === message\)/);
  // Optional action is carried on the toast shape.
  assert.match(source, /action:\s*action\s*\?\?\s*null/);
  // No hard-coded blanket duration constant any more.
  assert.doesNotMatch(source, /DEFAULT_DURATION_MS\s*=\s*4000/);
});

test('ToastStack maps tone to ARIA role and renders optional action button', async () => {
  const source = await readFile(TOAST_STACK_PATH, 'utf8');
  assert.match(source, /resolveToastRole/, 'role must come from the shared convention');
  assert.match(source, /:role="resolveToastRole\(toast\.tone\)"/);
  // Action affordance.
  assert.match(source, /hx-toast__action/);
  assert.match(source, /handleAction\(toast\)/);
  // The container no longer forces a single polite live region for every tone.
  assert.doesNotMatch(source, /aria-live="polite"/);
  // Items no longer hard-code role="status" for every tone.
  assert.doesNotMatch(source, /\srole="status"/);
});
