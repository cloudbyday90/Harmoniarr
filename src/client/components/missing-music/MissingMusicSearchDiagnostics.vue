<!--
  Harmoniarr - Soulseek-native music library management
  Copyright (C) 2026 Harmoniarr Contributors
  Licensed under GPL-3.0-or-later. See LICENSE.
-->
<script setup>
import { computed } from 'vue';
import { buildSlskdSearchDiagnosticsPresentation } from '../../lib/slskd-search-diagnostics-presentation.js';
import { buildMissingMusicSearchCorrections } from '../../lib/missing-music-search-corrections-presentation.js';
const props = defineProps({ detail: { type: Object, default: null } });
const result = computed(() => buildSlskdSearchDiagnosticsPresentation(props.detail?.searchDiagnostics));
const corrections = computed(() => buildMissingMusicSearchCorrections(props.detail));
</script>

<template>
  <section v-if="result" class="missing-search-diagnostics" aria-labelledby="missing-search-diagnostics-heading">
    <h3 id="missing-search-diagnostics-heading">Last recorded search</h3>
    <p>{{ result.message }}</p>
    <dl aria-label="Search response and file counts">
      <div v-for="item in result.details" :key="item.label"><dt>{{ item.label }}</dt><dd>{{ item.value }}</dd></div>
    </dl>
    <p>Response and file counts describe different things. Review the current status and saved policy before choosing another action.</p>
    <ul v-if="corrections.length" class="hx-search-corrections" aria-label="Search correction guidance">
      <li v-for="step in corrections" :key="step.key">
        <p>{{ step.text }}</p>
        <RouterLink v-if="step.link" class="hx-btn" :to="step.link.to">{{ step.link.label }}</RouterLink>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.missing-search-diagnostics { display: grid; gap: var(--hx-space-3); }
.missing-search-diagnostics h3, .missing-search-diagnostics p, .missing-search-diagnostics dl, .missing-search-diagnostics dd { margin: 0; }
.missing-search-diagnostics dl { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: var(--hx-space-3); }
.missing-search-diagnostics dt { color: var(--hx-text-muted); font-size: var(--hx-text-sm); }
.missing-search-diagnostics dd { color: var(--hx-text-strong); font-weight: 600; }
.hx-search-corrections { display: grid; gap: var(--hx-space-3); margin: 0; padding-inline-start: var(--hx-space-5); }
.hx-search-corrections li { min-width: 0; }
.hx-search-corrections .hx-btn { min-height: 44px; margin-top: var(--hx-space-2); white-space: normal; }
</style>
