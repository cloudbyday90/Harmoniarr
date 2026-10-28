<!--
  Harmoniarr - Soulseek-native music library management
  Copyright (C) 2026 Harmoniarr Contributors
  Licensed under GPL-3.0-or-later. See LICENSE.
-->
<script setup>
import { computed, watch } from 'vue';
import { useAppleMusicSigningStatus } from '../../composables/useAppleMusicSigningStatus.js';
import { buildAppleMusicSigningChecks, buildAppleMusicSigningPresentation } from '../../lib/apple-music-signing-presentation.js';

const props = defineProps({ isSaving: { type: Boolean, default: false }, hasCredentialDraft: { type: Boolean, default: false } });
const { status, isLoading, failed, load, invalidate } = useAppleMusicSigningStatus();
const presentation = computed(() => buildAppleMusicSigningPresentation({ status: status.value, loading: isLoading.value, saving: props.isSaving, failed: failed.value }));
const checks = computed(() => buildAppleMusicSigningChecks(status.value));
watch(() => props.isSaving, saving => { if (saving) invalidate(); else void load(); }, { immediate: true, flush: 'sync' });
function refresh() { if (!props.isSaving && !isLoading.value) void load(); }
</script>

<template>
  <section aria-labelledby="settings-apple-signing-heading">
    <h5 id="settings-apple-signing-heading" class="hx-card-title">Saved Apple signing status</h5>
    <p class="hx-alert" :data-tone="presentation.tone" role="status" aria-live="polite" aria-atomic="true">
      {{ presentation.label }} {{ presentation.detail }}
      <strong v-if="hasCredentialDraft">Unsaved Apple credential changes are not included in this saved status.</strong>
    </p>
    <ul v-if="status && !isLoading && !isSaving" class="hx-text-muted">
      <li v-for="check in checks" :key="check.name">{{ check.name }}: {{ check.label }}</li>
    </ul>
    <p class="hx-text-muted">Use Collection access check to verify saved provider access.</p>
    <div class="hx-card-actions hx-apple-signing-actions">
      <button type="button" class="hx-btn" :aria-disabled="isLoading || isSaving" @click="refresh">Refresh saved status</button>
    </div>
  </section>
</template>

<style scoped>
.hx-apple-signing-actions .hx-btn { min-height: 44px; }
</style>
