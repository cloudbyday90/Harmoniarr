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
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
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
import { useRecoveryBackups } from '../composables/useRecoveryBackups.js';

const route = useRoute();
const router = useRouter();
const restoreConfirmation = ref(false);

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

const recoveryRouteState = computed(() => normalizeRecoveryRouteState(route.query));
const backupStatusPill = computed(() => {
  if (!selectedBackupPreview.value) {
    return null;
  }

  if (selectedBackupPreview.value.canApplyRestore) {
    return { className: 'review-status-selected', label: 'Restore ready' };
  }

  if (selectedBackupPreview.value.restoreReadiness?.blockedByLock) {
    return { className: 'review-status-held', label: 'Blocked' };
  }

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

async function handleCreateBackup() {
  const result = await createBackup();
  if (!result) return;
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

onMounted(async () => {
  await loadBackups({ preferredBackupArtifactId: recoveryRouteState.value.backupArtifactId || null });

  if (selectedBackupId.value !== recoveryRouteState.value.backupArtifactId) {
    await replaceRecoveryRouteState({ backupArtifactId: selectedBackupId.value ?? '' });
  }
});

watch(
  selectedBackupId,
  (nextBackupArtifactId) => {
    restoreConfirmation.value = false;
    if ((nextBackupArtifactId ?? '') === recoveryRouteState.value.backupArtifactId) return;
    void replaceRecoveryRouteState({ backupArtifactId: nextBackupArtifactId ?? '' });
  },
);

watch(
  () => recoveryRouteState.value.backupArtifactId,
  (nextBackupArtifactId, previousBackupArtifactId) => {
    if (nextBackupArtifactId === previousBackupArtifactId || nextBackupArtifactId === selectedBackupId.value) return;
    if (!nextBackupArtifactId) return;
    void selectBackupArtifact(nextBackupArtifactId);
  },
);
</script>

<template>
  <div class="cfg-page">
    <div class="cfg-2col">

      <!-- Backups -->
      <article class="hx-card">
        <header class="hx-card-header">
          <div>
            <h3 class="hx-card-title">Backups</h3>
            <p class="hx-card-subtitle">Create and manage recovery exports of your settings, users, and library data.</p>
          </div>
        </header>
        <div class="hx-card-body">
          <div class="hx-card-actions">
            <button type="button" class="hx-btn" @click="loadBackups({ preferredBackupArtifactId: selectedBackupId || null })" :disabled="isLoadingBackups">
              {{ isLoadingBackups ? 'Refreshing…' : 'Refresh' }}
            </button>
            <button type="button" class="hx-btn" data-variant="primary" @click="handleCreateBackup" :disabled="isCreating">
              {{ isCreating ? 'Creating…' : 'Create backup' }}
            </button>
          </div>

          <p style="font-size: var(--hx-text-sm); color: var(--hx-danger); margin-top: var(--hx-space-2)" v-if="backupActionErrorMessage">{{ backupActionErrorMessage }}</p>
          <p style="font-size: var(--hx-text-sm); color: var(--hx-danger); margin-top: var(--hx-space-2)" v-else-if="backupErrorMessage">{{ backupErrorMessage }}</p>
          <p class="hx-text-muted" style="margin-top: var(--hx-space-2)" v-else-if="isLoadingBackups">Loading backups…</p>

          <div class="hx-empty" v-else-if="!backupArtifacts.length">
            <p class="hx-empty-copy">No backups yet. Click Create backup to make your first one.</p>
          </div>

          <div class="cfg-mapping-list" v-else style="margin-top: var(--hx-space-3)">
            <div class="cfg-mapping-card" v-for="backupArtifact in backupArtifacts" :key="backupArtifact.id">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: var(--hx-space-3)">
                <div>
                  <p style="font-size: var(--hx-text-xs); text-transform: uppercase; letter-spacing: 0.08em; color: var(--hx-text-muted); margin-bottom: var(--hx-space-1)">{{ formatScope(backupArtifact.backupType) }}</p>
                  <strong>{{ backupArtifact.filename }}</strong>
                  <p class="hx-text-muted">Created {{ formatTimestamp(backupArtifact.createdAt) }}</p>
                  <p class="hx-text-muted">{{ backupArtifact.encrypted ? 'Encrypted' : 'Plaintext' }} · {{ formatBytes(backupArtifact.fileSizeBytes) }} · {{ backupArtifact.appVersion ?? 'Unknown version' }}</p>
                </div>
                <div style="display: flex; flex-direction: column; gap: var(--hx-space-2); align-items: flex-end; flex-shrink: 0">
                  <span class="review-status-pill" :class="backupArtifact.id === selectedBackupId ? 'review-status-selected' : 'review-status-held'">
                    {{ backupArtifact.id === selectedBackupId ? 'Selected' : 'Available' }}
                  </span>
                  <button type="button" class="hx-btn" @click="selectBackupArtifact(backupArtifact.id)">
                    Inspect
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </article>

      <!-- Restore -->
      <article class="hx-card">
        <header class="hx-card-header">
          <div>
            <h3 class="hx-card-title">Restore</h3>
            <p class="hx-card-subtitle">Preview a backup and apply it when you're ready.</p>
          </div>
          <span v-if="backupStatusPill" class="review-status-pill" :class="backupStatusPill.className">
            {{ backupStatusPill.label }}
          </span>
        </header>
        <div class="hx-card-body">
          <p style="font-size: var(--hx-text-sm); color: var(--hx-danger)" v-if="previewErrorMessage">{{ previewErrorMessage }}</p>

          <div class="hx-empty" v-if="!selectedBackupArtifact">
            <p class="hx-empty-copy">Select a backup to see whether it's safe to restore.</p>
          </div>

          <template v-else>
            <div class="cfg-group" style="padding-top: 0; border-top: none">
              <p style="font-size: var(--hx-text-xs); text-transform: uppercase; letter-spacing: 0.08em; color: var(--hx-text-muted); margin-bottom: var(--hx-space-1)">{{ formatScope(selectedBackupArtifact.backupType) }}</p>
              <strong>{{ selectedBackupArtifact.filename }}</strong>
              <p class="hx-text-muted">Created {{ formatTimestamp(selectedBackupArtifact.createdAt) }}</p>
              <div style="display: flex; gap: var(--hx-space-2); flex-wrap: wrap; margin-top: var(--hx-space-2)">
                <a class="hx-btn" :href="buildBackupExportDownloadUrl(selectedBackupId)">Download</a>
                <button type="button" class="hx-btn" @click="refreshSelectedBackupPreview" :disabled="isLoadingPreview">
                  {{ isLoadingPreview ? 'Refreshing…' : 'Refresh checks' }}
                </button>
                <button type="button" class="hx-btn" @click="handleDeleteBackup" :disabled="isDeleting">
                  {{ isDeleting ? 'Deleting…' : 'Delete' }}
                </button>
              </div>
            </div>

            <div class="cfg-group" v-if="selectedBackupPreview">
              <p class="cfg-group-title">Restore status</p>
              <p class="hx-text-muted">{{ describeRestoreReadiness(selectedBackupPreview) }}</p>
              <dl class="review-meta-grid" style="margin-top: var(--hx-space-3)">
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
                  <dt>Scopes</dt>
                  <dd>{{ selectedBackupArtifact.scope?.length ? selectedBackupArtifact.scope.map(formatScope).join(', ') : 'Unknown' }}</dd>
                </div>
              </dl>
            </div>

            <div class="cfg-group" v-if="selectedBackupPreview">
              <p class="cfg-group-title">Compatibility checks</p>
              <p class="hx-text-muted">Checked {{ formatTimestamp(selectedBackupPreview.checkedAt) }}</p>
              <div class="cfg-mapping-list" style="margin-top: var(--hx-space-2)">
                <div class="cfg-mapping-card" v-for="check in selectedBackupPreview.compatibility?.checks ?? []" :key="check.code" style="display: flex; justify-content: space-between; align-items: center; gap: var(--hx-space-3)">
                  <div>
                    <strong>{{ check.message }}</strong>
                    <p class="hx-text-muted">{{ check.code }}</p>
                  </div>
                  <span class="review-status-pill" :class="checkStatusClass(check.status)" style="flex-shrink: 0">
                    {{ checkStatusLabel(check.status) }}
                  </span>
                </div>
              </div>
            </div>

            <div class="cfg-group" v-if="selectedBackupPreview">
              <p class="cfg-group-title">Apply restore</p>
              <p class="hx-text-muted">Applying this backup replaces your current settings, users, or library data — depending on the scopes in this file. This happens immediately.</p>
              <label class="cfg-check" style="margin-top: var(--hx-space-2)">
                <input v-model="restoreConfirmation" type="checkbox" />
                <span>I've reviewed this backup and understand it will change current data immediately.</span>
              </label>
              <div class="hx-card-actions">
                <button
                  type="button"
                  class="hx-btn"
                  data-variant="primary"
                  @click="handleApplyRestore"
                  :disabled="!selectedBackupPreview?.canApplyRestore || !restoreConfirmation || isApplyingRestore"
                >
                  {{ isApplyingRestore ? 'Applying…' : 'Apply restore' }}
                </button>
                <RouterLink v-if="restoreRunTarget" class="hx-btn" :to="restoreRunTarget.to">
                  {{ restoreRunTarget.label }}
                </RouterLink>
              </div>
              <div class="cfg-mapping-card" v-if="lastRestoreResult" style="margin-top: var(--hx-space-3)">
                <p class="cfg-group-title">Last restore result</p>
                <dl class="review-meta-grid">
                  <div>
                    <dt>Applied scopes</dt>
                    <dd>{{ lastRestoreResult.appliedScopes?.length ? lastRestoreResult.appliedScopes.map(formatScope).join(', ') : 'None' }}</dd>
                  </div>
                  <div>
                    <dt>Skipped scopes</dt>
                    <dd>{{ lastRestoreResult.skippedScopes?.length ? lastRestoreResult.skippedScopes.map(formatScope).join(', ') : 'None' }}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </template>
        </div>
      </article>
    </div>

  </div>
</template>

<style scoped>
.cfg-check input[type="checkbox"] {
  flex: none;
  width: auto;
}
</style>
