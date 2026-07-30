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

function normalizeQualityRows(rows) {
  return Array.isArray(rows) ? rows.filter((row) => row?.label && row?.value) : [];
}

function buildDecisionFacts(match) {
  return [
    {
      label: 'Quality',
      tone: match.qualityFitTone,
      value: match.qualityFitLabel,
    },
    { label: 'Format', value: match.formatLabel },
    { label: 'Tracks', value: match.trackCoverageLabel },
  ];
}

function buildEvidenceFacts(match) {
  return [
    { label: 'Score', value: match.scoreLabel },
    { label: 'Files', value: match.fileLabel },
    { label: 'Size', value: match.sizeLabel },
    { label: 'Source health', value: match.healthLabel },
  ];
}

export function buildMusicQueueMatchCardPresentation(match, { isDecision = false } = {}) {
  const decisionFacts = buildDecisionFacts(match ?? {});
  const evidenceFacts = buildEvidenceFacts(match ?? {});
  const qualityRows = normalizeQualityRows(match?.qualityRows);

  return {
    detailFacts: isDecision ? evidenceFacts : [],
    detailQualityRows: isDecision ? qualityRows : [],
    hasDetails: isDecision && (evidenceFacts.length > 0 || qualityRows.length > 0),
    qualityRows: isDecision ? [] : qualityRows,
    visibleFacts: isDecision ? decisionFacts : [...decisionFacts, ...evidenceFacts],
  };
}
