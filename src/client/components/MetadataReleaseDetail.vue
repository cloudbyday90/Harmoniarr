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
  localRelease: {
    type: Object,
    required: true,
  },
});

function formatTrackLength(lengthMs) {
  if (!lengthMs || lengthMs < 0) {
    return 'Unknown length';
  }

  const totalSeconds = Math.floor(lengthMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}
</script>

<template>
  <article class="panel-light">
    <p class="eyebrow">Selected release</p>
    <h3>{{ localRelease.release.title }}</h3>
    <dl>
      <div><dt>Local ID</dt><dd>{{ localRelease.release.id }}</dd></div>
      <div><dt>MusicBrainz MBID</dt><dd>{{ localRelease.release.source.musicbrainzReleaseId }}</dd></div>
      <div><dt>Media count</dt><dd>{{ localRelease.media.length }}</dd></div>
    </dl>

    <div class="release-media-grid" v-if="localRelease.media.length">
      <article class="release-medium-card" v-for="medium in localRelease.media" :key="medium.id">
        <div>
          <p class="eyebrow">Disc {{ medium.position }}</p>
          <h3>{{ medium.title || medium.format || 'Primary medium' }}</h3>
          <p class="metadata-card-copy">{{ medium.format || 'Unknown format' }} · {{ medium.trackCount || medium.tracks.length }} tracks</p>
        </div>

        <ol class="track-list">
          <li v-for="track in medium.tracks" :key="track.id">
            <span>{{ track.numberText || track.position }}. {{ track.title }}</span>
            <strong>{{ formatTrackLength(track.lengthMs) }}</strong>
          </li>
        </ol>
      </article>
    </div>
  </article>
</template>