<!--
  Harmoniarr - Soulseek-native music library management
  Copyright (C) 2026 Harmoniarr Contributors

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program. If not, see <https://www.gnu.org/licenses/>.
-->

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { buildAuditActivityLinkTarget } from '../lib/audit-activity-links.js';
import { buildBackupExportDownloadUrl } from '../lib/recovery-api.js';
import {
  buildRecoveryRouteQuery,
  getRecoveryRouteStateKey,
  normalizeRecoveryRouteState,
} from '../lib/recovery-route-state.js';
import {
  buildOperationRunLinkTarget,
  getOperationRunDescriptor,
} from '../lib/operation-run-link-targets.js';
import { getOperationRunOperatorSummary } from '../lib/operation-run-presentation.js';
import {
  buildRecoverySectionHash,
  getRecoveryHoldDescription,
  getRecoveryHoldLabel,
  normalizeRecoverySectionId,
  recoveryHoldTypeOptions,
  recoverySectionNavigationItems,
} from '../lib/recovery-workspace.js';
import { useRecoveryBackups } from '../composables/useRecoveryBackups.js';
import { useRecoveryDiagnostics } from '../composables/useRecoveryDiagnostics.js';

const route = useRoute();
const router = useRouter();
const restoreConfirmation = ref(false);
const lockForm = reactive({
  expiresAtLocal: '',
  lockType: 'maintenance',
  reason: '',
});

const {
  actionErrorMessage: backupActionErrorMessage,
  backupArtifacts,
  createBackup,
  deleteSelectedBackup,
  errorMessage: backupErrorMessage,
  isApplyingRestore,
  isCreating,
  isDeleting,
  isLoading: isLoadingBackups,
  isLoadingPreview,
  lastRestoreResult,
  lastRestoreRun,
  loadBackups,
  previewErrorMessage,
  refreshSelectedBackupPreview,
  selectBackupArtifact,
  selectedBackupArtifact,
  selectedBackupId,
  selectedBackupPreview,
  applyRestore,
} = useRecoveryBackups();
const {
  actionErrorMessage: diagnosticsActionErrorMessage,
  activeLocks,
  createMaintenanceLock,
  errorMessage: diagnosticsErrorMessage,
  isEnteringLock,
  isLoading: isLoadingDiagnostics,
  loadDiagnostics,
  queueDiagnostics,
  queueState,
  recentFailedRuns,
  recentPrivilegedActions,
  recentQueueRuns,
  recoveryDiagnostics,
  releaseLock,
  releasingLockId,
} = useRecoveryDiagnostics();

const recoveryRouteState = computed(() => normalizeRecoveryRouteState(route.query));
const activeRecoverySectionId = computed(() => normalizeRecoverySectionId(route.hash));
const recoveryNavigationEntries = computed(() => recoverySectionNavigationItems.map((item) => ({
  ...item,
  to: {
    name: typeof route.name === 'string' ? route.name : 'recovery',
    query: route.query,
    hash: buildRecoverySectionHash(item.id),
  },
})));
const backupStatusPill = computed(() => {
  if (!selectedBackupPreview.value) {
    return null;
  }

  if (selectedBackupPreview.value.canApplyRestore) {
    return {
      className: 'review-status-selected',
      label: 'Restore ready',
    };
  }

  if (selectedBackupPreview.value.restoreReadiness?.blockedByLock) {
    return {
      className: 'review-status-held',
      label: 'Blocked by lock',
    };
  }

  return {
    className: 'review-status-failed',
    label: 'Needs review',
  };
});
const restoreRunTarget = computed(() => buildOperationRunLinkTarget({
  operationType: lastRestoreRun.value?.operationType,
  runId: lastRestoreRun.value?.id,
}));
const selectedHoldTypeDescription = computed(() => getRecoveryHoldDescription(lockForm.lockType));

function buildMergedRecoveryRouteQuery(nextState) {
  const query = { ...route.query };
  delete query.backupArtifactId;

  return {
    ...query,
    ...buildRecoveryRouteQuery({
      ...recoveryRouteState.value,
      ...nextState,
    }),
  };
}

async function replaceRecoveryRouteState(nextState) {
  const normalizedNextState = normalizeRecoveryRouteState({
    ...recoveryRouteState.value,
    ...nextState,
  });

  if (getRecoveryRouteStateKey(normalizedNextState) === getRecoveryRouteStateKey(recoveryRouteState.value)) {
    return;
  }

  await router.replace({
    query: buildMergedRecoveryRouteQuery(normalizedNextState),
    hash: route.hash,
  });
}

function formatTimestamp(value) {
  if (!value) {
    return 'Not yet recorded';
  }

  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? value : timestamp.toLocaleString();
}

function formatBytes(value) {
  if (!Number.isFinite(value) || value < 1) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let unitIndex = 0;
  let nextValue = value;

  while (nextValue >= 1024 && unitIndex < units.length - 1) {
    nextValue /= 1024;
    unitIndex += 1;
  }

  return `${nextValue.toFixed(nextValue >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatScope(scope) {
  if (typeof scope !== 'string' || scope.length === 0) {
    return 'Unknown';
  }

  return scope
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function checkStatusClass(status) {
  return status === 'passed' ? 'review-status-selected' : 'review-status-failed';
}

function checkStatusLabel(status) {
  return status === 'passed' ? 'Passed' : 'Failed';
}

function holdStatusClass(lockType) {
  switch (lockType) {
    case 'restore':
      return 'review-status-failed';
    case 'upgrade':
      return 'review-status-held';
    case 'admin_recovery':
      return 'review-status-held';
    default:
      return 'review-status-pending';
  }
}

function operationTitle(operationType) {
  return getOperationRunDescriptor(operationType).title;
}

function operationRunTarget(run) {
  return buildOperationRunLinkTarget({
    operationType: run?.operationType,
    runId: run?.id,
  });
}

function auditLinkTarget(event) {
  return buildAuditActivityLinkTarget(event);
}

function describeRestoreReadiness(preview) {
  if (!preview) {
    return 'Select a backup to review whether it is safe to restore.';
  }

  if (preview.canApplyRestore) {
    return 'This backup passed the current restore checks and can be applied when you are ready.';
  }

  if (preview.restoreReadiness?.blockedByLock) {
    return 'A safety hold is blocking restore apply. Release the hold or wait for it to expire before restoring.';
  }

  return 'Review the failed checks below before you try to apply this backup.';
}

function queueStatusClass(status) {
  switch (status) {
    case 'failed':
      return 'review-status-failed';
    case 'running':
      return 'review-status-pending';
    default:
      return 'review-status-selected';
  }
}

function toIsoDatetime(value) {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString();
}

async function handleCreateBackup() {
  const result = await createBackup();
  if (!result) {
    return;
  }

  await loadDiagnostics();
  await replaceRecoveryRouteState({ backupArtifactId: selectedBackupId.value ?? '' });
}

async function handleDeleteBackup() {
  const result = await deleteSelectedBackup();
  if (!result) {
    return;
  }

  restoreConfirmation.value = false;
  await loadDiagnostics();
  await replaceRecoveryRouteState({ backupArtifactId: selectedBackupId.value ?? '' });
}

async function handleApplyRestore() {
  const result = await applyRestore({
    expectedPayloadSha256: selectedBackupPreview.value?.integrity?.expectedPayloadSha256 ?? null,
  });
  if (!result) {
    return;
  }

  restoreConfirmation.value = false;
  await loadDiagnostics();
  await refreshSelectedBackupPreview();
}

async function handleEnterLock() {
  const result = await createMaintenanceLock({
    expiresAt: toIsoDatetime(lockForm.expiresAtLocal),
    lockType: lockForm.lockType,
    reason: lockForm.reason.trim(),
  });

  if (!result) {
    return;
  }

  lockForm.expiresAtLocal = '';
  lockForm.lockType = 'maintenance';
  lockForm.reason = '';
  await refreshSelectedBackupPreview();
}

async function handleReleaseLock(lockId) {
  const result = await releaseLock(lockId);
  if (!result) {
    return;
  }

  await refreshSelectedBackupPreview();
}

onMounted(async () => {
  await Promise.all([
    loadBackups({
      preferredBackupArtifactId: recoveryRouteState.value.backupArtifactId || null,
    }),
    loadDiagnostics(),
  ]);

  if (selectedBackupId.value !== recoveryRouteState.value.backupArtifactId) {
    await replaceRecoveryRouteState({ backupArtifactId: selectedBackupId.value ?? '' });
  }
});

watch(
  selectedBackupId,
  (nextBackupArtifactId) => {
    restoreConfirmation.value = false;

    if ((nextBackupArtifactId ?? '') === recoveryRouteState.value.backupArtifactId) {
      return;
    }

    void replaceRecoveryRouteState({ backupArtifactId: nextBackupArtifactId ?? '' });
  },
);

watch(
  () => recoveryRouteState.value.backupArtifactId,
  (nextBackupArtifactId, previousBackupArtifactId) => {
    if (nextBackupArtifactId === previousBackupArtifactId || nextBackupArtifactId === selectedBackupId.value) {
      return;
    }

    if (!nextBackupArtifactId) {
      return;
    }

    void selectBackupArtifact(nextBackupArtifactId);
  },
);
</script>

<template>
  <section class="page-stack">
    <article class="panel-dark hero-card compact">
      <p class="eyebrow">Recovery</p>
      <h2>Backups, restore checks, and safe maintenance</h2>
      <p>
        Create recovery exports, confirm whether a restore is safe, pause risky background work during manual changes, and review recent recovery activity from one workspace.
      </p>
    </article>

    <article class="panel-light workspace-nav-panel">
      <div class="section-header">
        <div>
          <p class="eyebrow">Workspace sections</p>
          <h3>Recovery tasks</h3>
        </div>
      </div>

      <div class="workspace-nav-list">
        <RouterLink
          v-for="item in recoveryNavigationEntries"
          :key="item.id"
          class="workspace-nav-link"
          :class="{ 'is-active': activeRecoverySectionId === item.id }"
          :to="item.to"
        >
          <span class="workspace-nav-link-label">{{ item.label }}</span>
          <span class="workspace-nav-link-copy">{{ item.description }}</span>
        </RouterLink>
      </div>
    </article>

    <div class="operations-grid">
      <article id="backups" class="panel-light workspace-anchor-section">
        <div class="section-header">
          <div>
            <p class="eyebrow">Backups</p>
            <h3>Create and inspect recovery exports</h3>
            <p class="metadata-card-copy">Keep recovery exports current, then pick one backup to inspect before restore work.</p>
          </div>
          <div class="operations-actions">
            <button type="button" class="secondary-button" @click="loadBackups({ preferredBackupArtifactId: selectedBackupId || null })" :disabled="isLoadingBackups">
              {{ isLoadingBackups ? 'Refreshing...' : 'Refresh backups' }}
            </button>
            <button type="button" @click="handleCreateBackup" :disabled="isCreating">
              {{ isCreating ? 'Exporting...' : 'Create backup' }}
            </button>
          </div>
        </div>

        <p class="error-copy" v-if="backupActionErrorMessage">{{ backupActionErrorMessage }}</p>
        <p class="error-copy" v-if="backupErrorMessage">{{ backupErrorMessage }}</p>
        <p v-else-if="isLoadingBackups">Loading saved backup exports.</p>
        <p class="metadata-card-copy" v-else-if="!backupArtifacts.length">No recovery exports have been recorded yet.</p>

        <div class="session-list" v-else>
          <article class="session-row" v-for="backupArtifact in backupArtifacts" :key="backupArtifact.id">
            <div>
              <p class="eyebrow">{{ formatScope(backupArtifact.backupType) }}</p>
              <strong>{{ backupArtifact.filename }}</strong>
              <p class="metadata-card-copy">Created {{ formatTimestamp(backupArtifact.createdAt) }}</p>
              <p class="muted-copy">
                {{ backupArtifact.encrypted ? 'Encrypted' : 'Plaintext' }}
                · {{ formatBytes(backupArtifact.fileSizeBytes) }}
                · {{ backupArtifact.appVersion ?? 'Unknown version' }}
              </p>
              <p class="muted-copy" v-if="backupArtifact.scope?.length">
                Scopes: {{ backupArtifact.scope.map(formatScope).join(', ') }}
              </p>
            </div>
            <div class="session-actions operations-actions">
              <span class="review-status-pill" :class="backupArtifact.id === selectedBackupId ? 'review-status-selected' : 'review-status-held'">
                {{ backupArtifact.id === selectedBackupId ? 'Selected' : 'Available' }}
              </span>
              <button type="button" class="secondary-button" @click="selectBackupArtifact(backupArtifact.id)">
                Inspect backup
              </button>
            </div>
          </article>
        </div>
      </article>

      <article id="restore" class="panel-light workspace-anchor-section">
        <div class="section-header">
          <div>
            <p class="eyebrow">Restore checks</p>
            <h3>Preview a selected backup</h3>
            <p class="metadata-card-copy">Review checks and safety notes before you apply any restore.</p>
          </div>
          <div class="operations-actions" v-if="selectedBackupId">
            <a class="secondary-button" :href="buildBackupExportDownloadUrl(selectedBackupId)">Download JSON</a>
            <button type="button" class="secondary-button" @click="refreshSelectedBackupPreview" :disabled="isLoadingPreview">
              {{ isLoadingPreview ? 'Refreshing...' : 'Refresh checks' }}
            </button>
            <button type="button" class="secondary-button" @click="handleDeleteBackup" :disabled="isDeleting">
              {{ isDeleting ? 'Deleting...' : 'Delete backup' }}
            </button>
          </div>
        </div>

        <p class="error-copy" v-if="previewErrorMessage">{{ previewErrorMessage }}</p>
        <p v-else-if="isLoadingPreview && !selectedBackupArtifact">Loading backup detail and restore checks.</p>
        <p class="metadata-card-copy" v-else-if="!selectedBackupArtifact">Select a backup to review checksum, compatibility, and restore safety before applying it.</p>

        <template v-else>
          <div class="review-detail-header">
            <div>
              <p class="eyebrow">{{ formatScope(selectedBackupArtifact.backupType) }}</p>
              <h3>{{ selectedBackupArtifact.filename }}</h3>
              <p class="metadata-card-copy">Created {{ formatTimestamp(selectedBackupArtifact.createdAt) }}</p>
            </div>
            <span v-if="backupStatusPill" class="review-status-pill" :class="backupStatusPill.className">
              {{ backupStatusPill.label }}
            </span>
          </div>

          <div class="operations-insight-grid" v-if="selectedBackupPreview">
            <article class="operations-insight-card">
              <p class="eyebrow">Restore status</p>
              <strong>{{ describeRestoreReadiness(selectedBackupPreview) }}</strong>
            </article>
            <article class="operations-insight-card">
              <p class="eyebrow">What changes</p>
              <strong>Restore apply updates current application state immediately for the scopes included in this backup.</strong>
            </article>
            <article class="operations-insight-card">
              <p class="eyebrow">Before you apply</p>
              <strong>Keep a current backup, confirm no safety hold is blocking restore work, and make sure you still want to replace current state.</strong>
            </article>
          </div>

          <dl class="review-meta-grid onboarding-meta-grid">
            <div>
              <dt>Format version</dt>
              <dd>{{ selectedBackupArtifact.formatVersion }}</dd>
            </div>
            <div>
              <dt>Migration level</dt>
              <dd>{{ selectedBackupArtifact.migrationLevel }}</dd>
            </div>
            <div>
              <dt>Encrypted</dt>
              <dd>{{ selectedBackupArtifact.encrypted ? 'Yes' : 'No' }}</dd>
            </div>
            <div>
              <dt>File size</dt>
              <dd>{{ formatBytes(selectedBackupArtifact.fileSizeBytes) }}</dd>
            </div>
            <div>
              <dt>Created by</dt>
              <dd>{{ selectedBackupArtifact.createdByUserId ?? 'System or unknown actor' }}</dd>
            </div>
            <div>
              <dt>Scopes</dt>
              <dd>{{ selectedBackupArtifact.scope?.length ? selectedBackupArtifact.scope.map(formatScope).join(', ') : 'Unknown' }}</dd>
            </div>
          </dl>

          <article class="onboarding-step-card" v-if="selectedBackupPreview">
            <div class="section-header">
              <div>
                <h3>Preview checks</h3>
                <p class="metadata-card-copy">Checked {{ formatTimestamp(selectedBackupPreview.checkedAt) }}</p>
              </div>
            </div>

            <dl class="review-meta-grid onboarding-meta-grid">
              <div>
                <dt>Expected checksum</dt>
                <dd>{{ selectedBackupPreview.integrity?.expectedPayloadSha256 ?? 'Unavailable' }}</dd>
              </div>
              <div>
                <dt>Actual checksum</dt>
                <dd>{{ selectedBackupPreview.integrity?.actualPayloadSha256 ?? 'Unavailable' }}</dd>
              </div>
              <div>
                <dt>Runtime migration level</dt>
                <dd>{{ selectedBackupPreview.compatibility?.currentMigrationLevel ?? 'Unavailable' }}</dd>
              </div>
              <div>
                <dt>Restore blocked by lock</dt>
                <dd>{{ selectedBackupPreview.restoreReadiness?.blockedByLock ? 'Yes' : 'No' }}</dd>
              </div>
            </dl>

            <div class="session-list">
              <article class="session-row" v-for="check in selectedBackupPreview.compatibility?.checks ?? []" :key="check.code">
                <div>
                  <strong>{{ check.message }}</strong>
                  <p class="muted-copy">{{ check.code }}</p>
                </div>
                <span class="review-status-pill" :class="checkStatusClass(check.status)">
                  {{ checkStatusLabel(check.status) }}
                </span>
              </article>
            </div>

            <article class="panel-light review-empty-state" v-if="selectedBackupPreview.restoreReadiness?.blockingLocks?.length">
              <h3>Safety holds blocking restore</h3>
              <div class="session-list">
                <article class="session-row" v-for="lock in selectedBackupPreview.restoreReadiness.blockingLocks" :key="lock.id">
                  <div>
                    <strong>{{ getRecoveryHoldLabel(lock.lockType) }}</strong>
                    <p class="muted-copy">{{ getRecoveryHoldDescription(lock.lockType) }}</p>
                    <p class="muted-copy">{{ lock.reason || 'No reason recorded' }}</p>
                    <p class="metadata-card-copy">Acquired {{ formatTimestamp(lock.acquiredAt) }}</p>
                  </div>
                  <span class="review-status-pill" :class="holdStatusClass(lock.lockType)">
                    Active
                  </span>
                </article>
              </div>
            </article>
          </article>

          <article class="onboarding-step-card">
            <h3>Apply restore carefully</h3>
            <p class="metadata-card-copy">
              Restore apply requires a fresh admin session and mutates current application state. Confirm only after the preview and lock state match expectations.
            </p>
            <label class="recovery-confirmation-row">
              <input v-model="restoreConfirmation" type="checkbox">
              I have reviewed this backup and understand that restore apply changes current state immediately.
            </label>
            <div class="operations-actions">
              <button
                type="button"
                @click="handleApplyRestore"
                :disabled="!selectedBackupPreview?.canApplyRestore || !restoreConfirmation || isApplyingRestore"
              >
                {{ isApplyingRestore ? 'Applying restore...' : 'Apply restore' }}
              </button>
              <RouterLink v-if="restoreRunTarget" class="secondary-button" :to="restoreRunTarget.to">
                {{ restoreRunTarget.label }}
              </RouterLink>
            </div>

            <article class="panel-light review-empty-state" v-if="lastRestoreResult">
              <h3>Latest restore result</h3>
              <dl class="review-meta-grid onboarding-meta-grid">
                <div>
                  <dt>Requested scopes</dt>
                  <dd>{{ lastRestoreResult.requestedScopes?.length ? lastRestoreResult.requestedScopes.map(formatScope).join(', ') : 'None' }}</dd>
                </div>
                <div>
                  <dt>Applied scopes</dt>
                  <dd>{{ lastRestoreResult.appliedScopes?.length ? lastRestoreResult.appliedScopes.map(formatScope).join(', ') : 'None' }}</dd>
                </div>
                <div>
                  <dt>Skipped scopes</dt>
                  <dd>{{ lastRestoreResult.skippedScopes?.length ? lastRestoreResult.skippedScopes.map(formatScope).join(', ') : 'None' }}</dd>
                </div>
              </dl>
            </article>
          </article>
        </template>
      </article>
    </div>

    <div class="operations-grid">
      <article id="safety-holds" class="panel-light workspace-anchor-section">
        <div class="section-header">
          <div>
            <p class="eyebrow">Safety holds</p>
            <h3>Pause risky work before manual changes</h3>
            <p class="metadata-card-copy">Use a safety hold before restore apply, upgrade work, or manual filesystem changes so background jobs do not race your edits.</p>
          </div>
          <button type="button" class="secondary-button" @click="loadDiagnostics" :disabled="isLoadingDiagnostics">
            {{ isLoadingDiagnostics ? 'Refreshing...' : 'Refresh diagnostics' }}
          </button>
        </div>

        <p class="error-copy" v-if="diagnosticsActionErrorMessage">{{ diagnosticsActionErrorMessage }}</p>
        <p class="error-copy" v-if="diagnosticsErrorMessage">{{ diagnosticsErrorMessage }}</p>
        <p v-else-if="isLoadingDiagnostics">Loading queue, hold, and recovery checks.</p>

        <template v-else>
          <div class="operations-insight-grid">
            <article class="operations-insight-card">
              <p class="eyebrow">Current state</p>
              <strong>
                {{ activeLocks.length ? `${activeLocks.length} safety hold${activeLocks.length === 1 ? '' : 's'} active right now.` : 'No safety holds are active right now.' }}
              </strong>
            </article>
            <article class="operations-insight-card">
              <p class="eyebrow">Queue impact</p>
              <strong>{{ queueState.pending }} waiting, {{ queueState.running }} running, and {{ queueState.failed }} failed background job{{ queueState.failed === 1 ? '' : 's' }}.</strong>
            </article>
            <article class="operations-insight-card">
              <p class="eyebrow">Why this matters</p>
              <strong>Safety holds keep restore or maintenance work from colliding with background automation that could change the same state.</strong>
            </article>
          </div>

          <dl class="review-meta-grid onboarding-meta-grid">
            <div>
              <dt>Pending jobs</dt>
              <dd>{{ queueState.pending }}</dd>
            </div>
            <div>
              <dt>Running jobs</dt>
              <dd>{{ queueState.running }}</dd>
            </div>
            <div>
              <dt>Failed jobs</dt>
              <dd>{{ queueState.failed }}</dd>
            </div>
            <div>
              <dt>Active locks</dt>
              <dd>{{ activeLocks.length }}</dd>
            </div>
          </dl>

          <p class="metadata-card-copy" v-if="!activeLocks.length">No active safety holds are currently blocking restore-sensitive workflows.</p>
          <div class="session-list" v-else>
            <article class="session-row" v-for="lock in activeLocks" :key="lock.id">
              <div>
                <strong>{{ getRecoveryHoldLabel(lock.lockType) }}</strong>
                <p class="muted-copy">{{ getRecoveryHoldDescription(lock.lockType) }}</p>
                <p class="muted-copy">{{ lock.reason || 'No reason recorded' }}</p>
                <p class="metadata-card-copy">
                  Acquired {{ formatTimestamp(lock.acquiredAt) }}
                  <span v-if="lock.expiresAt"> · Expires {{ formatTimestamp(lock.expiresAt) }}</span>
                </p>
              </div>
              <div class="operations-actions">
                <span class="review-status-pill" :class="holdStatusClass(lock.lockType)">
                  Active
                </span>
                <button type="button" class="secondary-button" @click="handleReleaseLock(lock.id)" :disabled="releasingLockId === lock.id">
                  {{ releasingLockId === lock.id ? 'Releasing...' : 'Release hold' }}
                </button>
              </div>
            </article>
          </div>

          <article class="onboarding-step-card">
            <h3>Start a safety hold</h3>
            <div class="review-form-grid">
              <label>
                Hold type
                <select v-model="lockForm.lockType">
                  <option v-for="option in recoveryHoldTypeOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
                </select>
              </label>
              <label>
                Expires at
                <input v-model="lockForm.expiresAtLocal" type="datetime-local">
              </label>
            </div>
            <p class="metadata-card-copy">{{ selectedHoldTypeDescription }}</p>
            <label>
              Reason
              <input v-model="lockForm.reason" placeholder="Example: preparing manual filesystem maintenance">
            </label>
            <div class="operations-actions">
              <button type="button" @click="handleEnterLock" :disabled="isEnteringLock || !lockForm.reason.trim()">
                {{ isEnteringLock ? 'Starting hold...' : 'Start hold' }}
              </button>
            </div>
          </article>
        </template>
      </article>

      <article id="diagnostics" class="panel-light workspace-anchor-section">
        <div class="section-header">
          <div>
            <p class="eyebrow">Diagnostics</p>
            <h3>Recent recovery history</h3>
            <p class="metadata-card-copy">Use this area to spot background-job trouble and review recent recovery actions without digging through logs first.</p>
          </div>
        </div>

        <article class="onboarding-step-card">
          <h3>Recent background work</h3>
          <p class="metadata-card-copy" v-if="!recentQueueRuns.length">No recent background jobs are available.</p>
          <div class="session-list" v-else>
            <article class="session-row" v-for="run in recentQueueRuns" :key="run.id">
              <div>
                <strong>{{ operationTitle(run.operationType) }}</strong>
                <p class="muted-copy">{{ getOperationRunOperatorSummary(run) }}</p>
                <p class="metadata-card-copy">Started {{ formatTimestamp(run.startedAt) }}</p>
                <p class="muted-copy">Run ID {{ run.id }}</p>
              </div>
              <div class="operations-actions">
                <span class="review-status-pill" :class="queueStatusClass(run.status)">
                  {{ formatScope(run.status) }}
                </span>
                <RouterLink v-if="operationRunTarget(run)" class="secondary-button" :to="operationRunTarget(run).to">
                  {{ operationRunTarget(run).label }}
                </RouterLink>
              </div>
            </article>
          </div>
        </article>

        <article class="onboarding-step-card">
          <h3>Recent recovery-related failures</h3>
          <p class="metadata-card-copy" v-if="!recentFailedRuns.length">No failed recovery-relevant runs were found.</p>
          <div class="session-list" v-else>
            <article class="session-row" v-for="run in recentFailedRuns" :key="run.id">
              <div>
                <strong>{{ operationTitle(run.operationType) }}</strong>
                <p class="muted-copy">{{ getOperationRunOperatorSummary(run) }}</p>
                <p class="muted-copy" v-if="run.errorMessage">Latest issue: {{ run.errorMessage }}</p>
                <p class="metadata-card-copy">Finished {{ formatTimestamp(run.finishedAt) }}</p>
                <p class="muted-copy">Run ID {{ run.id }}</p>
              </div>
              <div class="operations-actions">
                <span class="review-status-pill review-status-failed">Failed</span>
                <RouterLink v-if="operationRunTarget(run)" class="secondary-button" :to="operationRunTarget(run).to">
                  {{ operationRunTarget(run).label }}
                </RouterLink>
              </div>
            </article>
          </div>
        </article>

        <article class="onboarding-step-card">
          <h3>Recent recovery actions</h3>
          <p class="metadata-card-copy" v-if="!recentPrivilegedActions.length">No recent recovery actions have been recorded yet.</p>
          <div class="session-list" v-else>
            <article class="session-row" v-for="event in recentPrivilegedActions" :key="event.id">
              <div>
                <strong>{{ event.summary || formatScope(event.eventType) }}</strong>
                <p class="muted-copy">{{ event.eventType }}</p>
                <p class="metadata-card-copy">Occurred {{ formatTimestamp(event.occurredAt) }}</p>
              </div>
              <div class="operations-actions">
                <RouterLink v-if="auditLinkTarget(event)" class="secondary-button" :to="auditLinkTarget(event).to">
                  {{ auditLinkTarget(event).label }}
                </RouterLink>
              </div>
            </article>
          </div>
        </article>

        <p class="metadata-card-copy" v-if="queueDiagnostics?.checkedAt || recoveryDiagnostics?.checkedAt">
          Queue checked {{ formatTimestamp(queueDiagnostics?.checkedAt) }} · Recovery checked {{ formatTimestamp(recoveryDiagnostics?.checkedAt) }}
        </p>
      </article>
    </div>
  </section>
</template>

<style scoped>
.recovery-confirmation-row {
  align-items: center;
  display: flex;
  gap: 0.75rem;
  margin: 1rem 0;
}

.recovery-confirmation-row input {
  flex: none;
  width: auto;
}

.review-form-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  margin-bottom: 1rem;
}
</style>
