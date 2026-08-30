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

import { createArtistDetailPresentationEvidence } from './artist-detail-local-presentation-evidence.js';

export const defaultArtistDetailPresentationWaitMs = 2_000;

function assertTimeout(value) {
  if (!Number.isSafeInteger(value) || value < 1 || value > 30_000) {
    throw new Error('Artist Detail presentation wait must be a bounded positive integer');
  }
}

async function readNavigationRelativeTime(page) {
  return page.evaluate(() => performance.now());
}

async function createPresentationObservation(page, state) {
  return createArtistDetailPresentationEvidence({
    observedAtMs: await readNavigationRelativeTime(page),
    state,
  });
}

/**
 * Observes the already-accessible Artist Detail loading boundary without
 * reading DOM text or user data. It deliberately treats the observation time
 * as an upper bound: it is when automation saw the final state, not an exact
 * claim about the instant Vue committed a render.
 *
 * @param {{ page: import('playwright').Page, timeoutMs?: number }} input
 */
export async function observeArtistDetailPresentation({
  page,
  timeoutMs = defaultArtistDetailPresentationWaitMs,
} = {}) {
  assertTimeout(timeoutMs);

  const discographyArticle = page.getByRole('article', {
    exact: true,
    name: 'Discography',
  });

  try {
    await discographyArticle.waitFor({ state: 'visible', timeout: timeoutMs });
  } catch {
    return createPresentationObservation(page, 'unavailable');
  }

  const busyRegion = discographyArticle.locator('[aria-busy="true"]');
  try {
    await busyRegion.waitFor({ state: 'detached', timeout: timeoutMs });
  } catch {
    return createPresentationObservation(page, 'still_loading');
  }

  return createPresentationObservation(page, 'ready');
}
