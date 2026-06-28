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

const RECOVERY_TRIGGER_SOURCE = 'failure_recovery';

function isFailedRun(run) {
  return run?.status === 'failed';
}

function hasActiveRun({ pendingRun, runningRun }) {
  return Boolean(pendingRun || runningRun);
}

function hasAlreadyRecovered(run) {
  return run?.triggerSource === RECOVERY_TRIGGER_SOURCE;
}

export function shouldRecoverFailedOperatorArtistReconciliation({
  latestRun = null,
  latestSnapshot = null,
  pendingRun = null,
  runningRun = null,
} = {}) {
  return Boolean(
    latestSnapshot?.id
      && isFailedRun(latestRun)
      && !hasActiveRun({ pendingRun, runningRun })
      && !hasAlreadyRecovered(latestRun),
  );
}

export function createOperatorArtistReconciliationRecoveryService({
  queueOperatorArtistReconciliation = null,
} = {}) {
  async function recoverFailedOperatorArtistReconciliation({
    appUserId,
    latestRun = null,
    latestSnapshot = null,
    metadataArtistId,
    pendingRun = null,
    runningRun = null,
  } = {}) {
    if (typeof queueOperatorArtistReconciliation !== 'function') {
      return { attempted: false, reason: 'queue_unavailable', run: null };
    }

    if (!shouldRecoverFailedOperatorArtistReconciliation({
      latestRun,
      latestSnapshot,
      pendingRun,
      runningRun,
    })) {
      return { attempted: false, reason: 'not_eligible', run: null };
    }

    try {
      const result = await queueOperatorArtistReconciliation({
        appUserId,
        metadataArtistId,
        triggerSource: RECOVERY_TRIGGER_SOURCE,
      });

      return {
        attempted: true,
        errorMessage: null,
        queuedBehindRun: result.queuedBehindRun,
        run: result.run ?? null,
        status: 'queued',
      };
    } catch (error) {
      return {
        attempted: true,
        errorMessage: error?.message ?? 'Artist reconciliation recovery failed',
        run: null,
        status: 'failed',
      };
    }
  }

  return {
    recoverFailedOperatorArtistReconciliation,
  };
}

