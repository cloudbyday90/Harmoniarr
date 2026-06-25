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
import { resolveArtworkDisplayState } from '../../src/client/lib/artwork-display-state.js';

// ── image state ───────────────────────────────────────────────────────────────

test('resolveArtworkDisplayState returns "image" when a url is present', () => {
  assert.equal(resolveArtworkDisplayState({ url: '/art/a.jpg', isResolving: false }), 'image');
});

test('resolveArtworkDisplayState returns "image" even while resolving once a url exists', () => {
  // A cached URL wins over the in-flight flag — never skeleton a resolved card.
  assert.equal(resolveArtworkDisplayState({ url: '/art/a.jpg', isResolving: true }), 'image');
});

test('resolveArtworkDisplayState ignores a non-string url', () => {
  assert.equal(resolveArtworkDisplayState({ url: 42, isResolving: false }), 'initial');
  assert.equal(resolveArtworkDisplayState({ url: { href: '/a.jpg' }, isResolving: false }), 'initial');
});

test('resolveArtworkDisplayState treats an empty-string url as absent', () => {
  assert.equal(resolveArtworkDisplayState({ url: '', isResolving: false }), 'initial');
  assert.equal(resolveArtworkDisplayState({ url: '', isResolving: true }), 'loading');
});

// ── loading state ─────────────────────────────────────────────────────────────

test('resolveArtworkDisplayState returns "loading" when there is no url and resolution is in flight', () => {
  assert.equal(resolveArtworkDisplayState({ url: null, isResolving: true }), 'loading');
});

test('resolveArtworkDisplayState requires a strict-boolean true to show loading', () => {
  // Truthy coercion must not trigger a perpetual skeleton from a stale flag.
  assert.equal(resolveArtworkDisplayState({ url: null, isResolving: 'yes' }), 'initial');
  assert.equal(resolveArtworkDisplayState({ url: null, isResolving: 1 }), 'initial');
});

// ── initial state ─────────────────────────────────────────────────────────────

test('resolveArtworkDisplayState returns "initial" when resolution is done with no artwork', () => {
  assert.equal(resolveArtworkDisplayState({ url: null, isResolving: false }), 'initial');
});

test('resolveArtworkDisplayState returns "initial" for a missing descriptor', () => {
  assert.equal(resolveArtworkDisplayState(), 'initial');
  assert.equal(resolveArtworkDisplayState({}), 'initial');
});

test('resolveArtworkDisplayState returns "initial" when url and isResolving are both absent', () => {
  assert.equal(resolveArtworkDisplayState({ url: undefined, isResolving: undefined }), 'initial');
});

// ── integration: resolution lifecycle ─────────────────────────────────────────

test('a card walks loading -> image as the batch resolves', () => {
  assert.equal(resolveArtworkDisplayState({ url: null, isResolving: true }), 'loading');
  assert.equal(resolveArtworkDisplayState({ url: '/art/a.jpg', isResolving: true }), 'image');
  assert.equal(resolveArtworkDisplayState({ url: '/art/a.jpg', isResolving: false }), 'image');
});

test('a card with no artwork walks loading -> initial and never skeletons forever', () => {
  assert.equal(resolveArtworkDisplayState({ url: null, isResolving: true }), 'loading');
  assert.equal(resolveArtworkDisplayState({ url: null, isResolving: false }), 'initial');
});
