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
import {
  formatReassignmentEventDescription,
  getReassignmentEventLabel,
  getReassignmentEventTone,
  getRequestHeadline,
  getRequestKindLabel,
} from '../lib/request-music-form.js';

const props = defineProps({
  open: { type: Boolean, default: false },
  request: { type: Object, default: null },
  eligibleUsers: { type: Array, default: () => [] },
  isLoadingUsers: { type: Boolean, default: false },
  events: { type: Array, default: () => [] },
  isLoadingHistory: { type: Boolean, default: false },
  isReassigning: { type: Boolean, default: false },
  reassignError: { type: String, default: '' },
  historyError: { type: String, default: '' },
});

const emit = defineEmits(['reassign', 'close', 'loadUsers', 'loadHistory']);

const dialogRef = ref(null);
const selectedUserId = ref('');
const reason = ref('');

const usersById = computed(() => {
  const map = {};
  for (const u of props.eligibleUsers) {
    map[u.id] = u;
  }
  return map;
});

const filteredUsers = computed(() => {
  if (!props.request) return props.eligibleUsers;
  const currentUserId = props.request.requestedForUser?.id;
  return props.eligibleUsers.filter((u) => u.id !== currentUserId);
});

const canSubmit = computed(() => {
  return selectedUserId.value && !props.isReassigning;
});

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    selectedUserId.value = '';
    reason.value = '';
    emit('loadUsers');
    if (props.request?.id) {
      emit('loadHistory', { mediaRequestId: props.request.id });
    }
  }
});

onMounted(() => {
  if (props.open && dialogRef.value && !dialogRef.value.open) {
    dialogRef.value.showModal();
  }
});

watch(
  () => props.open,
  (isOpen) => {
    if (!dialogRef.value) return;
    if (isOpen) {
      if (!dialogRef.value.open) dialogRef.value.showModal();
    } else {
      if (dialogRef.value.open) dialogRef.value.close();
    }
  },
  { immediate: true },
);

function handleCancel(event) {
  event.preventDefault();
  if (!props.isReassigning) emit('close');
}

function handleBackdropClick(event) {
  if (props.isReassigning) return;
  if (event.target === dialogRef.value) emit('close');
}

function handleClose() {
  if (!props.isReassigning) emit('close');
}

function handleReassign() {
  if (!selectedUserId.value || !props.request?.id) return;
  emit('reassign', {
    mediaRequestId: props.request.id,
    newRequestedForUserId: selectedUserId.value,
    reason: reason.value || null,
  });
}

function formatTimestamp(isoString) {
  if (!isoString) return '';
  try {
    return new Date(isoString).toLocaleString();
  } catch {
    return isoString;
  }
}
</script>

<template>
  <dialog
    ref="dialogRef"
    class="rrm-dialog"
    role="dialog"
    aria-modal="true"
    aria-labelledby="rrm-heading"
    @cancel="handleCancel"
    @click="handleBackdropClick"
  >
    <div class="rrm-shell">
      <header class="rrm-header">
        <h2 id="rrm-heading" class="rrm-title">Reassign request</h2>
        <button
          type="button"
          class="rrm-close hx-btn"
          data-variant="ghost"
          :disabled="isReassigning"
          aria-label="Close"
          @click="handleClose"
        >✕</button>
      </header>

      <div class="rrm-body">
        <div v-if="request" class="rrm-request-info">
          <p class="rrm-request-kind">{{ getRequestKindLabel(request.requestKind) }}</p>
          <p class="rrm-request-headline">{{ getRequestHeadline(request) }}</p>
          <p class="rrm-request-current hx-text-muted">
            Currently assigned to {{ request.requestedForUser?.username ?? 'unknown' }}
          </p>
        </div>

        <div class="rrm-field">
          <label class="rrm-field-label" for="rrm-target-user">Assign to</label>
          <select
            id="rrm-target-user"
            v-model="selectedUserId"
            class="hx-select"
            :disabled="isReassigning || isLoadingUsers"
          >
            <option value="" disabled>Select a user</option>
            <option v-for="user in filteredUsers" :key="user.id" :value="user.id">
              {{ user.username }} ({{ user.role ?? 'user' }})
            </option>
          </select>
          <p class="hx-text-muted rrm-hint" v-if="isLoadingUsers">Loading eligible users.</p>
          <p class="hx-text-muted rrm-hint" v-else-if="filteredUsers.length === 0">No other eligible users available.</p>
        </div>

        <div class="rrm-field">
          <label class="rrm-field-label" for="rrm-reason">
            Reason <span class="hx-text-faint">(optional)</span>
          </label>
          <textarea
            id="rrm-reason"
            v-model="reason"
            class="hx-input rrm-reason-input"
            rows="2"
            placeholder="Why is this request being reassigned?"
            :disabled="isReassigning"
          ></textarea>
        </div>

        <div v-if="reassignError" class="rrm-error" role="alert">{{ reassignError }}</div>

        <details v-if="events.length > 0" class="rrm-history">
          <summary class="rrm-history-summary">
            Reassignment history ({{ events.length }})
          </summary>
          <ol class="rrm-timeline">
            <li v-for="event in events" :key="event.id" class="rrm-timeline-item">
              <div class="rrm-timeline-dot"></div>
              <div class="rrm-timeline-content">
                <div class="rrm-timeline-header">
                  <span class="hx-pill" :data-tone="getReassignmentEventTone(event.eventType)">
                    {{ getReassignmentEventLabel(event.eventType) }}
                  </span>
                  <span class="rrm-timestamp">{{ formatTimestamp(event.occurredAt) }}</span>
                </div>
                <p class="rrm-timeline-desc">
                  {{ formatReassignmentEventDescription(event, usersById) }}
                </p>
              </div>
            </li>
          </ol>
        </details>

        <p v-if="historyError" class="rrm-error" role="alert">{{ historyError }}</p>
      </div>

      <footer class="rrm-footer">
        <button
          type="button"
          class="hx-btn"
          data-variant="ghost"
          :disabled="isReassigning"
          @click="handleClose"
        >Cancel</button>
        <button
          type="button"
          class="hx-btn"
          data-variant="primary"
          :disabled="!canSubmit"
          :aria-busy="isReassigning || undefined"
          @click="handleReassign"
        >
          {{ isReassigning ? 'Reassigning\u2026' : 'Reassign' }}
        </button>
      </footer>
    </div>
  </dialog>
</template>

<style scoped>
.rrm-dialog {
  border: none;
  border-radius: var(--hx-radius-lg);
  background: var(--hx-bg-surface);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.32);
  padding: 0;
  width: min(520px, 96vw);
  max-height: 90vh;
  overflow: hidden;
  color: var(--hx-text);
}

.rrm-dialog::backdrop {
  background: var(--hx-bg-overlay);
  backdrop-filter: blur(2px);
}

.rrm-shell {
  display: flex;
  flex-direction: column;
  max-height: 90vh;
  overflow: hidden;
}

.rrm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--hx-space-3);
  padding: var(--hx-space-4) var(--hx-space-5);
  border-bottom: 1px solid var(--hx-border-subtle);
  flex-shrink: 0;
}

.rrm-title {
  margin: 0;
  font-size: var(--hx-text-md);
  font-weight: 600;
  color: var(--hx-text-strong);
}

.rrm-close {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  padding: 0;
  font-size: 0.85rem;
  color: var(--hx-text-muted);
}

.rrm-body {
  padding: var(--hx-space-5);
  display: grid;
  gap: var(--hx-space-4);
  overflow-y: auto;
}

.rrm-request-info {
  display: grid;
  gap: var(--hx-space-1);
}

.rrm-request-kind {
  margin: 0;
  font-size: var(--hx-text-xs);
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--hx-text-muted);
}

.rrm-request-headline {
  margin: 0;
  font-size: var(--hx-text-base);
  font-weight: 600;
  color: var(--hx-text-strong);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rrm-request-current {
  margin: 0;
  font-size: var(--hx-text-sm);
}

.rrm-field {
  display: flex;
  flex-direction: column;
  gap: var(--hx-space-1);
}

.rrm-field-label {
  font-size: var(--hx-text-sm);
  color: var(--hx-text-muted);
  font-weight: 500;
}

.rrm-hint {
  font-size: var(--hx-text-sm);
}

.rrm-reason-input {
  resize: vertical;
  min-height: 56px;
}

.rrm-error {
  margin: 0;
  font-size: var(--hx-text-sm);
  color: var(--hx-danger);
  background: var(--hx-danger-soft);
  border: 1px solid rgba(197, 69, 69, 0.28);
  border-radius: var(--hx-radius-sm);
  padding: var(--hx-space-2) var(--hx-space-3);
}

.rrm-history {
  border: 1px solid var(--hx-border-subtle);
  border-radius: var(--hx-radius-sm);
  background: var(--hx-bg-surface-sunken);
}

.rrm-history-summary {
  padding: var(--hx-space-2) var(--hx-space-3);
  font-size: var(--hx-text-sm);
  font-weight: 500;
  color: var(--hx-text-muted);
  cursor: pointer;
  user-select: none;
}

.rrm-timeline {
  list-style: none;
  margin: 0;
  padding: 0 var(--hx-space-3) var(--hx-space-3);
  display: grid;
  gap: 0;
}

.rrm-timeline-item {
  display: flex;
  gap: var(--hx-space-3);
  padding: var(--hx-space-2) 0;
  position: relative;
}

.rrm-timeline-item:not(:last-child)::before {
  content: '';
  position: absolute;
  left: 5px;
  top: 22px;
  bottom: -4px;
  width: 1px;
  background: var(--hx-border-subtle);
}

.rrm-timeline-dot {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: var(--hx-accent);
  flex-shrink: 0;
  margin-top: 3px;
}

.rrm-timeline-content {
  display: grid;
  gap: var(--hx-space-1);
  min-width: 0;
}

.rrm-timeline-header {
  display: flex;
  align-items: center;
  gap: var(--hx-space-2);
  flex-wrap: wrap;
}

.rrm-timestamp {
  font-size: var(--hx-text-xs);
  color: var(--hx-text-faint);
}

.rrm-timeline-desc {
  margin: 0;
  font-size: var(--hx-text-sm);
  color: var(--hx-text-muted);
  line-height: 1.5;
}

.rrm-footer {
  display: flex;
  gap: var(--hx-space-2);
  justify-content: flex-end;
  align-items: center;
  padding: var(--hx-space-4) var(--hx-space-5);
  border-top: 1px solid var(--hx-border-subtle);
  flex-shrink: 0;
}
</style>
