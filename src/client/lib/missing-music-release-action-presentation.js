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

/**
 * Converts a server-derived next action into the stable client presentation
 * used by Missing Music. This helper intentionally does not authorize,
 * trigger, or infer an action.
 */
export function buildMissingMusicReleaseAction(status, recovery = null) {
  if (recovery?.kind === 'automatic') {
    return { code: 'view_recovery', label: 'View recovery', type: 'review' };
  }

  if (recovery?.kind === 'action_required') {
    return { code: 'review_recovery', label: 'Review recovery', type: 'review' };
  }

  switch (status?.nextAction) {
    case 'add_to_library':
      return { code: 'add_to_library', label: 'View details', type: 'review' };
    case 'configure_provider':
      return { code: 'configure_provider', label: 'Test Soulseek', type: 'route', routeName: 'settings-connections' };
    case 'download_now':
      return { code: 'download_now', label: 'Review match', type: 'review' };
    case 'open_downloader':
      return { code: 'open_downloader', label: 'View download progress', type: 'route', routeName: 'downloader' };
    case 'open_in_library':
      return { code: 'open_in_library', label: 'Open Library', type: 'route', routeName: 'library' };
    case 'recheck_library_add':
      return { code: 'recheck_library_add', label: status?.repair?.actionLabel ?? 'Try audio check again', type: 'review' };
    case 'review_add_plan':
      return {
        code: 'review_add_plan',
        label: status?.repair?.actionLabel ?? 'Review add plan',
        type: 'review',
      };
    case 'review_matches':
      return { code: 'review_matches', label: 'Review matches', type: 'review' };
    case 'review_quality_choice':
      return {
        code: 'review_quality_choice',
        label: status?.repair?.actionLabel ?? 'Review quality choice',
        type: 'review',
      };
    case 'search_now':
      return { code: 'search_now', label: 'View details', type: 'review' };
    case 'set_up_folders':
      return { code: 'set_up_folders', label: 'Set up folders', type: 'route', routeName: 'settings-media-storage' };
    case 'show_advanced_diagnostics':
      return { code: 'show_advanced_diagnostics', label: 'Set up media tools', type: 'route', routeName: 'settings-media-storage' };
    case 'try_again':
      return { code: 'try_again', label: 'Review retry', type: 'review' };
    case 'view_recovery':
      return { code: 'view_recovery', label: 'View recovery', type: 'review' };
    default:
      return { code: 'show_details', label: 'View details', type: 'review' };
  }
}

export function getMissingMusicReleaseStatusClass(status) {
  const tone = status?.tone ?? 'neutral';
  if (tone === 'success') return 'review-status-held';
  if (tone === 'danger') return 'review-status-failed';
  if (tone === 'warning') return 'review-status-held';
  if (tone === 'info') return 'review-status-pending';
  return 'review-status-held';
}
