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

const downloaderTransferQueryKeys = Object.freeze([
  'open',
  'transferId',
  'username',
]);

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function buildDownloaderTransferKey({ id, username } = {}) {
  const normalizedId = normalizeString(id);
  const normalizedUsername = normalizeString(username);

  return normalizedId && normalizedUsername
    ? `${normalizedUsername}::${normalizedId}`
    : '';
}

export function buildDownloaderTransferLocation(transfer) {
  const id = normalizeString(transfer?.id);
  const username = normalizeString(transfer?.username ?? transfer?.sourceUser);

  if (!id || !username) {
    return null;
  }

  return {
    name: 'acquisition-downloader',
    query: {
      open: 'details',
      transferId: id,
      username,
    },
  };
}

export function normalizeDownloaderTransferRouteQuery(query = {}) {
  const id = normalizeString(query.transferId ?? query.id);
  const username = normalizeString(query.username ?? query.sourceUser);
  const open = normalizeString(query.open);

  return {
    id,
    open,
    transferKey: buildDownloaderTransferKey({ id, username }),
    username,
  };
}

export function omitDownloaderTransferRouteQuery(query = {}) {
  return Object.fromEntries(
    Object.entries(query).filter(([key]) => !downloaderTransferQueryKeys.includes(key)),
  );
}
