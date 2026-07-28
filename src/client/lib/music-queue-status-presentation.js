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

const ATTENTION_KEYS = new Set(['needs-help', 'needs-setup']);
const PROGRESS_KEYS = new Set(['downloading', 'ready-to-add', 'searching']);

function getCount(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function pluralizeRelease(count) {
  return `${count} release${count === 1 ? '' : 's'}`;
}

function getCardCount(cards, matchingKeys) {
  return cards.reduce((total, card) => (
    matchingKeys.has(card?.key) ? total + getCount(card.value) : total
  ), 0);
}

/**
 * Builds the one-line queue context used by the normal Music Queue workflow.
 * Scheduled searches stay available but deliberately remain secondary to work
 * that is progressing now or requires a decision.
 *
 * @param {Array<{key: string, value: number}>} cards
 * @returns {{primaryDetail: string, primaryHeadline: string, scheduledSearchCount: number, scheduledSearchDetail: string, state: string}}
 */
export function buildMusicQueueStatusPresentation(cards = []) {
  const normalizedCards = Array.isArray(cards) ? cards : [];
  const attentionCount = getCardCount(normalizedCards, ATTENTION_KEYS);
  const progressCount = getCardCount(normalizedCards, PROGRESS_KEYS);
  const waitingCard = normalizedCards.find((card) => card?.key === 'waiting');
  const scheduledSearchCount = getCount(waitingCard?.value);
  const scheduledSearchDetail = scheduledSearchCount > 0
    ? `${pluralizeRelease(scheduledSearchCount)} ${scheduledSearchCount === 1 ? 'is' : 'are'} scheduled for automatic search.`
    : '';

  if (attentionCount > 0) {
    return {
      primaryDetail: progressCount > 0
        ? `Harmoniarr is also working on ${pluralizeRelease(progressCount)}.`
        : 'Review each release to help Harmoniarr continue.',
      primaryHeadline: `${pluralizeRelease(attentionCount)} need${attentionCount === 1 ? 's' : ''} attention`,
      scheduledSearchCount,
      scheduledSearchDetail,
      state: 'attention',
    };
  }

  if (progressCount > 0) {
    return {
      primaryDetail: 'Downloads, checks, and library adds continue automatically.',
      primaryHeadline: `Harmoniarr is working on ${pluralizeRelease(progressCount)}`,
      scheduledSearchCount,
      scheduledSearchDetail,
      state: 'progress',
    };
  }

  if (scheduledSearchCount > 0) {
    return {
      primaryDetail: 'No action is needed. Harmoniarr will search automatically when each release is due.',
      primaryHeadline: 'No releases are moving or need help right now.',
      scheduledSearchCount,
      scheduledSearchDetail,
      state: 'scheduled',
    };
  }

  return {
    primaryDetail: '',
    primaryHeadline: 'No releases are moving or need help right now.',
    scheduledSearchCount: 0,
    scheduledSearchDetail: '',
    state: 'idle',
  };
}
