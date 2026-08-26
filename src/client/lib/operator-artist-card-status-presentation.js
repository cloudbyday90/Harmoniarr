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

function normalizeReconciliationStatus(reconciliation = {}) {
  return typeof reconciliation?.status === 'string'
    ? reconciliation.status.toLowerCase()
    : '';
}

/**
 * Returns the compact status that belongs on a monitored artist's Home card.
 * Completed and idle background work deliberately return null: the card's
 * coverage already communicates the useful outcome.
 *
 * @param {{ status?: string }|null|undefined} reconciliation
 * @returns {{ label: string, tone: 'warning'|'danger' }|null}
 */
export function buildOperatorArtistCardStatusPresentation(reconciliation = {}) {
  switch (normalizeReconciliationStatus(reconciliation)) {
    case 'running':
    case 'queued':
    case 'pending':
      return {
        label: 'Updating release plan',
        tone: 'warning',
      };
    case 'failed':
      return {
        label: 'Release plan update needs attention',
        tone: 'danger',
      };
    case 'cancelled':
      return {
        label: 'Release plan update stopped',
        tone: 'warning',
      };
    default:
      return null;
  }
}
