<!--
  Harmoniarr - Soulseek-native music library management
  Copyright (C) 2026 Harmoniarr Contributors
  Licensed under GPL-3.0-or-later. See LICENSE.
-->
<script setup>
defineProps({ feedback: { type: Object, default: null }, isChecking: Boolean, canCheck: Boolean });
defineEmits(['check']);
</script>

<template>
  <div class="hx-authorization-status">
    <p class="hx-authorization-status__feedback" :class="{ 'hx-alert': feedback }" :data-tone="feedback?.tone" role="status" aria-atomic="true">{{ feedback?.message ?? '' }}</p>
    <button v-if="feedback" type="button" class="hx-btn" :aria-disabled="isChecking || !canCheck" @click="$emit('check')">
      {{ isChecking ? 'Checking saved status…' : 'Check saved status' }}
    </button>
  </div>
</template>

<style scoped>
.hx-authorization-status__feedback { margin: 0; }
.hx-authorization-status__feedback.hx-alert {
  background: var(--hx-bg-surface);
  border: 1px solid var(--hx-border);
  border-radius: var(--hx-radius-sm);
  padding: var(--hx-space-3);
}
.hx-authorization-status__feedback[data-tone="warning"] { border-color: var(--hx-warning); }
.hx-authorization-status .hx-btn { min-height: 44px; margin-top: var(--hx-space-2); }
.hx-authorization-status .hx-btn[aria-disabled="true"] { color: var(--hx-text-muted); cursor: default; }
</style>
