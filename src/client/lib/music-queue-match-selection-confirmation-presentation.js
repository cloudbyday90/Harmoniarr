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

const FALLBACK_RELEASE_TITLE = 'this release';

function getReleaseTitle(release) {
  const releaseTitle = typeof release?.releaseTitle === 'string'
    ? release.releaseTitle.trim()
    : '';

  return releaseTitle || FALLBACK_RELEASE_TITLE;
}

/**
 * Builds the explicit, non-destructive confirmation shown before an operator
 * selects a reviewed Music Queue match. The copy explains the bounded next
 * effect without claiming that a provider has accepted a transfer.
 *
 * @param {{ releaseTitle?: unknown } | null | undefined} release
 * @returns {{ cancelLabel: string, confirmLabel: string, level: string, message: string, title: string, tone: string }}
 */
export function buildMusicQueueMatchSelectionConfirmation(release) {
  const releaseTitle = getReleaseTitle(release);

  return {
    cancelLabel: 'Keep reviewing',
    confirmLabel: 'Use this match',
    level: 'none',
    message: `Harmoniarr will save this match for ${releaseTitle}. It will check the match before it can queue a download.`,
    title: `Use this match for ${releaseTitle}?`,
    tone: 'primary',
  };
}
