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

function formatCount(value) {
  return String(Number.isFinite(Number(value)) ? Number(value) : 0);
}

function getStageTone(status) {
  switch (status) {
    case 'blocked':
    case 'failed':
    case 'error':
      return 'danger';
    case 'ready_with_warnings':
    case 'warning':
      return 'warning';
    case 'running':
    case 'active':
      return 'info';
    case 'ready':
    case 'completed':
    case 'success':
      return 'success';
    default:
      return 'neutral';
  }
}

function getSummaryMessage(summary, fallbackMessage) {
  return summary?.message || fallbackMessage;
}

function buildStageMetric(label, value) {
  return {
    label,
    value: formatCount(value),
  };
}

export function buildImportReviewOverviewCards({
  activeFilterCount = 0,
  importPendingCounts = {},
  isAdmin = true,
  pagination = {},
  selectedCounts = {},
  statusFilter = 'pending',
} = {}) {
  const cards = [
    {
      id: 'visible',
      label: 'Visible matches',
      value: formatCount(pagination.total),
      detail: activeFilterCount > 0
        ? `${formatCount(activeFilterCount)} active filter${Number(activeFilterCount) === 1 ? '' : 's'} shaping the queue.`
        : `Showing the default ${statusFilter || 'all'} review slice.`,
      tone: 'neutral',
    },
    {
      id: 'selected',
      label: 'Selected for download',
      value: formatCount(selectedCounts.totalSelected),
      detail: `${formatCount(selectedCounts.ready)} ready, ${formatCount(selectedCounts.readyWithWarnings)} with warnings, ${formatCount(selectedCounts.blocked)} blocked.`,
      tone: selectedCounts.blocked > 0
        ? 'danger'
        : (selectedCounts.readyWithWarnings > 0 ? 'warning' : 'success'),
    },
  ];

  if (isAdmin) {
    cards.push({
      id: 'import-pending',
      label: 'Awaiting import',
      value: formatCount(importPendingCounts.totalImportPending),
      detail: `${formatCount(importPendingCounts.ready)} ready, ${formatCount(importPendingCounts.readyWithWarnings)} with warnings, ${formatCount(importPendingCounts.blocked)} blocked.`,
      tone: importPendingCounts.blocked > 0
        ? 'danger'
        : (importPendingCounts.readyWithWarnings > 0 ? 'warning' : 'success'),
    });
  }

  return cards;
}

export function buildImportReviewWorkflowStages({
  applyCurrentRun = null,
  applySummary = null,
  importPendingCounts = {},
  selectedCounts = {},
  executionCurrentRun = null,
  executionSummary = null,
  mediaInspectionCurrentRun = null,
  mediaInspectionSummary = null,
} = {}) {
  return [
    {
      id: 'selection',
      eyebrow: 'Stage 1',
      title: 'Curate candidates',
      body: getSummaryMessage(
        null,
        selectedCounts.totalSelected > 0
          ? `${formatCount(selectedCounts.totalSelected)} candidate${Number(selectedCounts.totalSelected) === 1 ? '' : 's'} are selected for download planning.`
          : 'Review matches, document exceptions, and select the candidates you want to move forward.',
      ),
      metric: buildStageMetric('Selected', selectedCounts.totalSelected),
      tone: selectedCounts.blocked > 0
        ? 'danger'
        : (selectedCounts.readyWithWarnings > 0 ? 'warning' : 'success'),
      targetId: 'import-review-selection-stage',
    },
    {
      id: 'inspection',
      eyebrow: 'Stage 2',
      title: 'Inspect media',
      body: getSummaryMessage(
        mediaInspectionSummary,
        'Run media inspection before download and import decisions continue.',
      ),
      metric: buildStageMetric(
        mediaInspectionCurrentRun?.status === 'running' ? 'In run' : 'Warnings',
        mediaInspectionCurrentRun?.warningCount ?? 0,
      ),
      tone: getStageTone(mediaInspectionCurrentRun?.status || mediaInspectionSummary?.status),
      targetId: 'import-media-inspection-run-panel',
    },
    {
      id: 'download',
      eyebrow: 'Stage 3',
      title: 'Queue downloads',
      body: getSummaryMessage(
        executionSummary,
        'Queue selected candidates and reconcile transfer state from slskd as the run progresses.',
      ),
      metric: buildStageMetric(
        executionCurrentRun?.status === 'running' ? 'Queued' : 'Ready',
        executionCurrentRun?.queuedCount ?? selectedCounts.ready,
      ),
      tone: getStageTone(executionCurrentRun?.status || executionSummary?.status),
      targetId: 'import-execution-run-panel',
    },
    {
      id: 'apply',
      eyebrow: 'Stage 4',
      title: 'Apply to library',
      body: getSummaryMessage(
        applySummary,
        'Move completed downloads into the library only after staging and collision checks are complete.',
      ),
      metric: buildStageMetric(
        applyCurrentRun?.status === 'running' ? 'Applied' : 'Pending',
        applyCurrentRun?.appliedCount ?? importPendingCounts.totalImportPending,
      ),
      tone: getStageTone(applyCurrentRun?.status || applySummary?.status),
      targetId: 'import-apply-run-panel',
    },
  ];
}
