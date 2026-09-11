<!--
  Harmoniarr - Soulseek-native music library management
  Copyright (C) 2026 Harmoniarr Contributors
  This program is free software: licensed under GPL-3.0
  See LICENSE file for details.
-->

<script setup>
defineProps({
  busy: { type: Boolean, default: false },
  canGoPrevious: { type: Boolean, default: false },
  canGoNext: { type: Boolean, default: false },
  pageNumber: { type: Number, default: 1 },
});
defineEmits(['first', 'previous', 'next']);
</script>

<template>
  <nav class="missing-music-pagination" aria-label="Missing Music result pages">
    <span class="hx-text-muted">Page {{ pageNumber }}</span>
    <button type="button" class="hx-btn" :disabled="busy || !canGoPrevious" @click="$emit('first')">First page</button>
    <button type="button" class="hx-btn" :disabled="busy || !canGoPrevious" @click="$emit('previous')">Previous page</button>
    <button type="button" class="hx-btn" :disabled="busy || !canGoNext" @click="$emit('next')">Next page</button>
  </nav>
</template>

<style scoped>
.missing-music-pagination { display: flex; flex-wrap: wrap; align-items: center; gap: var(--hx-space-2); padding: 0 var(--hx-space-5) var(--hx-space-4); }
.missing-music-pagination .hx-btn:focus-visible { outline: 2px solid var(--hx-accent); outline-offset: 3px; }
@media (max-width: 640px) { .missing-music-pagination .hx-btn { min-height: 44px; } }
</style>
