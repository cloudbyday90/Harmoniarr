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
  artists: {
    type: Array,
    required: true,
  },
});

defineEmits(['open-artist']);
</script>

<template>
  <section v-if="artists.length">
    <div class="section-header">
      <div>
        <p class="eyebrow">Artists</p>
        <h3>Imported artists</h3>
      </div>
    </div>

    <div class="metadata-card-grid">
      <article class="metadata-card" v-for="artist in artists" :key="artist.id">
        <div>
          <p class="eyebrow">{{ artist.artistType || 'Artist' }}</p>
          <h3>{{ artist.name }}</h3>
          <p class="metadata-card-copy">{{ artist.disambiguation || 'Stored local artist' }}</p>
        </div>
        <dl>
          <div><dt>Country</dt><dd>{{ artist.country || 'Unknown' }}</dd></div>
          <div><dt>Sort name</dt><dd>{{ artist.sortName || 'Unknown' }}</dd></div>
        </dl>
        <button type="button" @click="$emit('open-artist', artist)">Open local artist</button>
      </article>
    </div>
  </section>
</template>