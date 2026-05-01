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
  releaseGroups: {
    type: Array,
    required: true,
  },
});

defineEmits(['open-release-group']);
</script>

<template>
  <section v-if="releaseGroups.length">
    <div class="section-header">
      <div>
        <p class="eyebrow">Release groups</p>
        <h3>Imported release groups</h3>
      </div>
    </div>

    <div class="metadata-card-grid">
      <article class="metadata-card" v-for="releaseGroup in releaseGroups" :key="releaseGroup.id">
        <div>
          <p class="eyebrow">{{ releaseGroup.primaryType || 'Release group' }}</p>
          <h3>{{ releaseGroup.title }}</h3>
          <p class="metadata-card-copy">{{ releaseGroup.artistName || releaseGroup.disambiguation || 'Stored local release group' }}</p>
        </div>
        <dl>
          <div><dt>Artist</dt><dd>{{ releaseGroup.artistName || 'Unknown' }}</dd></div>
          <div><dt>Stored releases</dt><dd>{{ releaseGroup.releaseCount ?? 0 }}</dd></div>
        </dl>
        <button type="button" @click="$emit('open-release-group', releaseGroup)">Open local release group</button>
      </article>
    </div>
  </section>
</template>