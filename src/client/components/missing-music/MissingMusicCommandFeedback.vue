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
});
</script>

<template>
  <div class="hx-missing-command-feedback" role="status" aria-live="polite" aria-atomic="true">
    <p v-if="statusMessage">{{ statusMessage }}</p>
  </div>
  <p v-if="errorMessage" class="hx-alert hx-missing-command-error" data-tone="danger" role="alert">{{ errorMessage }}</p>
</template>

<style scoped>
.hx-missing-command-feedback p, .hx-missing-command-error { margin: 0; padding: var(--hx-space-3); }
.hx-missing-command-feedback p { border-left: 3px solid var(--hx-success); background: var(--hx-success-soft); color: var(--hx-text); }
.hx-missing-command-feedback:empty { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
</style>
