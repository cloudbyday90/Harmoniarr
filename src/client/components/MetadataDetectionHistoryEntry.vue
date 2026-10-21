<!--
  Harmoniarr - Soulseek-native music library management
  Copyright (C) 2026 Harmoniarr Contributors
  Licensed under GPL-3.0-or-later. See LICENSE.
-->
<script setup>
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import MetadataTimestamp from './MetadataTimestamp.vue';
import { describeMonitoringDecision, describeWantedState, detectionEventLinkTarget } from '../lib/metadata-artist-presentation.js';

const props = defineProps({ event: { type: Object, required: true }, localArtist: { type: Object, required: true } });
const link = computed(() => detectionEventLinkTarget(props.localArtist, props.event));
</script>

<template>
  <li class="hx-metadata-history-entry">
    <div class="hx-metadata-history-entry-header">
      <strong>{{ event.title }}</strong>
      <RouterLink v-if="link" class="secondary-button" :to="link.to">{{ link.label }}</RouterLink>
    </div>
    <dl class="hx-metadata-history-details">
      <div><dt>Release type</dt><dd>{{ event.primaryType || 'Unknown type' }}</dd></div>
      <div><dt>Detected</dt><dd><MetadataTimestamp :value="event.occurredAt" /></dd></div>
      <div><dt>Monitoring decision</dt><dd>{{ describeMonitoringDecision(event.monitoringDecision) }}</dd></div>
      <div><dt>Wanted state</dt><dd>{{ describeWantedState(event.resultingWantedStatus) }}</dd></div>
    </dl>
  </li>
</template>

<style scoped>
.hx-metadata-history-entry + .hx-metadata-history-entry {
  border-top: 1px solid var(--hx-border-subtle);
  margin-top: var(--hx-space-3);
  padding-top: var(--hx-space-3);
}

.hx-metadata-history-entry-header {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: var(--hx-space-2);
  justify-content: space-between;
}

.hx-metadata-history-entry-header strong {
  min-width: 0;
  overflow-wrap: anywhere;
}

.hx-metadata-history-entry .hx-metadata-history-details {
  grid-template-columns: minmax(0, 1fr);
  gap: var(--hx-space-2);
}

.hx-metadata-history-entry .hx-metadata-history-details > div {
  display: grid;
  gap: var(--hx-space-1);
  min-width: 0;
}

.hx-metadata-history-entry .hx-metadata-history-details dd {
  overflow-wrap: anywhere;
}
</style>
