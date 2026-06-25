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
// Per-section roving artwork grid for the ArtistDetail discography.
//
// `ArtistDetailView` renders a `v-for` of release-group sections, each needing
// its OWN roving composite (one tab stop per section; arrows move within it).
// Vue requires composables to be called synchronously in a component's setup,
// so each section is rendered by its own instance of this wrapper — every
// instance owns a `useArtworkGridRoving`. The cards are supplied by the parent
// through a scoped slot (`release`), so parent-scoped bindings such as the
// operator-policy select stay where they are (no prop drilling).
import { useTemplateRef } from 'vue';
import { useArtworkGridRoving } from '../../composables/useArtworkGridRoving.js';

const props = defineProps({
  releases: {
    type: Array,
    default: () => [],
  },
  ariaLabel: {
    type: String,
    default: '',
  },
});

const gridEl = useTemplateRef('grid');
useArtworkGridRoving(() => gridEl.value, {
  cellSelector: '.hx-media-card__link-area',
  count: () => props.releases.length,
});
</script>

<template>
  <ul ref="grid" class="hx-artwork-grid" role="list" :aria-label="ariaLabel || undefined">
    <li
      v-for="(release, index) in releases"
      :key="release.musicbrainzReleaseGroupId ?? index"
    >
      <slot :release="release" :index="index" />
    </li>
  </ul>
</template>
