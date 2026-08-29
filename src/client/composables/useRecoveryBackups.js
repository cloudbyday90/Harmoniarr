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

import { computed, ref } from 'vue';
import { isAbortError } from '../lib/abort-error.js';
import { getErrorMessage } from '../lib/error-utils.js';
import { createLatestRequestGate } from '../lib/latest-request-gate.js';
import {
  deleteBackupExport as defaultDeleteBackupExport,
  fetchBackupExportById as defaultFetchBackupExportById,
  fetchBackupExports as defaultFetchBackupExports,
  fetchBackupRestorePreview as defaultFetchBackupRestorePreview,
  startBackupExport as defaultStartBackupExport,
  startBackupRestoreApply as defaultStartBackupRestoreApply,
} from '../lib/recovery-api.js';

export function useRecoveryBackups({
  deleteBackupExport = defaultDeleteBackupExport,
  fetchBackupExportById = defaultFetchBackupExportById,
  fetchBackupExports = defaultFetchBackupExports,
  fetchBackupRestorePreview = defaultFetchBackupRestorePreview,
  startBackupExport = defaultStartBackupExport,
  startBackupRestoreApply = defaultStartBackupRestoreApply,
} = {}) {
  const backupsPayload = ref(null);
  const selectedBackupArtifact = ref(null);
  const selectedBackupId = ref(null);
  const selectedBackupPreview = ref(null);
  const actionErrorMessage = ref('');
  const errorMessage = ref('');
  const previewErrorMessage = ref('');
  const isApplyingRestore = ref(false);
  const isCreating = ref(false);
  const isDeleting = ref(false);
  const isLoading = ref(true);
  const isLoadingPreview = ref(false);
  const lastCreatedBackupArtifact = ref(null);
  const lastRestoreResult = ref(null);
  const lastRestoreRun = ref(null);
  const selectionRequestGate = createLatestRequestGate();

  const backupArtifacts = computed(() => backupsPayload.value?.backupArtifacts ?? []);

  function clearSelection() {
    selectionRequestGate.invalidate();
    selectedBackupArtifact.value = null;
    selectedBackupId.value = null;
    selectedBackupPreview.value = null;
    previewErrorMessage.value = '';
  }

  async function selectBackupArtifact(backupArtifactId) {
    if (typeof backupArtifactId !== 'string' || backupArtifactId.trim().length === 0) {
      clearSelection();
      return;
    }

    const normalizedBackupArtifactId = backupArtifactId.trim();
    const request = selectionRequestGate.begin();
    selectedBackupId.value = normalizedBackupArtifactId;
    previewErrorMessage.value = '';
    selectedBackupPreview.value = null;
    selectedBackupArtifact.value = backupArtifacts.value.find((entry) => entry.id === normalizedBackupArtifactId) ?? null;
    isLoadingPreview.value = true;

    try {
      const [backupExportPayload, backupPreviewPayload] = await Promise.all([
        fetchBackupExportById(normalizedBackupArtifactId, { signal: request.signal }),
        fetchBackupRestorePreview(normalizedBackupArtifactId, { signal: request.signal }),
      ]);

      if (!request.isCurrent()) {
        return;
      }

      selectedBackupArtifact.value = backupExportPayload.backupArtifact ?? null;
      selectedBackupPreview.value = backupPreviewPayload ?? null;
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }

      if (request.isCurrent()) {
        selectedBackupArtifact.value = null;
        selectedBackupPreview.value = null;
        previewErrorMessage.value = getErrorMessage(error, 'Backup preview failed');
      }
    } finally {
      if (request.isCurrent()) {
        isLoadingPreview.value = false;
      }
    }
  }

  async function refreshSelectedBackupPreview() {
    if (!selectedBackupId.value) {
      return;
    }

    await selectBackupArtifact(selectedBackupId.value);
  }

  async function loadBackups({ preferredBackupArtifactId = selectedBackupId.value } = {}) {
    isLoading.value = true;
    errorMessage.value = '';

    try {
      backupsPayload.value = await fetchBackupExports();
      const nextBackupArtifactId = preferredBackupArtifactId
        || backupsPayload.value?.backupArtifacts?.[0]?.id
        || null;

      if (nextBackupArtifactId) {
        await selectBackupArtifact(nextBackupArtifactId);
      } else {
        clearSelection();
      }
    } catch (error) {
      backupsPayload.value = null;
      clearSelection();
      errorMessage.value = getErrorMessage(error, 'Backup inventory failed');
    } finally {
      isLoading.value = false;
    }
  }

  async function createBackup() {
    isCreating.value = true;
    actionErrorMessage.value = '';
    lastCreatedBackupArtifact.value = null;

    try {
      const result = await startBackupExport();
      lastCreatedBackupArtifact.value = result.backupArtifact ?? null;
      await loadBackups({ preferredBackupArtifactId: result.backupArtifact?.id ?? null });
      return result;
    } catch (error) {
      actionErrorMessage.value = getErrorMessage(error, 'Backup export failed');
      return null;
    } finally {
      isCreating.value = false;
    }
  }

  async function deleteSelectedBackup() {
    if (!selectedBackupId.value) {
      return null;
    }

    isDeleting.value = true;
    actionErrorMessage.value = '';

    try {
      const deletedBackupId = selectedBackupId.value;
      const nextBackupArtifactId = backupArtifacts.value.find((entry) => entry.id !== deletedBackupId)?.id ?? null;
      const result = await deleteBackupExport(deletedBackupId);
      await loadBackups({ preferredBackupArtifactId: nextBackupArtifactId });
      return result;
    } catch (error) {
      actionErrorMessage.value = getErrorMessage(error, 'Backup delete failed');
      return null;
    } finally {
      isDeleting.value = false;
    }
  }

  async function applyRestore({ expectedPayloadSha256 } = {}) {
    if (!selectedBackupId.value) {
      return null;
    }

    isApplyingRestore.value = true;
    actionErrorMessage.value = '';

    try {
      const result = await startBackupRestoreApply(selectedBackupId.value, {
        expectedPayloadSha256,
      });
      lastRestoreResult.value = result.restoreResult ?? null;
      lastRestoreRun.value = result.run ?? null;
      return result;
    } catch (error) {
      actionErrorMessage.value = getErrorMessage(error, 'Restore apply failed');
      return null;
    } finally {
      isApplyingRestore.value = false;
    }
  }

  return {
    actionErrorMessage,
    applyRestore,
    backupArtifacts,
    backupsPayload,
    createBackup,
    deleteSelectedBackup,
    errorMessage,
    isApplyingRestore,
    isCreating,
    isDeleting,
    isLoading,
    isLoadingPreview,
    lastCreatedBackupArtifact,
    lastRestoreResult,
    lastRestoreRun,
    loadBackups,
    previewErrorMessage,
    refreshSelectedBackupPreview,
    selectBackupArtifact,
    selectedBackupArtifact,
    selectedBackupId,
    selectedBackupPreview,
  };
}
