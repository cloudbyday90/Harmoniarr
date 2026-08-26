<!--
  Harmoniarr - Soulseek-native music library management
  Copyright (C) 2026 Harmoniarr Contributors

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program. If not, see <https://www.gnu.org/licenses/>.
-->

<script setup>
import { computed } from 'vue';
import { buildDownloaderImportCandidateLocation } from '../../lib/downloader-import-review-link.js';
import {
  buildDownloaderMissingMusicDecisionLinkLabel,
  buildDownloaderMissingMusicDecisionLocation,
} from '../../lib/downloader-missing-music-release-link.js';

const props = defineProps({
  transfer: { type: Object, default: null },
});

const importCandidateLocation = computed(() => buildDownloaderImportCandidateLocation(props.transfer));
const missingMusicDecisionLocation = computed(() => buildDownloaderMissingMusicDecisionLocation(props.transfer));
const missingMusicDecisionLinkLabel = computed(() => buildDownloaderMissingMusicDecisionLinkLabel(props.transfer));
const hasHandoffs = computed(() => Boolean(
  importCandidateLocation.value || missingMusicDecisionLocation.value,
));
</script>

<template>
  <div v-if="hasHandoffs" class="downloader-transfer-row-handoffs">
    <RouterLink
      v-if="missingMusicDecisionLocation"
      class="downloader-transfer-row-handoff"
      :to="missingMusicDecisionLocation"
    >
      {{ missingMusicDecisionLinkLabel }}
    </RouterLink>
    <RouterLink
      v-if="importCandidateLocation"
      class="downloader-transfer-row-handoff"
      :to="importCandidateLocation"
    >
      Open advanced diagnostics
    </RouterLink>
  </div>
</template>

<style scoped>
.downloader-transfer-row-handoffs {
  display: inline-grid;
  max-width: 280px;
  gap: 2px;
  justify-items: end;
}

.downloader-transfer-row-handoff {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  min-height: 24px;
  color: var(--hx-accent);
  font-size: var(--hx-text-xs);
  font-weight: 700;
  line-height: 1.25;
  text-align: right;
  text-decoration: none;
}

.downloader-transfer-row-handoff:hover,
.downloader-transfer-row-handoff:focus-visible {
  text-decoration: underline;
}

.downloader-transfer-row-handoff:focus-visible {
  outline: 2px solid var(--hx-accent);
  outline-offset: 2px;
}

@media (max-width: 640px) {
  .downloader-transfer-row-handoff {
    min-height: 44px;
  }
}
</style>
