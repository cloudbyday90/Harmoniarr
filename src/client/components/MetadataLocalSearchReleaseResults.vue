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
  releases: {
    type: Array,
    required: true,
  },
});

defineEmits(['open-release']);
</script>

<template>
  <section v-if="releases.length">
    <div class="section-header">
      <div>
        <p class="eyebrow">Releases</p>
        <h3>Imported releases</h3>
      </div>
    </div>

    <div class="metadata-card-grid">
      <article class="metadata-card" v-for="release in releases" :key="release.id">
        <div>
          <p class="eyebrow">{{ release.releaseGroupTitle || 'Release' }}</p>
          <h3>{{ release.title }}</h3>
          <p class="metadata-card-copy">{{ release.artistName || release.disambiguation || release.status || 'Stored local release' }}</p>
        </div>
        <dl>
          <div><dt>Artist</dt><dd>{{ release.artistName || 'Unknown' }}</dd></div>
          <div><dt>Release date</dt><dd>{{ release.releaseDate || 'Unknown' }}</dd></div>
        </dl>
        <button type="button" @click="$emit('open-release', release)">Open local release</button>
      </article>
    </div>
  </section>
</template>