<!--
  Harmoniarr - Soulseek-native music library management
  Copyright (C) 2026 Harmoniarr Contributors
  Licensed under GPL-3.0-or-later. See LICENSE.
-->
<script setup>
defineProps({
  errorMessage: { type: String, default: '' },
  pendingMessage: { type: String, default: '' },
});
</script>

<template>
  <div role="status" aria-atomic="true" :class="{ 'sr-only': !pendingMessage }">
    <p v-if="pendingMessage" class="muted-copy">{{ pendingMessage }}</p>
  </div>
  <div role="alert" aria-atomic="true" :class="{ 'sr-only': !errorMessage }">
    <p v-if="errorMessage" class="error-copy">{{ errorMessage }}</p>
  </div>
</template>
