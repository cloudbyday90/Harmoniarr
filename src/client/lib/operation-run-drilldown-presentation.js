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

const DRILLDOWN_SUMMARY_KEYS = Object.freeze({
  library_discovery_dispatch: ['dispatchedSearches', 'failures'],
  library_organize_apply: ['fileResults'],
  library_scan: ['phases'],
});

function toNumberOrZero(value) {
  return Number.isFinite(value) ? value : 0;
}

function getFilename(pathValue, fallback = 'Unknown file') {
  if (typeof pathValue !== 'string' || pathValue.length === 0) {
    return fallback;
  }

  const parts = pathValue.split(/[/\\]/).filter(Boolean);
  return parts.at(-1) ?? fallback;
}

function formatBytes(value) {
  if (!Number.isFinite(value) || value < 1) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const precision = size >= 100 || unitIndex === 0 ? 0 : size >= 10 ? 1 : 2;
  return `${size.toFixed(precision)} ${units[unitIndex]}`;
}

function formatStatusLabel(status) {
  switch (status) {
    case 'applied':
    case 'moved':
      return 'Applied';
    case 'failed':
      return 'Failed';
    case 'not_attempted':
      return 'Not attempted';
    case 'skipped':
      return 'Skipped';
    default:
      return status ?? 'Unknown';
  }
}

function formatStatusTone(status) {
  switch (status) {
    case 'applied':
    case 'moved':
      return 'success';
    case 'failed':
      return 'danger';
    case 'skipped':
      return 'warning';
    case 'not_attempted':
      return 'info';
    default:
      return null;
  }
}

function formatOutcomeTone(outcome) {
  switch (outcome) {
    case 'completed':
      return 'success';
    case 'failed':
      return 'danger';
    case 'partial':
      return 'warning';
    default:
      return 'info';
  }
}

function formatOutcomeLabel(outcome) {
  switch (outcome) {
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    case 'partial':
      return 'Partial';
    case 'empty':
      return 'No work';
    default:
      return outcome ?? 'Unknown';
  }
}

function formatPhaseName(name) {
  return String(name ?? '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function buildMetric(label, value, meta, tone = null) {
  return { label, meta, tone, value };
}

function buildOrganizeDrilldown(summary) {
  const fileResults = Array.isArray(summary?.fileResults) ? summary.fileResults : [];

  return {
    metrics: [
      buildMetric('Outcome', formatOutcomeLabel(summary?.outcome), 'Overall organize result', formatOutcomeTone(summary?.outcome)),
      buildMetric('Files moved', toNumberOrZero(summary?.movedCount), 'Successful canonical renames'),
      buildMetric('Failed', toNumberOrZero(summary?.failedCount), 'Files that stopped the run', toNumberOrZero(summary?.failedCount) > 0 ? 'danger' : null),
      buildMetric('Not attempted', toNumberOrZero(summary?.notAttemptedCount), 'Remaining files skipped after failure'),
      buildMetric('Skipped', toNumberOrZero(summary?.skippedCount), 'Files left untouched'),
    ],
    tables: fileResults.length > 0
      ? [{
        columns: [
          { key: 'file', label: 'File' },
          { key: 'status', label: 'Status' },
          { key: 'transport', label: 'Transport' },
          { key: 'sourcePath', label: 'Source path' },
          { key: 'destinationPath', label: 'Destination path' },
          { key: 'note', label: 'Note' },
        ],
        description: 'Recorded file-level rename outcomes for this organize run.',
        key: 'organize-file-results',
        rows: fileResults.map((result, index) => ({
          destinationPath: result?.destinationPath ?? '—',
          file: result?.filename ?? getFilename(result?.destinationPath ?? result?.sourcePath),
          id: result?.fileId ?? result?.destinationPath ?? result?.sourcePath ?? `result-${index}`,
          note: result?.errorMessage ?? 'Completed without additional notes.',
          sourcePath: result?.sourcePath ?? '—',
          status: formatStatusLabel(result?.status),
          statusTone: formatStatusTone(result?.status),
          transport: result?.transport ?? '—',
        })),
        title: 'File results',
      }]
      : [],
    title: 'Organize detail',
  };
}

function buildScanDrilldown(summary) {
  const phases = Array.isArray(summary?.phases) ? summary.phases : [];

  return {
    metrics: [
      buildMetric('Files seen', toNumberOrZero(summary?.filesSeen), 'All files visited during the walk'),
      buildMetric('Audio matched', toNumberOrZero(summary?.filesMatched), 'Files classified as audio'),
      buildMetric('Other files', toNumberOrZero(summary?.filesUnmatched), 'Files outside the audio policy'),
      buildMetric('Directories', toNumberOrZero(summary?.directoriesSeen), 'Directories traversed during scan'),
      buildMetric('Bytes seen', formatBytes(summary?.totalBytes), 'Raw bytes observed during the walk'),
      buildMetric('Symlinks skipped', toNumberOrZero(summary?.skippedSymlinks), 'Symbolic links intentionally ignored'),
    ],
    tables: phases.length > 0
      ? [{
        columns: [
          { key: 'phase', label: 'Phase' },
          { key: 'startedAt', label: 'Started' },
          { key: 'finishedAt', label: 'Finished' },
          { key: 'state', label: 'State' },
        ],
        description: 'Phase timing captured while the scan walked, cataloged, and reconciled the library.',
        key: 'scan-phases',
        rows: phases.map((phase, index) => ({
          finishedAt: phase?.finishedAt ?? '—',
          id: `${phase?.name ?? 'phase'}-${index}`,
          phase: formatPhaseName(phase?.name),
          startedAt: phase?.startedAt ?? '—',
          state: phase?.finishedAt ? 'Completed' : 'Recorded',
          stateTone: phase?.finishedAt ? 'success' : 'info',
        })),
        title: 'Phase timing',
      }]
      : [],
    title: 'Scan detail',
  };
}

function buildDiscoveryDrilldown(summary) {
  const dispatchedSearches = Array.isArray(summary?.dispatchedSearches) ? summary.dispatchedSearches : [];
  const failures = Array.isArray(summary?.failures) ? summary.failures : [];

  return {
    metrics: [
      buildMetric('Outcome', formatOutcomeLabel(summary?.outcome), 'Overall discovery dispatch result', formatOutcomeTone(summary?.outcome)),
      buildMetric('Attempted', toNumberOrZero(summary?.attemptedCount), 'Discovery requests claimed for this run'),
      buildMetric('Dispatched', toNumberOrZero(summary?.dispatchedCount), 'Searches started in slskd'),
      buildMetric('Candidates found', toNumberOrZero(summary?.candidateCount), 'Import candidates ingested from results'),
      buildMetric('Files found', toNumberOrZero(summary?.fileCount), 'Remote files represented by candidates'),
      buildMetric('Failures', toNumberOrZero(summary?.failedCount), 'Requests that failed before dispatch or ingestion'),
    ],
    tables: [
      ...(dispatchedSearches.length > 0
        ? [{
          columns: [
            { key: 'metadataReleaseId', label: 'Release' },
            { key: 'query', label: 'Search query' },
            { key: 'searchId', label: 'Search ID' },
            { key: 'candidateCount', label: 'Candidates' },
            { key: 'fileCount', label: 'Files' },
          ],
          description: 'Remote discovery searches successfully handed to slskd during this run.',
          key: 'discovery-dispatched-searches',
          rows: dispatchedSearches.map((search, index) => ({
            candidateCount: toNumberOrZero(search?.candidateCount),
            fileCount: toNumberOrZero(search?.fileCount),
            id: search?.searchId ?? search?.metadataReleaseId ?? `dispatch-${index}`,
            metadataReleaseId: search?.metadataReleaseId ?? '—',
            query: search?.query ?? '—',
            searchId: search?.searchId ?? '—',
          })),
          title: 'Dispatched searches',
        }]
        : []),
      ...(failures.length > 0
        ? [{
          columns: [
            { key: 'metadataReleaseId', label: 'Release' },
            { key: 'code', label: 'Failure code' },
            { key: 'message', label: 'Message' },
          ],
          description: 'Discovery requests that could not be dispatched or ingested cleanly.',
          key: 'discovery-failures',
          rows: failures.map((failure, index) => ({
            code: failure?.code ?? 'unknown_failure',
            id: `${failure?.metadataReleaseId ?? 'failure'}-${index}`,
            message: failure?.message ?? 'No failure detail recorded.',
            metadataReleaseId: failure?.metadataReleaseId ?? '—',
          })),
          title: 'Dispatch failures',
        }]
        : []),
    ],
    title: 'Discovery detail',
  };
}

export function getOperationRunDrilldownSummaryKeys(run) {
  return DRILLDOWN_SUMMARY_KEYS[run?.operationType] ?? [];
}

export function buildOperationRunDrilldown(run) {
  const summary = run?.summary ?? null;
  if (!summary || typeof summary !== 'object') {
    return null;
  }

  switch (run?.operationType) {
    case 'library_organize_apply':
      return buildOrganizeDrilldown(summary);
    case 'library_scan':
      return buildScanDrilldown(summary);
    case 'library_discovery_dispatch':
      return buildDiscoveryDrilldown(summary);
    default:
      return null;
  }
}
