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
import ComingSoonPanel from '../components/ComingSoonPanel.vue';

const props = defineProps({
  section: { type: String, required: true },
});

const labels = {
  queue: 'Queue',
  wanted: 'Wanted',
  downloads: 'Downloads',
  imports: 'Imports',
  releases: 'Releases',
  users: 'Source Users',
  history: 'History',
  blocklist: 'Blocklist',
  failed: 'Failed',
};

const descriptions = {
  queue: 'Everything currently queued or actively being worked.',
  wanted: 'Missing, monitored, failed, future, and upgradeable wanted items.',
  downloads: 'Active, queued, stalled, failed, and completed Soulseek transfers.',
  imports: 'Completed downloads waiting for validation or action.',
  releases: 'Detected and future releases needing policy decisions.',
  users: 'Source-user trust, notes, reliability, and ignored state.',
  history: 'Searches, detections, downloads, imports, overrides, and decisions.',
  blocklist: 'Blocked source users and exclusion reasons.',
  failed: 'Failed searches, downloads, imports, scans, and metadata jobs.',
};

const title = computed(() => labels[props.section] ?? props.section);
const description = computed(() => descriptions[props.section] ?? '');
</script>

<template>
  <ComingSoonPanel :title="title" :description="description" />
</template>
