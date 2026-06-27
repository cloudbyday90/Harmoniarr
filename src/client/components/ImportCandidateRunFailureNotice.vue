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
defineProps({
  message: {
    type: String,
    default: '',
  },
  title: {
    type: String,
    default: 'Run failure',
  },
});
</script>

<template>
  <article class="panel-light error-panel import-run-failure-notice" role="status" v-if="message">
    <h4>{{ title }}</h4>
    <p>{{ message }}</p>
  </article>
</template>

<style scoped>
.import-run-failure-notice {
  margin: var(--hx-space-3) 0;
}

.import-run-failure-notice h4 {
  margin: 0 0 var(--hx-space-1);
  color: var(--hx-text-strong);
  font-size: var(--hx-text-sm);
}

.import-run-failure-notice p {
  margin: 0;
}
</style>
