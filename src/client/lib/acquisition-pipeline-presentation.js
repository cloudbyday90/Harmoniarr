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
 * Legacy client compatibility entry point. New code must import the focused
 * Missing Music presentation modules directly.
 */
export {
  buildMissingMusicReleaseAction as buildMusicQueueAction,
  getMissingMusicReleaseStatusClass as getMusicQueueStatusClass,
} from './missing-music-release-action-presentation.js';
export {
  buildMissingMusicSummaryCards as buildMusicQueueSummaryCards,
  normalizeMissingMusicRelease as normalizeMusicQueueRelease,
} from './missing-music-release-normalization.js';
export {
  buildMissingMusicMatchReview as buildMusicQueueMatchReview,
} from './missing-music-release-review-presentation.js';
