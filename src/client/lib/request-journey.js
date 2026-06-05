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
 * Request journey derivation.
 *
 * Pure functions only — no Vue, no reactive state, no side-effects.
 *
 * Composes a single request-level "where is my request right now" journey
 * from read models the client already loads:
 *   - the media request detail (`mediaRequest`)
 *   - the linked import candidates (`candidates`, each optionally carrying
 *     `execution` and `apply` run-item snapshots)
 *
 * The journey is a fixed, ordered sequence of canonical stages. Each stage is
 * resolved to one of the {@link STAGE_STATUS} values. Exactly one stage is the
 * "current" stage (used for `aria-current="step"`): the first active stage, or
 * the last completed stage when none is active.
 */

// ── Canonical ordered stages ─────────────────────────────────────────────────

export const JOURNEY_STAGE = Object.freeze({
  REQUESTED: 'requested',
  SEARCHING: 'searching',
  DOWNLOADING: 'downloading',
  IMPORTING: 'importing',
  LIBRARY: 'library',
});

const STAGE_ORDER = Object.freeze([
  JOURNEY_STAGE.REQUESTED,
  JOURNEY_STAGE.SEARCHING,
  JOURNEY_STAGE.DOWNLOADING,
  JOURNEY_STAGE.IMPORTING,
  JOURNEY_STAGE.LIBRARY,
]);

const STAGE_LABELS = Object.freeze({
  [JOURNEY_STAGE.REQUESTED]: 'Requested',
  [JOURNEY_STAGE.SEARCHING]: 'Finding sources',
  [JOURNEY_STAGE.DOWNLOADING]: 'Downloading',
  [JOURNEY_STAGE.IMPORTING]: 'Importing',
  [JOURNEY_STAGE.LIBRARY]: 'In your library',
});

// ── Stage status ─────────────────────────────────────────────────────────────

export const STAGE_STATUS = Object.freeze({
  COMPLETE: 'complete',
  ACTIVE: 'active',
  PENDING: 'pending',
  FAILED: 'failed',
  SKIPPED: 'skipped',
  CANCELLED: 'cancelled',
});

const STATUS_LABELS = Object.freeze({
  [STAGE_STATUS.COMPLETE]: 'Done',
  [STAGE_STATUS.ACTIVE]: 'In progress',
  [STAGE_STATUS.PENDING]: 'Waiting',
  [STAGE_STATUS.FAILED]: 'Failed',
  [STAGE_STATUS.SKIPPED]: 'Skipped',
  [STAGE_STATUS.CANCELLED]: 'Cancelled',
});

const STATUS_TONES = Object.freeze({
  [STAGE_STATUS.COMPLETE]: 'success',
  [STAGE_STATUS.ACTIVE]: 'warning',
  [STAGE_STATUS.PENDING]: 'info',
  [STAGE_STATUS.FAILED]: 'danger',
  [STAGE_STATUS.SKIPPED]: 'muted',
  [STAGE_STATUS.CANCELLED]: 'muted',
});

export const TRANSFER_PROGRESS_FRESHNESS = Object.freeze({
  FRESH: 'fresh',
  STALE: 'stale',
  UNKNOWN: 'unknown',
});

export const TRANSFER_PROGRESS_STALE_AFTER_MS = 120000;

/**
 * Human-readable label for a journey stage status.
 *
 * @param {string} status
 * @returns {string}
 */
export function journeyStatusLabel(status) {
  return STATUS_LABELS[status] ?? STATUS_LABELS[STAGE_STATUS.PENDING];
}

/**
 * UI tone (for the `data-tone` pill attribute) for a journey stage status.
 *
 * @param {string} status
 * @returns {string}
 */
export function journeyStatusTone(status) {
  return STATUS_TONES[status] ?? STATUS_TONES[STAGE_STATUS.PENDING];
}

// ── Candidate aggregation helpers ────────────────────────────────────────────

const TERMINAL_REQUEST_STATES = new Set(['cancelled', 'failed', 'already_exists']);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function someCandidate(candidates, predicate) {
  return candidates.some((candidate) => predicate(candidate ?? {}));
}

function runFailed(runItem) {
  if (!runItem) return false;
  return runItem.runStatus === 'failed' || runItem.itemStatus === 'failed';
}

function runActive(runItem) {
  if (!runItem) return false;
  return runItem.runStatus === 'running' || runItem.runStatus === 'pending';
}

function runCompleted(runItem) {
  if (!runItem) return false;
  return runItem.runStatus === 'completed' && runItem.itemStatus === 'completed';
}

function candidateDownloadActive(candidate) {
  return candidate?.status === 'downloading' || runActive(candidate?.execution);
}

function normalizeTransferPercent(value) {
  if (value == null || (typeof value === 'string' && value.trim() === '')) {
    return null;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function observedAtTime(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function resolveTransferProgressFreshness({ nowMs, observedAt, staleAfterMs }) {
  const observedAtMs = observedAtTime(observedAt);
  if (
    observedAtMs == null
    || !Number.isFinite(nowMs)
    || !Number.isFinite(staleAfterMs)
    || staleAfterMs < 0
  ) {
    return {
      freshness: TRANSFER_PROGRESS_FRESHNESS.UNKNOWN,
      observedAgeMs: null,
      staleAfterMs: Number.isFinite(staleAfterMs) && staleAfterMs >= 0 ? staleAfterMs : null,
    };
  }

  const observedAgeMs = Math.max(0, nowMs - observedAtMs);
  return {
    freshness: observedAgeMs > staleAfterMs
      ? TRANSFER_PROGRESS_FRESHNESS.STALE
      : TRANSFER_PROGRESS_FRESHNESS.FRESH,
    observedAgeMs,
    staleAfterMs,
  };
}

function buildDownloadingProgress(candidate, {
  nowMs,
  staleAfterMs,
} = {}) {
  if (!candidate) {
    return null;
  }

  const transferProgress = candidate.transferProgress ?? null;
  const percentComplete = normalizeTransferPercent(transferProgress?.percentComplete);
  const observedAt = typeof transferProgress?.observedAt === 'string'
    ? transferProgress.observedAt
    : null;
  const status = typeof transferProgress?.status === 'string'
    ? transferProgress.status
    : null;
  const freshness = resolveTransferProgressFreshness({
    nowMs,
    observedAt,
    staleAfterMs,
  });

  if (percentComplete != null) {
    return {
      mode: 'determinate',
      observedAt,
      ...freshness,
      percentComplete,
      status,
    };
  }

  return {
    mode: 'indeterminate',
    observedAt,
    ...freshness,
    percentComplete: null,
    status,
  };
}

function compareDownloadingProgressCandidate(left, right) {
  const leftPercent = normalizeTransferPercent(left?.transferProgress?.percentComplete);
  const rightPercent = normalizeTransferPercent(right?.transferProgress?.percentComplete);

  if (leftPercent != null && rightPercent == null) return -1;
  if (leftPercent == null && rightPercent != null) return 1;
  if (leftPercent != null && rightPercent != null && leftPercent !== rightPercent) {
    return rightPercent - leftPercent;
  }

  const leftObservedAt = observedAtTime(left?.transferProgress?.observedAt);
  const rightObservedAt = observedAtTime(right?.transferProgress?.observedAt);
  return rightObservedAt - leftObservedAt;
}

export function selectDownloadingProgressCandidate(candidates) {
  return asArray(candidates)
    .filter(candidateDownloadActive)
    .sort(compareDownloadingProgressCandidate)[0] ?? null;
}

// ── Per-stage resolution ─────────────────────────────────────────────────────

function resolveSearching({ requestState, candidates }) {
  if (candidates.length > 0 || requestState === 'already_exists') {
    return { status: STAGE_STATUS.COMPLETE, detail: 'Source candidates were found.' };
  }
  if (requestState === 'failed') {
    return { status: STAGE_STATUS.FAILED, detail: 'No usable sources could be found.' };
  }
  if (requestState === 'cancelled') {
    return { status: STAGE_STATUS.CANCELLED, detail: 'Search was cancelled.' };
  }
  return { status: STAGE_STATUS.ACTIVE, detail: 'Searching Soulseek for matching sources.' };
}

function resolveDownloading({
  candidates,
  nowMs,
  requestState,
  transferProgressStaleAfterMs,
}) {
  if (requestState === 'already_exists') {
    return { status: STAGE_STATUS.SKIPPED, detail: 'Already present in the library; no download needed.' };
  }
  if (candidates.length === 0) {
    return requestState === 'cancelled'
      ? { status: STAGE_STATUS.CANCELLED, detail: 'Cancelled before downloading.' }
      : { status: STAGE_STATUS.PENDING, detail: 'Waiting for a source to download.' };
  }

  const anyDownloadComplete = someCandidate(candidates, (c) =>
    c.status === 'import_pending' || c.status === 'applied' || runCompleted(c.execution));
  const anyDownloading = someCandidate(candidates, (c) =>
    c.status === 'downloading' || runActive(c.execution));
  const anyDownloadFailed = someCandidate(candidates, (c) => runFailed(c.execution));

  if (anyDownloadComplete) {
    return { status: STAGE_STATUS.COMPLETE, detail: 'Download finished.' };
  }
  if (anyDownloading) {
    return {
      status: STAGE_STATUS.ACTIVE,
      detail: 'Transferring files from Soulseek.',
      progress: buildDownloadingProgress(selectDownloadingProgressCandidate(candidates), {
        nowMs,
        staleAfterMs: transferProgressStaleAfterMs,
      }),
    };
  }
  if (anyDownloadFailed) {
    return { status: STAGE_STATUS.FAILED, detail: 'A download failed; Harmoniarr may retry another source.' };
  }
  if (requestState === 'cancelled') {
    return { status: STAGE_STATUS.CANCELLED, detail: 'Cancelled before downloading.' };
  }
  return { status: STAGE_STATUS.PENDING, detail: 'Queued to download.' };
}

function resolveImporting({ requestState, candidates }) {
  if (requestState === 'already_exists') {
    return { status: STAGE_STATUS.SKIPPED, detail: 'Already present in the library; no import needed.' };
  }

  const anyApplied = someCandidate(candidates, (c) => c.status === 'applied' || runCompleted(c.apply));
  const anyApplying = someCandidate(candidates, (c) => runActive(c.apply));
  const anyApplyFailed = someCandidate(candidates, (c) => runFailed(c.apply));
  const anyImportPending = someCandidate(candidates, (c) => c.status === 'import_pending');

  if (anyApplied) {
    return { status: STAGE_STATUS.COMPLETE, detail: 'Files were imported into the library.' };
  }
  if (anyApplying) {
    return { status: STAGE_STATUS.ACTIVE, detail: 'Validating and importing downloaded files.' };
  }
  if (anyApplyFailed) {
    return { status: STAGE_STATUS.FAILED, detail: 'Import failed; review is required.' };
  }
  if (anyImportPending) {
    return { status: STAGE_STATUS.PENDING, detail: 'Download complete; waiting to be imported.' };
  }
  if (requestState === 'cancelled') {
    return { status: STAGE_STATUS.CANCELLED, detail: 'Cancelled before importing.' };
  }
  return { status: STAGE_STATUS.PENDING, detail: 'Not yet ready to import.' };
}

function resolveLibrary({ requestState, candidates }) {
  if (requestState === 'already_exists') {
    return { status: STAGE_STATUS.COMPLETE, detail: 'This release is already in the library.' };
  }
  if (someCandidate(candidates, (c) => c.status === 'applied' || runCompleted(c.apply))) {
    return { status: STAGE_STATUS.COMPLETE, detail: 'Available in your library.' };
  }
  if (requestState === 'cancelled') {
    return { status: STAGE_STATUS.CANCELLED, detail: 'Request was cancelled.' };
  }
  return { status: STAGE_STATUS.PENDING, detail: 'Not yet in your library.' };
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Build the canonical request journey from already-loaded read models.
 *
 * @param {object} options
 * @param {object|null|undefined} options.mediaRequest - the media request detail.
 * @param {Array<object>} [options.candidates] - linked import candidates.
 * @returns {{ stages: Array<{ key: string, label: string, status: string, detail: string }>, currentStageKey: string|null }}
 */
export function buildRequestJourney({
  candidates,
  mediaRequest,
  nowMs = Date.now(),
  transferProgressStaleAfterMs = TRANSFER_PROGRESS_STALE_AFTER_MS,
} = {}) {
  if (!mediaRequest) {
    return { stages: [], currentStageKey: null };
  }

  const requestState = mediaRequest.requestState ?? 'needs_fetch';
  const normalizedCandidates = asArray(candidates);
  const isCancelled = requestState === 'cancelled';

  const requested = {
    status: STAGE_STATUS.COMPLETE,
    detail: 'Your request was received.',
  };

  const resolvedByKey = {
    [JOURNEY_STAGE.REQUESTED]: requested,
    [JOURNEY_STAGE.SEARCHING]: resolveSearching({ requestState, candidates: normalizedCandidates }),
    [JOURNEY_STAGE.DOWNLOADING]: resolveDownloading({
      candidates: normalizedCandidates,
      nowMs,
      requestState,
      transferProgressStaleAfterMs,
    }),
    [JOURNEY_STAGE.IMPORTING]: resolveImporting({ requestState, candidates: normalizedCandidates }),
    [JOURNEY_STAGE.LIBRARY]: resolveLibrary({ requestState, candidates: normalizedCandidates }),
  };

  const stages = STAGE_ORDER.map((key) => ({
    key,
    label: STAGE_LABELS[key],
    status: resolvedByKey[key].status,
    detail: resolvedByKey[key].detail,
    progress: resolvedByKey[key].progress ?? null,
  }));

  return {
    stages,
    currentStageKey: resolveCurrentStageKey(stages, { isCancelled, requestState }),
    isTerminal: TERMINAL_REQUEST_STATES.has(requestState),
  };
}

/**
 * Resolve which stage is "current" for `aria-current="step"`.
 *
 * Exactly one stage is current:
 *   - the first ACTIVE stage, else
 *   - the first FAILED / CANCELLED stage (so attention lands on the problem), else
 *   - the last COMPLETE stage, else
 *   - the first stage.
 *
 * @param {Array<{ key: string, status: string }>} stages
 * @param {{ isCancelled?: boolean, requestState?: string }} [context]
 * @returns {string|null}
 */
export function resolveCurrentStageKey(stages, { isCancelled = false } = {}) {
  if (!Array.isArray(stages) || stages.length === 0) {
    return null;
  }

  const firstActive = stages.find((stage) => stage.status === STAGE_STATUS.ACTIVE);
  if (firstActive) return firstActive.key;

  const firstProblem = stages.find(
    (stage) => stage.status === STAGE_STATUS.FAILED || (isCancelled && stage.status === STAGE_STATUS.CANCELLED),
  );
  if (firstProblem) return firstProblem.key;

  let lastComplete = null;
  for (const stage of stages) {
    if (stage.status === STAGE_STATUS.COMPLETE) {
      lastComplete = stage.key;
    }
  }
  return lastComplete ?? stages[0].key;
}
