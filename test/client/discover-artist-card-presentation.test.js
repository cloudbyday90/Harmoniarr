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
import { resolveDiscoverArtistCardActionState } from '../../src/client/lib/discover-artist-card-presentation.js';

test('resolveDiscoverArtistCardActionState returns icon add affordance for addable artists', () => {
  assert.deepEqual(resolveDiscoverArtistCardActionState({ artistName: 'Radiohead' }), {
    state: 'addable',
    visibleLabel: '+',
    ariaLabel: 'Add Radiohead',
    buttonVariant: 'primary',
    buttonDisabled: false,
    iconOnly: true,
    ariaBusy: undefined,
  });
});

test('resolveDiscoverArtistCardActionState announces pending add state', () => {
  const state = resolveDiscoverArtistCardActionState({
    artistName: 'Björk',
    monitoring: true,
  });

  assert.equal(state.state, 'adding');
  assert.equal(state.visibleLabel, 'Adding...');
  assert.equal(state.ariaLabel, 'Adding Björk');
  assert.equal(state.buttonDisabled, true);
  assert.equal(state.iconOnly, false);
  assert.equal(state.ariaBusy, 'true');
});

test('resolveDiscoverArtistCardActionState announces already monitored artists', () => {
  const state = resolveDiscoverArtistCardActionState({
    artistName: 'Massive Attack',
    monitored: true,
  });

  assert.equal(state.state, 'monitored');
  assert.equal(state.visibleLabel, 'Already monitored');
  assert.equal(state.ariaLabel, 'Already monitored: Massive Attack');
  assert.equal(state.buttonVariant, 'ghost');
  assert.equal(state.buttonDisabled, true);
  assert.equal(state.iconOnly, false);
  assert.equal(state.ariaBusy, undefined);
});

test('resolveDiscoverArtistCardActionState distinguishes unavailable add actions', () => {
  const state = resolveDiscoverArtistCardActionState({
    artistName: 'Portishead',
    disabled: true,
  });

  assert.equal(state.state, 'unavailable');
  assert.equal(state.visibleLabel, 'Unavailable');
  assert.equal(state.ariaLabel, 'Add unavailable for Portishead');
  assert.equal(state.buttonVariant, 'ghost');
  assert.equal(state.buttonDisabled, true);
  assert.equal(state.iconOnly, false);
});

test('resolveDiscoverArtistCardActionState gives pending adds precedence', () => {
  const state = resolveDiscoverArtistCardActionState({
    artistName: 'Aphex Twin',
    monitored: true,
    monitoring: true,
    disabled: true,
  });

  assert.equal(state.state, 'adding');
  assert.equal(state.ariaLabel, 'Adding Aphex Twin');
});

test('resolveDiscoverArtistCardActionState falls back for missing artist names', () => {
  assert.equal(resolveDiscoverArtistCardActionState({ artistName: '' }).ariaLabel, 'Add this artist');
  assert.equal(resolveDiscoverArtistCardActionState({ artistName: null }).ariaLabel, 'Add this artist');
  assert.equal(resolveDiscoverArtistCardActionState().ariaLabel, 'Add this artist');
});

test('resolveDiscoverArtistCardActionState returns fixed markup-free platform labels', () => {
  const state = resolveDiscoverArtistCardActionState({
    artistName: '<img src=x onerror=alert(1)>',
  });

  assert.equal(state.visibleLabel, '+');
  assert.ok(!/[<>]/.test(state.state));
  assert.ok(!/[<>]/.test(state.buttonVariant));
});
