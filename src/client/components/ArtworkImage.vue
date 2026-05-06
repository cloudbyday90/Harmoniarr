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
import { computed, ref, watch } from 'vue';

const props = defineProps({
  /** Local artwork URL — preferred when available. */
  localSrc: {
    type: String,
    default: null,
  },
  /** MusicBrainz ID used to build a Cover Art Archive fallback URL. */
  mbid: {
    type: String,
    default: null,
  },
  /** MusicBrainz entity type: 'release' or 'release-group'. */
  mbidType: {
    type: String,
    default: 'release',
    validator: (v) => ['release', 'release-group'].includes(v),
  },
  /** Accessible alt text for the image. */
  alt: {
    type: String,
    default: '',
  },
});

const coverArtBaseUrl = 'https://coverartarchive.org';

const mbidSrc = computed(() => {
  if (!props.mbid) return null;
  if (props.mbidType === 'release-group') {
    return `${coverArtBaseUrl}/release-group/${props.mbid}/front`;
  }
  return `${coverArtBaseUrl}/release/${props.mbid}/front`;
});

// State machine: 'loading' | 'loaded' | 'error'
const state = ref('loading');

// The URL we are currently trying to display.
const activeSrc = computed(() => props.localSrc || mbidSrc.value || null);

// Reset state whenever the effective source changes.
watch(activeSrc, () => {
  state.value = activeSrc.value ? 'loading' : 'error';
}, { immediate: true });

function onLoad() {
  state.value = 'loaded';
}

function onError() {
  // If local src failed and there is an MBID fallback, the browser will try the
  // mbidSrc next tick because activeSrc prefers localSrc. Since we're using a
  // single <img> we only need to track the error state here; the template
  // conditionally renders the correct src.
  state.value = 'error';
}
</script>

<template>
  <div class="hx-artwork" :data-state="state" aria-hidden="true">
    <img
      v-if="activeSrc && state !== 'error'"
      :src="activeSrc"
      :alt="alt"
      loading="lazy"
      class="hx-artwork__img"
      @load="onLoad"
      @error="onError"
    />
    <span v-else class="hx-artwork-placeholder" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M9 18V5l12-2v13"/>
        <circle cx="6" cy="18" r="3"/>
        <circle cx="18" cy="16" r="3"/>
      </svg>
    </span>
  </div>
</template>

<style scoped>
.hx-artwork {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 1 / 1;
  background: var(--hx-bg-surface-sunken);
  border-radius: var(--hx-radius-md);
  overflow: hidden;
  flex-shrink: 0;
}

.hx-artwork__img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hx-artwork-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--hx-text-faint);
}

.hx-artwork-placeholder svg {
  width: 40%;
  height: 40%;
  opacity: 0.5;
}

/* Loading shimmer */
.hx-artwork[data-state='loading']::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.06) 50%,
    transparent 100%
  );
  background-size: 200% 100%;
  animation: hx-artwork-shimmer 1.4s ease-in-out infinite;
}

@keyframes hx-artwork-shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
}
</style>
