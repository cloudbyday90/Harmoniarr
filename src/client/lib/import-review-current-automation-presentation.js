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

function normalizedCount(value) {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function formatCount(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function buildCurrentAutomationPresentation({
  importPendingCounts = {},
  isLoadingImportPending = false,
  isLoadingSelected = false,
  selectedCounts = {},
} = {}) {
  const selected = normalizedCount(selectedCounts.totalSelected);
  const importPending = normalizedCount(importPendingCounts.totalImportPending);
  const blocked = normalizedCount(selectedCounts.blocked) + normalizedCount(importPendingCounts.blocked);
  const parts = [];

  if (selected) {
    parts.push(`${formatCount(selected, 'match')} selected`);
  }

  if (importPending) {
    parts.push(`${formatCount(importPending, 'download')} waiting to add`);
  }

  if (blocked) {
    parts.push(`${formatCount(blocked, 'item')} blocked`);
  }

  if (parts.length) {
    return {
      hasWork: true,
      summary: parts.join(' · '),
    };
  }

  if (isLoadingSelected || isLoadingImportPending) {
    return {
      hasWork: false,
      summary: 'Checking current progress',
    };
  }

  return {
    hasWork: false,
    summary: 'Nothing waiting to download or add',
  };
}

export function shouldOpenCurrentAutomationForRoute(routeState = {}) {
  const candidateId = typeof routeState.candidateId === 'string'
    ? routeState.candidateId.trim()
    : '';

  if (candidateId) {
    return false;
  }

  return routeState.status === 'selected' || routeState.status === 'import_pending';
}
