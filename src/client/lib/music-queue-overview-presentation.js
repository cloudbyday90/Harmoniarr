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

function toOverviewFact(card) {
  const value = getCount(card?.value);
  return {
    key: card?.key ?? 'unknown',
    label: card?.label ?? 'Unknown',
    tone: ATTENTION_KEYS.has(card?.key) ? 'warning' : 'neutral',
    value,
  };
}

/**
 * Condenses Music Queue status counts into the progress information a user
 * needs before opening the release list. Inactive zero-value categories remain
 * available to filters and diagnostics but do not compete with active work.
 *
 * @param {Array<{key: string, label: string, value: number}>} cards
 * @returns {{ detail: string, facts: Array<{key: string, label: string, tone: string, value: number}>, headline: string, isVisible: boolean }}
 */
export function buildMusicQueueOverviewPresentation(cards = []) {
  const normalizedCards = Array.isArray(cards) ? cards.map(toOverviewFact) : [];
  const attentionFacts = normalizedCards.filter((card) => ATTENTION_KEYS.has(card.key) && card.value > 0);
  const progressFacts = normalizedCards.filter((card) => PROGRESS_KEYS.has(card.key) && card.value > 0);
  const waitingFact = normalizedCards.find((card) => card.key === 'waiting') ?? null;
  const waitingCount = waitingFact?.value ?? 0;
  const attentionCount = attentionFacts.reduce((total, card) => total + card.value, 0);
  const progressCount = progressFacts.reduce((total, card) => total + card.value, 0);
  const facts = [...attentionFacts, ...progressFacts];

  if (attentionCount > 0) {
    return {
      detail: 'Harmoniarr needs your help before it can continue with these releases.',
      facts,
      headline: `${pluralizeRelease(attentionCount)} need${attentionCount === 1 ? 's' : ''} attention`,
      isVisible: true,
    };
  }

  if (progressCount > 0) {
    return {
      detail: waitingCount > 0
        ? `${pluralizeRelease(waitingCount)} ${waitingCount === 1 ? 'is' : 'are'} waiting to search.`
        : 'Harmoniarr is continuing automatically.',
      facts,
      headline: `Harmoniarr is working on ${pluralizeRelease(progressCount)}`,
      isVisible: true,
    };
  }

  if (waitingCount > 0) {
    return {
      detail: 'Harmoniarr will search automatically when each release is due.',
      facts: [waitingFact],
      headline: `${pluralizeRelease(waitingCount)} waiting to search`,
      isVisible: true,
    };
  }

  return {
    detail: '',
    facts: [],
    headline: '',
    isVisible: false,
  };
}
