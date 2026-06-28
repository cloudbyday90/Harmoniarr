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

export function formatQualityProfileLabel(profileCode) {
  switch (profileCode) {
    case 'any_available':
      return 'Any available';
    case 'high_quality':
      return 'High quality';
    case 'lossless_archive':
      return 'Lossless archive';
    default:
      return 'Lossless archive';
  }
}

export function formatQualityDecisionLabel(decisionCode) {
  switch (decisionCode) {
    case 'accepted':
      return 'Quality accepted';
    case 'below_minimum':
      return 'Below preference';
    case 'needs_verification':
      return 'Needs verification';
    case 'no_evidence':
      return 'No quality evidence';
    default:
      return 'Quality unknown';
  }
}
