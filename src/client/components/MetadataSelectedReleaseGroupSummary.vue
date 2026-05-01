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
  localReleaseGroup: {
    type: Object,
    required: true,
  },
});
</script>

<template>
  <article class="panel-light">
    <p class="eyebrow">Selected release group</p>
    <h3>{{ localReleaseGroup.releaseGroup.title }}</h3>
    <dl>
      <div><dt>Local ID</dt><dd>{{ localReleaseGroup.releaseGroup.id }}</dd></div>
      <div><dt>MusicBrainz MBID</dt><dd>{{ localReleaseGroup.releaseGroup.source.musicbrainzReleaseGroupId }}</dd></div>
      <div><dt>Stored releases</dt><dd>{{ localReleaseGroup.releases.length }}</dd></div>
    </dl>
  </article>
</template>