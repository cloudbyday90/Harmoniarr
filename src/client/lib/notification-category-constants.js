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

export const NOTIFICATION_CATEGORIES = [
  { key: 'requestFulfilled', label: 'Request fulfilled', description: 'When your requested music is ready to download', adminOnly: false },
  { key: 'downloadCompleted', label: 'Download completed', description: 'When a download finishes', adminOnly: false },
  { key: 'releaseAdded', label: 'Release added', description: 'When a new release is added to the library', adminOnly: false },
  { key: 'artistMonitored', label: 'Artist monitored', description: 'When an artist is added to monitoring', adminOnly: false },
  { key: 'requestCreated', label: 'Request created', description: 'When a new music request is submitted', adminOnly: false },
  { key: 'trustOverride', label: 'Trust override', description: 'When a source user trust level is changed', adminOnly: true },
  { key: 'blocklistEvent', label: 'Blocklist change', description: 'When a source user is blocked or unblocked', adminOnly: true },
];
