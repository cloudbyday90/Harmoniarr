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
import { nextTick, watch } from 'vue';
import {
  candidateStatusLabel,
  formatBytes,
  formatPath,
  formatTimestamp,
  formatTokenLabel,
  formatUploaderReviewState,
  formatUploaderReviewTone,
  formatUploaderReputationEvidence,
} from '../lib/import-candidate-presentation.js';
import { formatFileDuration } from '../lib/track-duration.js';

const props = defineProps({
  applyPreview: {
    type: Object,
    default: null,
  },
  applyPreviewError: {
    type: String,
    default: '',
  },
  canManageCandidates: {
    type: Boolean,
    default: true,
  },
  fileDecisionError: {
    type: String,
    default: '',
  },
  focusedFileId: {
    type: String,
    default: '',
  },
  candidate: {
    type: Object,
    default: null,
  },
  detailError: {
    type: String,
    default: '',
  },
  isLoadingCandidate: {
    type: Boolean,
    default: false,
  },
  isLoadingApplyPreview: {
    type: Boolean,
    default: false,
  },
  isLoadingPreview: {
    type: Boolean,
    default: false,
  },
  isUpdatingFileDecision: {
    type: Boolean,
    default: false,
  },
  isTransitionPending: {
    type: Boolean,
    default: false,
  },
  pendingFileDecisionId: {
    type: String,
    default: '',
  },
  preview: {
    type: Object,
    default: null,
  },
  previewError: {
    type: String,
    default: '',
  },
});

const fileItemRefs = new Map();

function applyFileStatusClass(code) {
  switch (code) {
    case 'blocked':
    case 'collision':
      return 'review-status-failed';
    case 'skipped':
      return 'review-status-held';
    default:
      return 'review-status-import_pending';
  }
}

function applyFileStatusLabel(code) {
  switch (code) {
    case 'blocked':
      return 'Missing source';
    case 'collision':
      return 'Collision';
    case 'skipped':
      return 'Skipped';
    default:
      return 'Ready';
  }
}

function canSkipApplyFile(filePreview) {
  return filePreview?.status?.code === 'collision';
}

function canClearApplyFileDecision(filePreview) {
  return filePreview?.decision?.decisionType === 'skip';
}

function fileDecisionButtonLabel(filePreview) {
  if (props.isUpdatingFileDecision && props.pendingFileDecisionId === filePreview?.fileId) {
    return 'Saving...';
  }

  return canClearApplyFileDecision(filePreview) ? 'Clear skip' : 'Skip file';
}

function normalizeId(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function setFileItemRef(fileId, element) {
  const normalizedFileId = normalizeId(fileId);
  if (!normalizedFileId) {
    return;
  }

  if (element) {
    fileItemRefs.set(normalizedFileId, element);
  } else {
    fileItemRefs.delete(normalizedFileId);
  }
}

function isFocusedCandidateFile(file) {
  return normalizeId(file?.id) !== '' && normalizeId(file?.id) === normalizeId(props.focusedFileId);
}

async function focusCandidateFile(fileId) {
  const normalizedFileId = normalizeId(fileId);
  if (
    !normalizedFileId
    || props.isLoadingCandidate
    || !props.candidate?.files?.some((file) => file.id === normalizedFileId)
  ) {
    return;
  }

  await nextTick();
  const fileItem = fileItemRefs.get(normalizedFileId);
  fileItem?.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
  });
  fileItem?.focus({ preventScroll: true });
}

watch(
  () => [
    props.focusedFileId,
    props.candidate?.id,
    props.candidate?.files?.length ?? 0,
    props.isLoadingCandidate,
  ],
  () => {
    void focusCandidateFile(props.focusedFileId);
  },
  { immediate: true },
);
</script>

<template>
  <article class="panel-light review-panel">
    <div class="section-header">
      <div>
        <p class="eyebrow">Match evidence</p>
        <h3>Files, paths, and checks</h3>
      </div>
      <span
        v-if="candidate"
        class="review-status-pill"
        :class="`review-status-${candidate.status}`"
      >
          {{ candidateStatusLabel(candidate.status) }}
      </span>
    </div>

    <article class="panel-light error-panel" v-if="detailError">
      <h3>Candidate detail unavailable</h3>
      <p>{{ detailError }}</p>
    </article>

    <article class="panel-light review-empty-state" v-else-if="isLoadingCandidate && !candidate">
      <h3>Loading match details</h3>
      <p>Loading match details…</p>
    </article>

    <article class="panel-light review-empty-state" v-else-if="!candidate">
      <h3>Select a match</h3>
      <p>Select a match to see its files and take action.</p>
    </article>

    <template v-else>
      <div class="review-detail-header">
        <div>
          <div class="eyebrow-row">
            <p class="eyebrow">{{ candidate.username }}</p>
            <span
              v-if="candidate.uploaderReputation"
              class="review-status-pill"
              :class="`review-reputation-${formatUploaderReviewTone(candidate.uploaderReputation.reviewState)}`"
            >{{ formatUploaderReviewState(candidate.uploaderReputation.reviewState) }}</span>
          </div>
          <h3>{{ candidate.folderPath || 'Root-level files' }}</h3>
        </div>
      </div>

      <dl class="review-meta-grid review-meta-grid-wide">
        <div>
          <dt>Files</dt>
          <dd>{{ candidate.fileCount }}</dd>
        </div>
        <div>
          <dt>Locked files</dt>
          <dd>{{ candidate.lockedFileCount }}</dd>
        </div>
        <div>
          <dt>Total size</dt>
          <dd>{{ formatBytes(candidate.totalSizeBytes) }}</dd>
        </div>
        <div>
          <dt>Discovered</dt>
          <dd>{{ formatTimestamp(candidate.discoveredAt) }}</dd>
        </div>
        <div v-if="candidate.uploaderReputation">
          <dt>Uploader</dt>
          <dd>{{ formatUploaderReputationEvidence(candidate.uploaderReputation) }}</dd>
        </div>
      </dl>

      <article class="panel-light review-preview-panel">
        <div class="section-header">
          <div>
            <p class="eyebrow">Planning preview</p>
            <h3>Path, staging, and naming</h3>
          </div>
        </div>

        <article class="panel-light review-empty-state" v-if="isLoadingPreview && !preview">
          <h3>Loading path preview</h3>
          <p>Loading path preview…</p>
        </article>

        <article class="panel-light error-panel" v-else-if="previewError">
          <h3>Preview unavailable</h3>
          <p>{{ previewError }}</p>
        </article>

        <template v-else-if="preview">
          <div class="review-warning-stack" v-if="preview.validation.warnings?.length || preview.validation.blockers?.length">
            <article class="review-warning-card" v-for="warning in preview.validation.warnings || []" :key="warning.code">
              <p>Warning</p>
              <strong>{{ warning.message }}</strong>
            </article>
            <article class="review-warning-card is-blocker" v-for="blocker in preview.validation.blockers || []" :key="blocker.code">
              <p>Blocker</p>
              <strong>{{ blocker.message }}</strong>
            </article>
          </div>

          <div class="metadata-card-grid review-preview-grid">
            <article class="path-card">
              <p>slskd source</p>
              <strong>{{ formatPath(preview.source.sourceFolderPath) }}</strong>
              <span>{{ formatTokenLabel(preview.source.resolutionStrategy) }}</span>
            </article>
            <article class="path-card">
              <p>Translated local folder</p>
              <strong>{{ formatPath(preview.source.resolvedFolderPath) }}</strong>
              <span v-if="preview.source.mapping">{{ preview.source.mapping.slskdPrefix }} -> {{ preview.source.mapping.harmoniarrPrefix }}</span>
              <span v-else>{{ formatPath(preview.source.downloadsRoot) }}</span>
            </article>
            <article class="path-card">
              <p>Staging target</p>
              <strong>{{ formatPath(preview.staging.previewFolderPath) }}</strong>
              <span>Root {{ formatPath(preview.staging.root) }}</span>
            </article>
            <article class="path-card">
              <p>Library preview</p>
              <strong>{{ formatPath(preview.library.previewFolderPath) }}</strong>
              <span>{{ formatTokenLabel(preview.library.rootFolderPolicy) }}</span>
            </article>
          </div>

          <div class="review-preview-file-list" v-if="preview.naming.filePreviews?.length">
            <article class="review-preview-file-item" v-for="filePreview in preview.naming.filePreviews" :key="filePreview.fileId">
              <div class="review-file-header">
                <div>
                  <strong>{{ filePreview.filename }}</strong>
                  <p class="metadata-card-copy">{{ formatTokenLabel(preview.naming.strategy) }}</p>
                </div>
              </div>

              <dl class="review-meta-grid review-meta-grid-wide">
                <div>
                  <dt>Raw source</dt>
                  <dd>{{ formatPath(filePreview.rawSourcePath) }}</dd>
                </div>
                <div>
                  <dt>Source file</dt>
                  <dd>{{ formatPath(filePreview.sourcePath) }}</dd>
                </div>
                <div>
                  <dt>Staging file</dt>
                  <dd>{{ formatPath(filePreview.stagingPath) }}</dd>
                </div>
                <div>
                  <dt>Library file</dt>
                  <dd>{{ formatPath(filePreview.libraryPath) }}</dd>
                </div>
              </dl>
            </article>
          </div>
          <article class="panel-light review-empty-state" v-else>
            <h3>No files to preview</h3>
            <p>This match doesn't have any previewable files.</p>
          </article>
        </template>

        <article class="panel-light review-empty-state" v-else>
          <h3>No preview</h3>
          <p>Select a match to see its paths.</p>
        </article>
      </article>

      <article class="panel-light review-preview-panel" v-if="candidate.status === 'import_pending'">
        <div class="section-header">
          <div>
            <p class="eyebrow">Import preview</p>
            <h3>File safety and collisions</h3>
          </div>
        </div>

        <article class="panel-light review-empty-state" v-if="isLoadingApplyPreview && !applyPreview">
          <h3>Loading import preview</h3>
          <p>Checking files for collisions and source availability…</p>
        </article>

        <article class="panel-light error-panel" v-else-if="applyPreviewError">
          <h3>Apply preview unavailable</h3>
          <p>{{ applyPreviewError }}</p>
        </article>

        <template v-else-if="applyPreview">
          <p class="review-summary-copy">{{ applyPreview.summary?.message }}</p>
          <p class="error-copy" v-if="fileDecisionError">{{ fileDecisionError }}</p>

          <div class="pill-row" v-if="applyPreview.counts">
            <div class="pill">
              <span>Files</span>
              <strong>{{ applyPreview.counts.totalFiles }}</strong>
            </div>
            <div class="pill">
              <span>Ready</span>
              <strong>{{ applyPreview.counts.readyCount }}</strong>
            </div>
            <div class="pill">
              <span>Collisions</span>
              <strong>{{ applyPreview.counts.collisionCount }}</strong>
            </div>
            <div class="pill">
              <span>Skipped</span>
              <strong>{{ applyPreview.counts.skippedCount || 0 }}</strong>
            </div>
            <div class="pill">
              <span>Missing source</span>
              <strong>{{ applyPreview.counts.missingSourceCount }}</strong>
            </div>
          </div>

          <div class="review-preview-file-list" v-if="applyPreview.files?.length">
            <article class="review-preview-file-item" v-for="filePreview in applyPreview.files" :key="filePreview.fileId || filePreview.filename">
              <div class="review-file-header">
                <div>
                  <strong>{{ filePreview.filename }}</strong>
                  <p class="metadata-card-copy">{{ filePreview.status.message }}</p>
                </div>
                <span class="review-status-pill" :class="applyFileStatusClass(filePreview.status.code)">
                  {{ applyFileStatusLabel(filePreview.status.code) }}
                </span>
              </div>

              <p class="review-summary-copy" v-if="filePreview.decision?.decisionType === 'skip'">
                Saved decision: skip{{ filePreview.decision.reason ? ` - ${filePreview.decision.reason}` : '' }}
              </p>

              <dl class="review-meta-grid review-meta-grid-wide">
                <div>
                  <dt>Source file</dt>
                  <dd>{{ formatPath(filePreview.sourceFile?.path) }}</dd>
                </div>
                <div>
                  <dt>Staging file</dt>
                  <dd>{{ formatPath(filePreview.stagingTarget?.path) }}</dd>
                </div>
                <div>
                  <dt>Library target</dt>
                  <dd>{{ formatPath(filePreview.libraryTarget?.path) }}</dd>
                </div>
                <div>
                  <dt>Target exists</dt>
                  <dd>{{ filePreview.libraryTarget?.exists ? 'Yes' : 'No' }}</dd>
                </div>
              </dl>

              <div class="review-file-actions" v-if="canSkipApplyFile(filePreview) || canClearApplyFileDecision(filePreview)">
                <button
                  v-if="canSkipApplyFile(filePreview)"
                  type="button"
                  class="secondary-button"
                  :disabled="isUpdatingFileDecision || isTransitionPending"
                  @click="$emit('skip-file', filePreview.fileId)"
                >
                  {{ fileDecisionButtonLabel(filePreview) }}
                </button>
                <button
                  v-if="canClearApplyFileDecision(filePreview)"
                  type="button"
                  :disabled="isUpdatingFileDecision || isTransitionPending"
                  @click="$emit('clear-file-decision', filePreview.fileId)"
                >
                  {{ fileDecisionButtonLabel(filePreview) }}
                </button>
              </div>
            </article>
          </div>
          <article class="panel-light review-empty-state" v-else>
            <h3>No apply preview file rows</h3>
            <p>The selected import-pending candidate does not currently expose previewable apply rows.</p>
          </article>
        </template>
      </article>

      <div class="review-file-list" v-if="candidate.files?.length">
        <article
          class="review-file-item"
          v-for="file in candidate.files"
          :key="file.id"
          :ref="(element) => setFileItemRef(file.id, element)"
          :aria-label="`Candidate file ${file.filename}`"
          :data-focused="isFocusedCandidateFile(file) ? 'true' : null"
          :data-import-candidate-file-id="file.id"
          :tabindex="isFocusedCandidateFile(file) ? -1 : null"
        >
          <div class="review-file-header">
            <div>
              <strong>{{ file.filename }}</strong>
              <p class="metadata-card-copy">{{ file.folderPath || candidate.folderPath || 'Root-level file' }}</p>
            </div>
            <span class="review-file-lock" v-if="file.isLocked">Locked</span>
          </div>

          <dl class="review-meta-grid review-file-meta-grid">
            <div>
              <dt>Format</dt>
              <dd>{{ file.extension || 'Unknown' }}</dd>
            </div>
            <div>
              <dt>Size</dt>
              <dd>{{ formatBytes(file.sizeBytes) }}</dd>
            </div>
            <div>
              <dt>Length</dt>
              <dd>{{ formatFileDuration(file.lengthSeconds) ?? 'Unknown' }}</dd>
            </div>
            <div>
              <dt>Bitrate</dt>
              <dd>{{ file.bitRateKbps ? `${file.bitRateKbps} kbps` : 'Unknown' }}</dd>
            </div>
          </dl>
        </article>
      </div>
      <article class="panel-light review-empty-state" v-else>
        <h3>No file rows are stored yet</h3>
        <p>The selected candidate exists, but its persisted file list is currently empty.</p>
      </article>
    </template>
  </article>

</template>

<style scoped>
.review-file-item[data-focused='true'] {
  border-color: rgba(94, 173, 255, 0.5);
  background:
    linear-gradient(180deg, rgba(94, 173, 255, 0.08), transparent 60%),
    var(--hx-bg-surface);
  box-shadow: 0 0 0 1px rgba(94, 173, 255, 0.22);
}

.review-file-item:focus-visible {
  outline: 2px solid var(--hx-accent);
  outline-offset: 3px;
}
</style>
