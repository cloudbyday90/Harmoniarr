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

function getNonNegativeCount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function buildMatchChoiceCopy({ matchChoiceCount, visibleMatchCount }) {
  if (matchChoiceCount > visibleMatchCount) {
    return `Showing ${visibleMatchCount} highest-ranked match${visibleMatchCount === 1 ? '' : 'es'} of ${matchChoiceCount} candidates. Select a match only when it fits this release and your quality policy.`;
  }

  return `Choose from ${visibleMatchCount} available match${visibleMatchCount === 1 ? '' : 'es'}. Select a match only when it fits this release and your quality policy.`;
}

function getDecisionCopy({
  hasDownloaderHandoff,
  hasManualSafeAdd,
  hasMatchChoices,
  hasQualityChoice,
  hasRouteAction,
  recovery,
}) {
  if (recovery?.nextStep) return recovery.nextStep;

  if (hasManualSafeAdd) {
    return 'Review the completed release, then add it only when you are ready for Harmoniarr to check the files again.';
  }

  if (hasMatchChoices) {
    return 'Choose a match only when Harmoniarr needs your decision. The selected match becomes the next download step.';
  }

  if (hasQualityChoice) {
    return 'Choose whether to keep looking for a better match or allow the available fallback quality for this release.';
  }

  if (hasDownloaderHandoff) {
    return 'Follow this transfer in Downloader. Release decisions remain in Music Queue.';
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
  const matchChoiceCount = Math.max(
    decisionMatchCards.length,
    getNonNegativeCount(review.matchChoiceCount),
  );
  const hasManualSafeAdd = review.canAddToLibrary === true;
  const hasQualityChoice = Boolean(review.canAllowFallbackQuality || review.canSearchAgain);
  const hasRouteAction = review.action?.type === 'route';
  const hasDownloaderHandoff = review.action?.code === 'open_downloader'
    && review.action?.routeName === 'downloader'
    && hasRouteAction;
  const recovery = review.recovery ?? null;
  const qualityRows = Array.isArray(review.qualityRows) ? review.qualityRows : [];

  return {
    decisionCopy: getDecisionCopy({
      hasDownloaderHandoff,
      hasManualSafeAdd,
      hasMatchChoices,
      hasQualityChoice,
      hasRouteAction,
      recovery,
    }),
    decisionMatchCards,
    evidenceMatchCards: hasMatchChoices ? [] : matchCards,
    hasDecision: hasManualSafeAdd || hasMatchChoices || hasQualityChoice || hasRouteAction,
    hasDownloaderHandoff,
    hasManualSafeAdd,
    hasEvidence: matchCards.length > 0 || qualityRows.length > 0 || (review.matchRows?.length ?? 0) > 0,
    hasMatchChoices,
    hasQualityChoice,
    matchChoiceCopy: hasMatchChoices
      ? buildMatchChoiceCopy({
        matchChoiceCount,
        visibleMatchCount: decisionMatchCards.length,
      })
      : '',
    matchChoiceCount,
    primaryQualityRows: qualityRows.filter((row) => PRIMARY_QUALITY_ROW_LABELS.has(row.label)),
    recovery,
  };
}
