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
defineProps({
  diagnostics: {
    type: Array,
    default: () => [],
  },
});

defineEmits(['open-candidate']);

function formatValue(value, fallback) {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function formatDiagnosticCode(code) {
  return formatValue(code, 'media inspection warning')
    .replaceAll('_', ' ')
    .replace(/\b\w/gu, (letter) => letter.toUpperCase());
}

function hasCandidateReference(diagnostic) {
  return typeof diagnostic?.candidateId === 'string' && diagnostic.candidateId.trim().length > 0;
}

function buildCandidateOpenPayload(diagnostic) {
  return {
    candidateId: formatValue(diagnostic?.candidateId, ''),
    fileId: formatValue(diagnostic?.fileId, ''),
  };
}
</script>

<template>
  <article class="onboarding-step-card media-inspection-diagnostics" v-if="diagnostics.length">
    <div class="review-detail-header">
      <div>
        <p>File diagnostics</p>
        <strong>{{ diagnostics.length }} media inspection warning{{ diagnostics.length === 1 ? '' : 's' }} recorded.</strong>
      </div>
    </div>

    <table class="hx-table media-inspection-diagnostics-table" aria-label="Media inspection file diagnostics">
      <thead>
        <tr>
          <th>File</th>
          <th>Source user</th>
          <th>Diagnostic</th>
          <th>Review</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(diagnostic, index) in diagnostics"
          :key="`${diagnostic.candidateId || 'candidate'}-${diagnostic.fileId || diagnostic.filename || diagnostic.code || 'warning'}-${index}`"
        >
          <td>
            <strong>{{ formatValue(diagnostic.filename, 'Unknown file') }}</strong>
            <p>{{ formatValue(diagnostic.folderPath, 'Unknown source folder') }}</p>
          </td>
          <td>{{ formatValue(diagnostic.username, 'Unknown user') }}</td>
          <td>
            <span class="review-status-pill review-status-held">
              {{ formatDiagnosticCode(diagnostic.code) }}
            </span>
            <p>{{ formatValue(diagnostic.message, 'Media inspection recorded a warning for this file.') }}</p>
          </td>
          <td class="media-inspection-diagnostics-action-cell">
            <button
              type="button"
              class="hx-btn media-inspection-diagnostics-action"
              :disabled="!hasCandidateReference(diagnostic)"
              :aria-label="`Open ${formatValue(diagnostic.filename, 'this file')} in candidate detail`"
              @click="$emit('open-candidate', buildCandidateOpenPayload(diagnostic))"
            >
              Open candidate
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </article>
</template>

<style scoped>
.media-inspection-diagnostics {
  margin-top: var(--hx-space-4);
}

.media-inspection-diagnostics-table {
  margin: 0;
  background: var(--hx-bg-surface-sunken);
}

.media-inspection-diagnostics-table th,
.media-inspection-diagnostics-table td {
  background: var(--hx-bg-surface-sunken);
  vertical-align: top;
}

.media-inspection-diagnostics-table strong {
  display: block;
  color: var(--hx-text-strong);
  font-size: var(--hx-text-sm);
}

.media-inspection-diagnostics-table p {
  margin: var(--hx-space-1) 0 0;
  color: var(--hx-text-muted);
  font-size: var(--hx-text-xs);
}

.media-inspection-diagnostics-action-cell {
  text-align: right;
  white-space: nowrap;
}

.media-inspection-diagnostics-action {
  min-height: 28px;
  padding: 4px 10px;
  font-size: var(--hx-text-xs);
}
</style>
