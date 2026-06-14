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

function normalizeArtistName(value) {
  if (typeof value !== 'string') {
    return 'this artist';
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : 'this artist';
}

/**
 * Resolve DiscoverArtistCard's add-action presentation state.
 *
 * Keeps visible copy, accessible names, disabled state, and busy state in one
 * pure boundary so the Vue component can stay declarative.
 *
 * @param {object} input
 * @param {string|null|undefined} input.artistName
 * @param {boolean} input.monitored
 * @param {boolean} input.monitoring
 * @param {boolean} input.disabled
 * @returns {{
 *   state: 'addable'|'adding'|'monitored'|'unavailable',
 *   visibleLabel: string,
 *   ariaLabel: string,
 *   buttonVariant: 'primary'|'ghost',
 *   buttonDisabled: boolean,
 *   iconOnly: boolean,
 *   ariaBusy: 'true'|undefined,
 * }}
 */
export function resolveDiscoverArtistCardActionState({
  artistName,
  monitored = false,
  monitoring = false,
  disabled = false,
} = {}) {
  const name = normalizeArtistName(artistName);

  if (monitoring) {
    return {
      state: 'adding',
      visibleLabel: 'Adding...',
      ariaLabel: `Adding ${name}`,
      buttonVariant: 'primary',
      buttonDisabled: true,
      iconOnly: false,
      ariaBusy: 'true',
    };
  }

  if (monitored) {
    return {
      state: 'monitored',
      visibleLabel: 'Already monitored',
      ariaLabel: `Already monitored: ${name}`,
      buttonVariant: 'ghost',
      buttonDisabled: true,
      iconOnly: false,
      ariaBusy: undefined,
    };
  }

  if (disabled) {
    return {
      state: 'unavailable',
      visibleLabel: 'Unavailable',
      ariaLabel: `Add unavailable for ${name}`,
      buttonVariant: 'ghost',
      buttonDisabled: true,
      iconOnly: false,
      ariaBusy: undefined,
    };
  }

  return {
    state: 'addable',
    visibleLabel: '+',
    ariaLabel: `Add ${name}`,
    buttonVariant: 'primary',
    buttonDisabled: false,
    iconOnly: true,
    ariaBusy: undefined,
  };
}
