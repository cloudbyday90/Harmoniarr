<!--
  Harmoniarr - Soulseek-native music library management
  Copyright (C) 2026 Harmoniarr Contributors

  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<script setup>
import { useProviderCollectionAccessCheck } from '../../composables/useProviderCollectionAccessCheck.js';

const props = defineProps({
  isSaving: { default: false, type: Boolean },
  settingsDirty: { default: false, type: Boolean },
});

const { errorMessage, isChecking, isInputInvalid, result, runCheck, sourceUrl } = useProviderCollectionAccessCheck();

function checkSavedAccess() {
  if (!props.isSaving) void runCheck();
}
</script>

<template>
  <section class="hx-collection-access" aria-labelledby="settings-collection-access-heading" :aria-busy="isChecking">
    <div>
      <h3 id="settings-collection-access-heading" class="hx-card-title">Collection access check</h3>
      <p id="settings-collection-access-help" class="hx-card-subtitle">
        Check up to two pages of a Spotify or Apple Music playlist or artist, or a YouTube playlist, using saved connections.
        This reads metadata and does not create requests or queue downloads.
      </p>
    </div>
    <div class="hx-field">
      <label class="hx-field-label" for="settings-collection-access-url">Playlist or artist URL</label>
      <input
        id="settings-collection-access-url"
        v-model="sourceUrl"
        class="hx-input"
        type="text"
        inputmode="url"
        autocomplete="off"
        :spellcheck="false"
        maxlength="2048"
        :disabled="isSaving"
        :readonly="isChecking"
        :aria-invalid="isInputInvalid"
        :aria-describedby="`settings-collection-access-help settings-collection-access-saved${isInputInvalid ? ' settings-collection-access-error' : ''}`"
        @keydown.enter.prevent="checkSavedAccess"
      />
    </div>
    <p id="settings-collection-access-saved" class="hx-text-muted">
      <strong v-if="settingsDirty">Connection changes are waiting to be saved. </strong>
      Save connection changes before checking new credentials. Each check can take up to 30 seconds.
    </p>
    <div class="hx-card-actions">
      <button type="button" class="hx-btn" :disabled="isSaving" :aria-disabled="isChecking || isSaving" @click="checkSavedAccess">
        {{ isChecking ? 'Checking saved provider access…' : 'Check saved provider access' }}
      </button>
    </div>
    <p v-if="isChecking" class="hx-text-muted" role="status" aria-live="polite">Checking access to the supplied collection…</p>
    <p v-if="errorMessage" id="settings-collection-access-error" class="hx-alert" data-tone="danger" role="alert">{{ errorMessage }}</p>
    <div v-if="result" class="hx-collection-access-result">
      <div class="hx-alert" :data-tone="result.tone" :role="result.outcome === 'failed' ? 'alert' : 'status'" aria-atomic="true">
        <span class="hx-pill" :data-tone="result.tone">{{ result.label }}</span>
        <p>{{ result.detail }}</p>
        <p>{{ result.coverageLabel }}</p>
      </div>
      <dl class="hx-collection-access-summary">
        <div><dt>Source</dt><dd>{{ result.providerLabel }} · {{ result.resourceLabel }}</dd></div>
        <div><dt>Saved authorization</dt><dd>{{ result.authModeLabel }}</dd></div>
        <div><dt>Pages checked</dt><dd>{{ result.pagesChecked }}</dd></div>
        <div><dt>Entries seen</dt><dd>{{ result.entriesSeen }}</dd></div>
        <div><dt>Pagination</dt><dd>{{ result.multiPageLabel }}</dd></div>
        <div><dt>Collection stability</dt><dd>{{ result.snapshotLabel }}</dd></div>
        <div><dt>Quota</dt><dd>{{ result.quotaLabel }}</dd></div>
      </dl>
      <p><strong>Next:</strong> {{ result.nextAction }}</p>
      <p v-if="result.retryLabel" class="hx-text-muted">{{ result.retryLabel }}</p>
      <p v-if="result.checkedAtLabel" class="hx-text-muted">Checked {{ result.checkedAtLabel }}. Results apply to this source and check only.</p>
    </div>
  </section>
</template>

<style scoped>
.hx-collection-access,
.hx-collection-access-result {
  display: grid;
  gap: var(--hx-space-3);
  min-width: 0;
}

.hx-collection-access {
  border-bottom: 1px solid var(--hx-border-subtle);
  margin-bottom: var(--hx-space-4);
  padding-bottom: var(--hx-space-4);
}

.hx-collection-access p,
.hx-collection-access-summary,
.hx-collection-access-summary dd {
  margin: 0;
}

.hx-collection-access .hx-btn[aria-disabled='true'] {
  cursor: wait;
  opacity: 0.65;
}

.hx-collection-access .hx-alert p {
  margin-top: var(--hx-space-2);
}

.hx-collection-access-summary {
  display: grid;
  gap: var(--hx-space-3);
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 180px), 1fr));
}

.hx-collection-access-summary dt {
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
}

.hx-collection-access-summary dd {
  color: var(--hx-text-strong);
  overflow-wrap: anywhere;
}

@media (max-width: 640px) {
  .hx-collection-access .hx-btn,
  .hx-collection-access .hx-input {
    min-height: 44px;
  }
}
</style>
