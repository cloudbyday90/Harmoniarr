<!--
  Harmoniarr - Soulseek-native music library management
  Copyright (C) 2026 Harmoniarr Contributors
  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.
-->

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import SettingsDisclosure from '../components/settings/SettingsDisclosure.vue';
import { buildBackupExportDownloadUrl } from '../lib/recovery-api.js';
import {
  buildRecoveryRouteQuery,
  getRecoveryRouteStateKey,
  normalizeRecoveryRouteState,
} from '../lib/recovery-route-state.js';
import { buildOperationRunLinkTarget } from '../lib/operation-run-link-targets.js';
import {
  checkStatusClass,
  checkStatusLabel,
  describeRestoreReadiness,
  formatBytes,
  formatScope,
  formatTimestamp,
} from '../lib/backup-restore-presentation.js';
import { buildSettingsRecoveryPosture } from '../lib/settings-recovery-presentation.js';
import {
  describeLockImpact,
  formatDiagnosticTimestamp,
  formatLockExpiresAt,
  formatLockStatus,
  formatLockType,
  getLockStatusTone,
} from '../lib/maintenance-lock-presentation.js';
import { useRecoveryBackups } from '../composables/useRecoveryBackups.js';
import { useRecoveryDiagnostics } from '../composables/useRecoveryDiagnostics.js';
import { useMaintenanceLocks } from '../composables/useMaintenanceLocks.js';

const route = useRoute();
const router = useRouter();
const restoreConfirmation = ref(false);
const isBackupHistoryOpen = ref(false);
const isRestoreOpen = ref(false);
const isMaintenanceOpen = ref(false);
const isDiagnosticsOpen = ref(false);

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
  actionError: lockActionError,
  errorMessage: lockErrorMessage,
  hasActiveLocks,
  isLoading: isLoadingLocks,
  isReleasing,
  loadLocks,
  locks: allLocks,
  releaseLock,
} = useMaintenanceLocks();

const {
  errorMessage: diagnosticsErrorMessage,
  isLoading: isLoadingDiagnostics,
  loadDiagnostics,
  recentFailedRuns,
  recentPrivilegedActions,
  recentQueueRuns,
  queueDiagnostics,
  recoveryDiagnostics,
} = useRecoveryDiagnostics();

const recoveryRouteState = computed(() => normalizeRecoveryRouteState(route.query));
const recoveryPosture = computed(() => buildSettingsRecoveryPosture({
  backupArtifacts: backupArtifacts.value,
  backupErrorMessage: backupErrorMessage.value,
  hasActiveLocks: hasActiveLocks.value,
  isLoadingBackups: isLoadingBackups.value,
  isLoadingPreview: isLoadingPreview.value,
  previewErrorMessage: previewErrorMessage.value,
  selectedBackupPreview: selectedBackupPreview.value,
}));
const backupStatusPill = computed(() => {
  if (!selectedBackupPreview.value) return null;
  if (selectedBackupPreview.value.canApplyRestore) return { className: 'review-status-selected', label: 'Restore ready' };
  if (selectedBackupPreview.value.restoreReadiness?.blockedByLock) return { className: 'review-status-held', label: 'Blocked' };
  return { className: 'review-status-failed', label: 'Needs review' };
});
const restoreRunTarget = computed(() => buildOperationRunLinkTarget({
  operationType: lastRestoreRun.value?.operationType,
  runId: lastRestoreRun.value?.id,
}));

function buildMergedRecoveryRouteQuery(nextState) {
  const query = { ...route.query };
  delete query.backupArtifactId;
  return {
    ...query,
    ...buildRecoveryRouteQuery({ ...recoveryRouteState.value, ...nextState }),
  };
}

async function replaceRecoveryRouteState(nextState) {
  const normalizedNextState = normalizeRecoveryRouteState({ ...recoveryRouteState.value, ...nextState });
  if (getRecoveryRouteStateKey(normalizedNextState) === getRecoveryRouteStateKey(recoveryRouteState.value)) return;
  await router.replace({ query: buildMergedRecoveryRouteQuery(normalizedNextState), hash: route.hash });
}

async function refreshRecoveryStatus() {
  await Promise.all([
    loadBackups({ preferredBackupArtifactId: selectedBackupId.value || null }),
    loadLocks(),
  ]);
}

async function handleCreateBackup() {
  const result = await createBackup();
  if (!result) return;
  isBackupHistoryOpen.value = true;
  await replaceRecoveryRouteState({ backupArtifactId: selectedBackupId.value ?? '' });
}

async function handleDeleteBackup() {
  const result = await deleteSelectedBackup();
  if (!result) return;
  restoreConfirmation.value = false;
  await replaceRecoveryRouteState({ backupArtifactId: selectedBackupId.value ?? '' });
}

async function handleApplyRestore() {
  const result = await applyRestore({
    expectedPayloadSha256: selectedBackupPreview.value?.integrity?.expectedPayloadSha256 ?? null,
  });
  if (!result) return;
  restoreConfirmation.value = false;
  await refreshSelectedBackupPreview();
}

async function selectBackupForRestore(backupArtifactId) {
  isRestoreOpen.value = true;
  await selectBackupArtifact(backupArtifactId);
}

onMounted(async () => {
  await Promise.all([
    loadBackups({ preferredBackupArtifactId: recoveryRouteState.value.backupArtifactId || null }),
    loadLocks(),
    loadDiagnostics(),
  ]);

  if (recoveryRouteState.value.backupArtifactId) isRestoreOpen.value = true;
  if (selectedBackupId.value !== recoveryRouteState.value.backupArtifactId) {
    await replaceRecoveryRouteState({ backupArtifactId: selectedBackupId.value ?? '' });
  }
});

watch(selectedBackupId, (nextBackupArtifactId) => {
  restoreConfirmation.value = false;
  if ((nextBackupArtifactId ?? '') === recoveryRouteState.value.backupArtifactId) return;
  void replaceRecoveryRouteState({ backupArtifactId: nextBackupArtifactId ?? '' });
});

watch(() => recoveryRouteState.value.backupArtifactId, (nextBackupArtifactId, previousBackupArtifactId) => {
  if (nextBackupArtifactId === previousBackupArtifactId || nextBackupArtifactId === selectedBackupId.value) return;
  if (!nextBackupArtifactId) return;
  isRestoreOpen.value = true;
  void selectBackupArtifact(nextBackupArtifactId);
});

watch(hasActiveLocks, (nextHasActiveLocks) => {
  if (nextHasActiveLocks) isMaintenanceOpen.value = true;
});
</script>

<template>
  <div class="cfg-page recovery-workspace">
    <article class="hx-card recovery-workspace__posture">
      <header class="hx-card-header">
        <div>
          <h2 class="hx-card-title">Recovery status</h2>
          <p class="hx-card-subtitle">Saved backup and maintenance status reported by the server.</p>
        </div>
        <span class="hx-pill" :data-tone="recoveryPosture.tone">{{ recoveryPosture.statusLabel }}</span>
      </header>
      <div class="hx-card-body">
        <p class="recovery-workspace__posture-message" role="status" aria-atomic="true">{{ recoveryPosture.message }}</p>
        <div v-if="recoveryPosture.checks.length" class="recovery-workspace__posture-checks">
          <div v-for="check in recoveryPosture.checks" :key="check.label" class="recovery-workspace__posture-check">
            <span>{{ check.label }}</span>
            <span class="hx-pill" :data-tone="check.tone">{{ check.statusLabel }}</span>
          </div>
        </div>
        <div class="hx-card-actions">
          <button type="button" class="hx-btn" @click="refreshRecoveryStatus" :disabled="isLoadingBackups || isLoadingLocks">
            {{ isLoadingBackups || isLoadingLocks ? 'Refreshing...' : 'Refresh status' }}
          </button>
          <button type="button" class="hx-btn" data-variant="primary" @click="handleCreateBackup" :disabled="isCreating">
            {{ isCreating ? 'Creating...' : 'Create backup' }}
          </button>
        </div>
        <p v-if="backupActionErrorMessage" class="recovery-workspace__error">{{ backupActionErrorMessage }}</p>
        <p v-else-if="backupErrorMessage" class="recovery-workspace__error">{{ backupErrorMessage }}</p>
      </div>
    </article>

    <section class="recovery-workspace__tasks" aria-labelledby="recovery-tasks-heading">
      <div class="recovery-workspace__tasks-header">
        <h2 id="recovery-tasks-heading" class="hx-card-title">Recovery tasks</h2>
        <p class="hx-text-muted">Create or inspect a backup when needed. Restore and maintenance controls stay separate because they can change current data or pause work.</p>
      </div>

      <SettingsDisclosure
        v-model:open="isBackupHistoryOpen"
        panel-id="settings-recovery-backup-history"
        :heading-level="3"
        title="Review backup history"
        subtitle="Choose a saved backup to inspect its recovery checks."
        show-label="Review backups"
        hide-label="Hide backup history"
      >
        <div class="hx-card-actions">
          <button type="button" class="hx-btn" @click="loadBackups({ preferredBackupArtifactId: selectedBackupId || null })" :disabled="isLoadingBackups">
            {{ isLoadingBackups ? 'Refreshing...' : 'Refresh backups' }}
          </button>
        </div>
        <p v-if="isLoadingBackups" class="hx-text-muted">Loading backups...</p>
        <div v-else-if="!backupArtifacts.length" class="hx-empty">
          <h4 class="hx-empty-title">No backups yet</h4>
          <p class="hx-empty-copy">Create a backup before making changes you may need to undo.</p>
        </div>
        <div v-else class="cfg-mapping-list recovery-workspace__list">
          <div v-for="backupArtifact in backupArtifacts" :key="backupArtifact.id" class="cfg-mapping-card">
            <div class="recovery-workspace__list-row">
              <div>
                <p class="recovery-workspace__eyebrow">{{ formatScope(backupArtifact.backupType) }}</p>
                <strong>{{ backupArtifact.filename }}</strong>
                <p class="hx-text-muted">Created {{ formatTimestamp(backupArtifact.createdAt) }}</p>
                <p class="hx-text-muted">{{ backupArtifact.encrypted ? 'Encrypted' : 'Not encrypted' }} - {{ formatBytes(backupArtifact.fileSizeBytes) }} - {{ backupArtifact.appVersion ?? 'Unknown version' }}</p>
              </div>
              <div class="recovery-workspace__list-actions">
                <span class="review-status-pill" :class="backupArtifact.id === selectedBackupId ? 'review-status-selected' : 'review-status-held'">
                  {{ backupArtifact.id === selectedBackupId ? 'Selected' : 'Available' }}
                </span>
                <button type="button" class="hx-btn" @click="selectBackupForRestore(backupArtifact.id)">Review restore</button>
              </div>
            </div>
          </div>
        </div>
      </SettingsDisclosure>

      <SettingsDisclosure
        v-model:open="isRestoreOpen"
        panel-id="settings-recovery-restore"
        :heading-level="3"
        title="Restore a backup"
        subtitle="Review compatibility before applying a backup. Applying it changes current data immediately."
        show-label="Restore a backup"
        hide-label="Hide restore details"
      >
        <p v-if="previewErrorMessage" class="recovery-workspace__error">{{ previewErrorMessage }}</p>
        <div v-if="!selectedBackupArtifact" class="hx-empty">
          <h4 class="hx-empty-title">Choose a backup first</h4>
          <p class="hx-empty-copy">Open backup history and choose a file before reviewing restore checks.</p>
        </div>
        <template v-else>
          <div class="recovery-workspace__selected-backup">
            <div>
              <p class="recovery-workspace__eyebrow">{{ formatScope(selectedBackupArtifact.backupType) }}</p>
              <strong>{{ selectedBackupArtifact.filename }}</strong>
              <p class="hx-text-muted">Created {{ formatTimestamp(selectedBackupArtifact.createdAt) }}</p>
            </div>
            <span v-if="backupStatusPill" class="review-status-pill" :class="backupStatusPill.className">{{ backupStatusPill.label }}</span>
          </div>

          <div class="cfg-group">
            <p class="cfg-group-title">Restore check</p>
            <p class="hx-text-muted">{{ describeRestoreReadiness(selectedBackupPreview) }}</p>
            <div class="hx-card-actions">
              <button type="button" class="hx-btn" @click="refreshSelectedBackupPreview" :disabled="isLoadingPreview">
                {{ isLoadingPreview ? 'Checking...' : 'Refresh checks' }}
              </button>
            </div>
            <dl v-if="selectedBackupPreview" class="review-meta-grid">
              <div><dt>Format version</dt><dd>{{ selectedBackupArtifact.formatVersion }}</dd></div>
              <div><dt>Migration level</dt><dd>{{ selectedBackupArtifact.migrationLevel }}</dd></div>
              <div><dt>Encrypted</dt><dd>{{ selectedBackupArtifact.encrypted ? 'Yes' : 'No' }}</dd></div>
              <div><dt>File size</dt><dd>{{ formatBytes(selectedBackupArtifact.fileSizeBytes) }}</dd></div>
              <div><dt>Scopes</dt><dd>{{ selectedBackupArtifact.scope?.length ? selectedBackupArtifact.scope.map(formatScope).join(', ') : 'Unknown' }}</dd></div>
            </dl>
          </div>

          <div v-if="selectedBackupPreview" class="cfg-group">
            <p class="cfg-group-title">Compatibility checks</p>
            <p class="hx-text-muted">Checked {{ formatTimestamp(selectedBackupPreview.checkedAt) }}</p>
            <div class="cfg-mapping-list recovery-workspace__list">
              <div v-for="check in selectedBackupPreview.compatibility?.checks ?? []" :key="check.code" class="cfg-mapping-card recovery-workspace__check">
                <div><strong>{{ check.message }}</strong><p class="hx-text-muted">{{ check.code }}</p></div>
                <span class="review-status-pill" :class="checkStatusClass(check.status)">{{ checkStatusLabel(check.status) }}</span>
              </div>
            </div>
          </div>

          <div v-if="selectedBackupPreview" class="cfg-group">
            <p class="cfg-group-title">Apply restore</p>
            <p class="hx-text-muted">This replaces the scopes in this backup immediately. It does not restore anything until the server accepts this confirmed action.</p>
            <label class="cfg-check recovery-workspace__confirmation">
              <input v-model="restoreConfirmation" type="checkbox" />
              <span>I reviewed this backup and understand it will change current data immediately.</span>
            </label>
            <div class="hx-card-actions">
              <button type="button" class="hx-btn" data-variant="primary" @click="handleApplyRestore" :disabled="!selectedBackupPreview.canApplyRestore || !restoreConfirmation || isApplyingRestore">
                {{ isApplyingRestore ? 'Applying...' : 'Apply restore' }}
              </button>
              <RouterLink v-if="restoreRunTarget" class="hx-btn" :to="restoreRunTarget.to">{{ restoreRunTarget.label }}</RouterLink>
            </div>
            <div v-if="lastRestoreResult" class="cfg-mapping-card recovery-workspace__last-result">
              <p class="cfg-group-title">Last restore result</p>
              <dl class="review-meta-grid">
                <div><dt>Applied scopes</dt><dd>{{ lastRestoreResult.appliedScopes?.length ? lastRestoreResult.appliedScopes.map(formatScope).join(', ') : 'None' }}</dd></div>
                <div><dt>Skipped scopes</dt><dd>{{ lastRestoreResult.skippedScopes?.length ? lastRestoreResult.skippedScopes.map(formatScope).join(', ') : 'None' }}</dd></div>
              </dl>
            </div>
          </div>

          <SettingsDisclosure
            panel-id="settings-recovery-file-actions"
            :heading-level="4"
            title="Backup file actions"
            subtitle="Download a copy or permanently delete this saved backup."
            show-label="Show file actions"
            hide-label="Hide file actions"
            variant="inline"
          >
            <div class="hx-card-actions">
              <a class="hx-btn" :href="buildBackupExportDownloadUrl(selectedBackupId)">Download backup</a>
              <button type="button" class="hx-btn" data-variant="danger" @click="handleDeleteBackup" :disabled="isDeleting">{{ isDeleting ? 'Deleting...' : 'Delete backup' }}</button>
            </div>
          </SettingsDisclosure>
        </template>
      </SettingsDisclosure>

      <SettingsDisclosure
        v-model:open="isMaintenanceOpen"
        panel-id="settings-recovery-maintenance"
        :heading-level="3"
        title="Recovery maintenance"
        subtitle="Review operations that pause background work and filesystem changes."
        show-label="Review maintenance"
        hide-label="Hide maintenance"
      >
        <div class="hx-card-actions"><button type="button" class="hx-btn" @click="loadLocks" :disabled="isLoadingLocks">{{ isLoadingLocks ? 'Refreshing...' : 'Refresh maintenance' }}</button></div>
        <p v-if="lockActionError" class="recovery-workspace__error">{{ lockActionError }}</p>
        <p v-else-if="lockErrorMessage" class="recovery-workspace__error">{{ lockErrorMessage }}</p>
        <p v-else-if="isLoadingLocks" class="hx-text-muted">Loading recovery maintenance...</p>
        <div v-else-if="!allLocks.length" class="hx-empty"><h4 class="hx-empty-title">No maintenance recorded</h4><p class="hx-empty-copy">Recovery maintenance appears here when the app pauses work to protect data.</p></div>
        <div v-else class="cfg-mapping-list recovery-workspace__list">
          <div v-for="lock in allLocks" :key="lock.id" class="cfg-mapping-card">
            <div class="recovery-workspace__list-row">
              <div>
                <div class="recovery-workspace__lock-status"><span class="hx-pill" :data-tone="getLockStatusTone(lock)">{{ formatLockStatus(lock) }}</span><span class="hx-pill">{{ formatLockType(lock.lockType) }}</span></div>
                <p class="hx-text-muted">{{ describeLockImpact(lock.lockType) }}</p>
                <p class="hx-text-muted"><span v-if="lock.reason">Reason: {{ lock.reason }} - </span>Acquired {{ formatDiagnosticTimestamp(lock.acquiredAt ?? lock.createdAt) }} - Expires {{ formatLockExpiresAt(lock) }}</p>
              </div>
              <button v-if="formatLockStatus(lock) === 'Active'" type="button" class="hx-btn" data-variant="danger" :disabled="isReleasing" @click="releaseLock(lock.id)">{{ isReleasing ? 'Releasing...' : 'Release lock' }}</button>
            </div>
          </div>
        </div>
      </SettingsDisclosure>

      <SettingsDisclosure
        v-model:open="isDiagnosticsOpen"
        panel-id="settings-recovery-diagnostics"
        :heading-level="3"
        title="Recovery diagnostics"
        subtitle="Review queue state, failures, and privileged recovery activity when recovery needs investigation."
        show-label="Open diagnostics"
        hide-label="Hide diagnostics"
      >
        <div class="hx-card-actions"><button type="button" class="hx-btn" @click="loadDiagnostics" :disabled="isLoadingDiagnostics">{{ isLoadingDiagnostics ? 'Refreshing...' : 'Refresh diagnostics' }}</button></div>
        <p v-if="diagnosticsErrorMessage" class="recovery-workspace__error">{{ diagnosticsErrorMessage }}</p>
        <div v-else-if="isLoadingDiagnostics" class="hx-empty"><p class="hx-empty-copy">Loading diagnostics...</p></div>
        <template v-else-if="queueDiagnostics || recoveryDiagnostics">
          <div v-if="queueDiagnostics" class="cfg-group"><p class="cfg-group-title">Queue overview</p><dl class="review-meta-grid"><div><dt>Pending</dt><dd>{{ queueDiagnostics.pendingCount ?? 0 }}</dd></div><div><dt>Running</dt><dd>{{ queueDiagnostics.runningCount ?? 0 }}</dd></div><div><dt>Failed</dt><dd>{{ queueDiagnostics.failedCount ?? 0 }}</dd></div><div><dt>Completed</dt><dd>{{ queueDiagnostics.completedCount ?? 0 }}</dd></div></dl></div>
          <div v-if="recentQueueRuns.length" class="cfg-group"><p class="cfg-group-title">Recent queue runs</p><div class="cfg-mapping-list recovery-workspace__list"><div v-for="run in recentQueueRuns.slice(0, 5)" :key="run.operationType + (run.startedAt ?? run.createdAt)" class="cfg-mapping-card recovery-workspace__check"><div><strong>{{ run.operationType }}</strong><p class="hx-text-muted">{{ formatDiagnosticTimestamp(run.startedAt) }}</p></div><span class="hx-pill" :data-tone="run.status === 'completed' ? 'success' : run.status === 'failed' ? 'danger' : null">{{ run.status }}</span></div></div></div>
          <div v-if="recentFailedRuns.length" class="cfg-group"><p class="cfg-group-title">Recent failures</p><div class="cfg-mapping-list recovery-workspace__list"><div v-for="failed in recentFailedRuns.slice(0, 5)" :key="failed.operationType + (failed.recentFailureAt ?? '')" class="cfg-mapping-card"><strong>{{ failed.operationType }}</strong><p class="hx-text-muted">Last failure {{ formatDiagnosticTimestamp(failed.recentFailureAt) }}</p><p v-if="failed.recentFailureMessage" class="hx-text-muted">{{ failed.recentFailureMessage }}</p><p class="hx-text-muted">{{ failed.recentFailureCount ?? 0 }} failure{{ failed.recentFailureCount === 1 ? '' : 's' }}</p></div></div></div>
          <div v-if="recentPrivilegedActions.length" class="cfg-group"><p class="cfg-group-title">Recent privileged actions</p><div class="cfg-mapping-list recovery-workspace__list"><div v-for="action in recentPrivilegedActions.slice(0, 5)" :key="action.eventName + (action.occurredAt ?? '')" class="cfg-mapping-card"><strong>{{ action.eventName }}</strong><p class="hx-text-muted">{{ formatDiagnosticTimestamp(action.occurredAt) }}<span v-if="action.actorUserId"> - by {{ action.actorUserId }}</span></p></div></div></div>
          <div v-if="!recentQueueRuns.length && !recentFailedRuns.length && !recentPrivilegedActions.length" class="hx-empty"><p class="hx-empty-copy">No recent recovery activity to display.</p></div>
        </template>
        <div v-else class="hx-empty"><p class="hx-empty-copy">No diagnostics data available. Refresh to load current state.</p></div>
      </SettingsDisclosure>
    </section>
  </div>
</template>

<style scoped>
.recovery-workspace { display: grid; gap: var(--hx-space-5); }
.recovery-workspace__posture-message { color: var(--hx-text); margin: 0; }
.recovery-workspace__posture-checks { display: grid; gap: var(--hx-space-2); grid-template-columns: repeat(auto-fit, minmax(168px, 1fr)); margin: var(--hx-space-4) 0; }
.recovery-workspace__posture-check { align-items: center; border: 1px solid var(--hx-border-subtle); border-radius: var(--hx-radius-sm); display: flex; font-size: var(--hx-text-sm); gap: var(--hx-space-2); justify-content: space-between; padding: var(--hx-space-2) var(--hx-space-3); }
.recovery-workspace__tasks { display: grid; gap: var(--hx-space-3); }
.recovery-workspace__tasks-header { max-width: 760px; }
.recovery-workspace__tasks-header .hx-text-muted { margin: var(--hx-space-1) 0 0; }
.recovery-workspace__error { color: var(--hx-danger); font-size: var(--hx-text-sm); margin: var(--hx-space-3) 0 0; }
.recovery-workspace__list { margin-top: var(--hx-space-3); }
.recovery-workspace__list-row, .recovery-workspace__selected-backup, .recovery-workspace__check { align-items: flex-start; display: flex; gap: var(--hx-space-3); justify-content: space-between; }
.recovery-workspace__list-actions { align-items: flex-end; display: flex; flex-direction: column; flex: none; gap: var(--hx-space-2); }
.recovery-workspace__eyebrow { color: var(--hx-text-muted); font-size: var(--hx-text-xs); letter-spacing: 0.08em; margin: 0 0 var(--hx-space-1); text-transform: uppercase; }
.recovery-workspace__selected-backup { border-bottom: 1px solid var(--hx-border-subtle); padding-bottom: var(--hx-space-3); }
.recovery-workspace__selected-backup strong, .recovery-workspace__list-row strong { color: var(--hx-text-strong); }
.recovery-workspace__lock-status { display: flex; flex-wrap: wrap; gap: var(--hx-space-2); margin-bottom: var(--hx-space-2); }
.recovery-workspace__confirmation { margin-top: var(--hx-space-3); }
.recovery-workspace__last-result { margin-top: var(--hx-space-3); }
.cfg-check input[type="checkbox"] { flex: none; width: auto; }
@media (max-width: 640px) { .recovery-workspace__list-row, .recovery-workspace__selected-backup, .recovery-workspace__check { flex-direction: column; } .recovery-workspace__list-actions { align-items: flex-start; } }
</style>
