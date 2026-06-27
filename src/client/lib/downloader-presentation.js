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

const disabledEmptyState = Object.freeze({
  actionLabel: 'Configure slskd',
  actionRouteName: 'settings-connections',
  body: 'Add your Soulseek download client URL and slskd API key in Settings. Once connected, downloads queued from Search or Import Review will appear here.',
  title: 'Set up Soulseek to enable downloads',
});

const idleEmptyState = Object.freeze({
  actionLabel: null,
  actionRouteName: null,
  body: 'When Harmoniarr queues a download from Search or Import Review, progress will appear here.',
  title: 'Nothing downloading right now',
});

export function isDownloaderProviderDisabled(queue) {
  return queue?.providerState?.enabled === false || queue?.queueHealth?.status === 'disabled';
}

export function buildDownloaderActivitySummary(queue) {
  if (isDownloaderProviderDisabled(queue)) {
    return queue?.providerState?.message ?? 'Configure Soulseek (slskd) to enable downloads.';
  }

  return queue?.queueHealth?.message ?? 'No active downloads right now.';
}

export function buildDownloaderEmptyState(queue) {
  return isDownloaderProviderDisabled(queue) ? disabledEmptyState : idleEmptyState;
}
