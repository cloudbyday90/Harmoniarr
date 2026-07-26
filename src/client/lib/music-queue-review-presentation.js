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

const PRIMARY_QUALITY_ROW_LABELS = new Set(['Profile', 'Decision', 'Verification']);

function getDecisionCopy({ hasMatchChoices, hasQualityChoice, hasRouteAction }) {
  if (hasMatchChoices) {
    return 'Choose a match only when Harmoniarr needs your decision. The selected match becomes the next download step.';
  }

  if (hasQualityChoice) {
    return 'Choose whether to keep looking for a better match or allow the available fallback quality for this release.';
  }

  if (hasRouteAction) {
    return 'Continue this release from the linked area.';
  }

  return 'Harmoniarr will continue automatically when the next check is due.';
}

export function buildMusicQueueReviewPresentation(review) {
  if (!review) return null;

  const matchCards = Array.isArray(review.matchCards) ? review.matchCards : [];
  const decisionMatchCards = matchCards.filter((match) => match.canUseMatch || match.canRejectMatch);
  const hasMatchChoices = decisionMatchCards.length > 0;
  const hasQualityChoice = Boolean(review.canAllowFallbackQuality || review.canSearchAgain);
  const hasRouteAction = review.action?.type === 'route';
  const qualityRows = Array.isArray(review.qualityRows) ? review.qualityRows : [];

  return {
    decisionCopy: getDecisionCopy({ hasMatchChoices, hasQualityChoice, hasRouteAction }),
    decisionMatchCards,
    evidenceMatchCards: hasMatchChoices ? [] : matchCards,
    hasDecision: hasMatchChoices || hasQualityChoice || hasRouteAction,
    hasEvidence: matchCards.length > 0 || qualityRows.length > 0 || (review.matchRows?.length ?? 0) > 0,
    hasMatchChoices,
    hasQualityChoice,
    primaryQualityRows: qualityRows.filter((row) => PRIMARY_QUALITY_ROW_LABELS.has(row.label)),
  };
}
