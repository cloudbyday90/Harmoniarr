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

export function formatPlexOwnerLinkLabel(ownerLink) {
  return ownerLink?.linked ? 'Linked' : 'Not linked';
}

export function formatPlexOwnerLinkTone(ownerLink) {
  return ownerLink?.linked ? 'success' : 'warning';
}

export function formatPlexPreviewStateLabel(previewStatus) {
  switch (previewStatus?.state) {
    case 'ready':
      return 'Preview ready';
    case 'error':
      return 'Preview unavailable';
    default:
      return 'Owner link required';
  }
}

export function formatPlexPreviewStateTone(previewStatus) {
  switch (previewStatus?.state) {
    case 'ready':
      return 'success';
    case 'error':
      return 'danger';
    default:
      return 'warning';
  }
}

export function formatPlexRepairStateLabel(repairState) {
  switch (repairState) {
    case 'healthy':
      return 'Healthy';
    case 'local_auth_required':
      return 'Local auth required';
    case 'profile_sync_missing':
      return 'Profile sync missing';
    case 'provider_mismatch':
      return 'Provider mismatch';
    case 'remote_profile_missing':
      return 'Remote profile missing';
    case 'preview_unavailable':
      return 'Preview unavailable';
    default:
      return 'Needs review';
  }
}

export function formatPlexRepairStateTone(repairState) {
  switch (repairState) {
    case 'healthy':
      return 'success';
    case 'preview_unavailable':
      return 'warning';
    case 'local_auth_required':
    case 'provider_mismatch':
    case 'profile_sync_missing':
    case 'remote_profile_missing':
      return 'danger';
    default:
      return 'warning';
  }
}

export function formatPlexLinkedAccountsCountLabel(count, noun) {
  if (!Number.isFinite(count)) {
    return `0 ${noun}`;
  }

  return `${count} ${noun}`;
}

export function hasPlexRepairQueue(overview) {
  return (overview?.summary?.repairRequiredUsers ?? 0) > 0
    || (overview?.summary?.conflictProfiles ?? 0) > 0;
}
