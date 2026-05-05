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

export const recoverySectionNavigationItems = Object.freeze([
  {
    id: 'backups',
    label: 'Backups',
    description: 'Create, inspect, and download recovery exports.',
  },
  {
    id: 'restore',
    label: 'Restore checks',
    description: 'Confirm a selected backup is safe before you apply it.',
  },
  {
    id: 'safety-holds',
    label: 'Safety holds',
    description: 'Pause risky background work during restore or manual maintenance.',
  },
  {
    id: 'diagnostics',
    label: 'Diagnostics',
    description: 'Review recent recovery-related failures, queue pressure, and audit history.',
  },
]);

export const recoveryHoldTypeOptions = Object.freeze([
  {
    value: 'maintenance',
    label: 'Safety hold',
    description: 'Pause risky background work while you do manual maintenance.',
  },
  {
    value: 'restore',
    label: 'Restore hold',
    description: 'Block conflicting activity while you preview or apply a restore.',
  },
  {
    value: 'upgrade',
    label: 'Upgrade hold',
    description: 'Pause background work while you validate or complete an upgrade.',
  },
  {
    value: 'admin_recovery',
    label: 'Admin recovery hold',
    description: 'Reserve the system for bootstrap-admin recovery changes.',
  },
]);

export const defaultRecoverySectionId = recoverySectionNavigationItems[0].id;

const recoverySectionIds = new Set(recoverySectionNavigationItems.map((item) => item.id));
const recoveryHoldTypes = new Map(recoveryHoldTypeOptions.map((item) => [item.value, item]));

function formatFallbackLabel(value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return 'Unknown';
  }

  return value
    .trim()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function isRecoverySectionId(value) {
  return recoverySectionIds.has(value);
}

export function normalizeRecoverySectionId(value) {
  const normalizedValue = typeof value === 'string'
    ? value.trim().replace(/^#/, '')
    : '';

  return isRecoverySectionId(normalizedValue) ? normalizedValue : defaultRecoverySectionId;
}

export function buildRecoverySectionHash(value) {
  return `#${normalizeRecoverySectionId(value)}`;
}

export function getRecoveryHoldLabel(value) {
  return recoveryHoldTypes.get(value)?.label ?? formatFallbackLabel(value);
}

export function getRecoveryHoldDescription(value) {
  return recoveryHoldTypes.get(value)?.description
    ?? 'Pause risky background work until you release the hold.';
}