<!--
  Harmoniarr - Soulseek-native music library management
  Copyright (C) 2026 Harmoniarr Contributors
  Licensed under GPL-3.0-or-later. See LICENSE.
-->
<script setup>
import { computed } from 'vue';
import { formatMetadataTimestamp } from '../lib/metadata-timestamp-presentation.js';

const props = defineProps({
  value: { type: String, default: null },
  fallback: { type: String, default: 'Not recorded' },
});
const timestamp = computed(() => formatMetadataTimestamp(props.value));
</script>

<template>
  <time v-if="timestamp" :datetime="timestamp.dateTime">{{ timestamp.label }}</time>
  <span v-else>{{ fallback }}</span>
</template>
