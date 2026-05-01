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
  isUpdatingMonitoring: {
    type: Boolean,
    default: false,
  },
  localArtist: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(['update-monitoring']);

function buildNextMonitoringPatch(localArtist) {
  return {
    isMonitored: !(localArtist.monitoring?.isMonitored ?? false),
    monitoredReleaseGroupTypes: localArtist.monitoring?.monitoredReleaseGroupTypes ?? ['album', 'ep'],
  };
}
</script>

<template>
  <section class="stats-grid">
    <article class="panel-light">
      <p class="eyebrow">Local artist</p>
      <h3>{{ localArtist.artist.name }}</h3>
      <button
        type="button"
        :disabled="isUpdatingMonitoring"
        @click="emit('update-monitoring', buildNextMonitoringPatch(localArtist))"
      >
        {{ isUpdatingMonitoring ? 'Updating...' : (localArtist.monitoring?.isMonitored ? 'Unmonitor artist' : 'Monitor artist') }}
      </button>
      <dl>
        <div><dt>Country</dt><dd>{{ localArtist.artist.country || 'Unknown' }}</dd></div>
        <div><dt>Disambiguation</dt><dd>{{ localArtist.artist.disambiguation || 'None' }}</dd></div>
        <div><dt>Stored release groups</dt><dd>{{ localArtist.releaseGroups.length }}</dd></div>
        <div><dt>Stored releases</dt><dd>{{ localArtist.releases.length }}</dd></div>
      </dl>
    </article>

    <article class="panel-light">
      <p class="eyebrow">Monitoring</p>
      <h3>Artist policy</h3>
      <dl>
        <div><dt>Monitored</dt><dd>{{ localArtist.monitoring?.isMonitored ? 'Yes' : 'No' }}</dd></div>
        <div><dt>Release types</dt><dd>{{ (localArtist.monitoring?.monitoredReleaseGroupTypes ?? []).join(', ') }}</dd></div>
        <div><dt>Aliases</dt><dd>{{ localArtist.aliases.length }}</dd></div>
      </dl>
    </article>

    <article class="panel-light">
      <p class="eyebrow">Identity</p>
      <h3>Canonical mapping</h3>
      <dl>
        <div><dt>Local ID</dt><dd>{{ localArtist.artist.id }}</dd></div>
        <div><dt>MusicBrainz MBID</dt><dd>{{ localArtist.artist.source.musicbrainzArtistId }}</dd></div>
      </dl>
    </article>
  </section>
</template>