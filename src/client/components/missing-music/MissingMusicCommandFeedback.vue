<!--
  Harmoniarr - Soulseek-native music library management
  Copyright (C) 2026 Harmoniarr Contributors
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<script setup>
defineProps({
  errorMessage: { default: '', type: String },
  statusMessage: { default: '', type: String },
  tone: { default: 'success', type: String, validator: (value) => ['success', 'warning', 'info'].includes(value) },
});
</script>

<template>
  <div class="hx-missing-command-feedback" :data-tone="tone" role="status" aria-live="polite" aria-atomic="true">
    <p v-if="statusMessage">{{ statusMessage }}</p>
  </div>
  <p v-if="errorMessage" class="hx-alert hx-missing-command-error" data-tone="danger" role="alert">{{ errorMessage }}</p>
</template>

<style scoped>
.hx-missing-command-feedback p, .hx-missing-command-error { margin: 0; padding: var(--hx-space-3); }
.hx-missing-command-feedback p { border-left: 3px solid var(--hx-success); background: var(--hx-success-soft); color: var(--hx-text); }
.hx-missing-command-feedback[data-tone='warning'] p { border-color: var(--hx-warning); background: var(--hx-warning-soft); }
.hx-missing-command-feedback[data-tone='info'] p { border-color: var(--hx-info); background: var(--hx-info-soft); }
.hx-missing-command-feedback:empty { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
</style>
