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

import { formatOperationTimestampShort } from './operation-run-presentation.js';

const LOCK_TYPE_LABELS = Object.freeze({
  backup_restore: 'Backup restore',
  maintenance: 'Maintenance',
  upgrade: 'Upgrade',
  admin_recovery: 'Admin recovery',
});

export function formatLockType(lockType) {
  return LOCK_TYPE_LABELS[lockType] ?? lockType ?? 'Unknown';
}

export function formatLockStatus(lock) {
  if (!lock) return 'Unknown';
  const now = new Date();
  const expiresAt = lock.expiresAt ? new Date(lock.expiresAt) : null;
  if (lock.status === 'released') return 'Released';
  if (expiresAt && expiresAt <= now) return 'Expired';
  return 'Active';
}

export function getLockStatusTone(lock) {
  const status = formatLockStatus(lock);
  if (status === 'Active') return 'warning';
  if (status === 'Released') return null;
  if (status === 'Expired') return null;
  return null;
}

export function formatLockExpiresAt(lock) {
  if (!lock?.expiresAt) return 'No expiry';
  return formatOperationTimestampShort(lock.expiresAt);
}

export function describeLockImpact(lockType) {
  const descriptions = {
    backup_restore: 'Pauses operation queue and filesystem heartbeats during a backup restore.',
    maintenance: 'Pauses background workers for system maintenance.',
    upgrade: 'Pauses all operations during a version upgrade.',
    admin_recovery: 'Blocks filesystem-affecting operations during admin account recovery.',
  };
  return descriptions[lockType] ?? 'Pauses system operations during the lock period.';
}

export function formatDiagnosticTimestamp(ts) {
  if (!ts) return '—';
  return formatOperationTimestampShort(ts);
}
