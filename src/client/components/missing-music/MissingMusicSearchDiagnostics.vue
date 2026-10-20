<!--
  Harmoniarr - Soulseek-native music library management
  Copyright (C) 2026 Harmoniarr Contributors
  Licensed under GPL-3.0-or-later. See LICENSE.
-->
<script setup>
import { computed } from 'vue';
import { buildSlskdSearchDiagnosticsPresentation } from '../../lib/slskd-search-diagnostics-presentation.js';
const props = defineProps({ detail: { type: Object, default: null } });
const result = computed(() => buildSlskdSearchDiagnosticsPresentation(props.detail?.searchDiagnostics));
</script>

<template>
  <section v-if="result" class="missing-search-diagnostics" aria-labelledby="missing-search-diagnostics-heading">
    <h3 id="missing-search-diagnostics-heading">Last recorded search</h3>
    <p>{{ result.message }}</p>
    <dl aria-label="Search response and file counts">
      <div v-for="item in result.details" :key="item.label"><dt>{{ item.label }}</dt><dd>{{ item.value }}</dd></div>
    </dl>
    <p>Response and file counts describe different things. Review the current status and saved policy before choosing another action.</p>
  </section>
</template>

<style scoped>
.missing-search-diagnostics { display: grid; gap: var(--hx-space-3); }
.missing-search-diagnostics h3, .missing-search-diagnostics p, .missing-search-diagnostics dl, .missing-search-diagnostics dd { margin: 0; }
.missing-search-diagnostics dl { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: var(--hx-space-3); }
.missing-search-diagnostics dt { color: var(--hx-text-muted); font-size: var(--hx-text-sm); }
.missing-search-diagnostics dd { color: var(--hx-text-strong); font-weight: 600; }
</style>
