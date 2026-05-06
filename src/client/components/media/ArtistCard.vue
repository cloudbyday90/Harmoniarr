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
import ArtworkImage from '../ArtworkImage.vue';
import MonitorButton from './MonitorButton.vue';

/**
 * ArtistCard — presentational artwork-first artist card.
 *
 * Displays artist artwork, name, and metadata. Exposes a default monitor
 * action via MonitorButton and an `actions` slot for custom action overrides.
 *
 * Does not call APIs or show toasts directly. All actions are surfaced as
 * events for the parent to handle.
 */
const props = defineProps({
  /** Artist object from a MusicBrainz search result. */
  artist: {
    type: Object,
    required: true,
  },
  /** Whether this artist is already monitored. */
  monitored: {
    type: Boolean,
    default: false,
  },
  /** Whether a monitor operation is in progress for this artist. */
  monitoring: {
    type: Boolean,
    default: false,
  },
  /** Whether all card actions should be disabled. */
  disabled: {
    type: Boolean,
    default: false,
  },
  /** Optional visual variant forwarded to the card element. */
  variant: {
    type: String,
    default: null,
  },
});

const emit = defineEmits(['monitor']);

/** Readable metadata line built from available artist fields. Computed once per render. */
const meta = computed(() => {
  const parts = [];
  if (props.artist.type) parts.push(props.artist.type);
  if (props.artist.country) parts.push(props.artist.country);
  if (props.artist.disambiguation) parts.push(props.artist.disambiguation);
  return parts.join(' · ');
});

function handleMonitor() {
  emit('monitor', props.artist);
}
</script>

<template>
  <article class="hx-media-card" :data-variant="variant || undefined">
    <div class="hx-media-card__artwork">
      <ArtworkImage :alt="artist.name" />
    </div>
    <div class="hx-media-card__body">
      <p class="hx-media-card__title">{{ artist.name }}</p>
      <p v-if="meta" class="hx-media-card__meta">{{ meta }}</p>
    </div>
    <div class="hx-media-card__actions">
      <slot name="actions">
        <MonitorButton
          :monitored="monitored"
          :loading="monitoring"
          :disabled="disabled"
          :aria-label="monitored ? `${artist.name} — already monitored` : `Monitor ${artist.name}`"
          @monitor="handleMonitor"
        />
      </slot>
    </div>
  </article>
</template>
