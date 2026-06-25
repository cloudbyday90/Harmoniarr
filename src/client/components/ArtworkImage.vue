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
import { computed, defineExpose, ref, watch } from 'vue';

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

// Track which source we are currently attempting: 'local' | 'mbid' | null
const attemptingLocal = ref(true);

// The URL currently being displayed — local first, MBID as fallback.
const activeSrc = computed(() => {
  if (attemptingLocal.value && props.localSrc) return props.localSrc;
  return mbidSrc.value || null;
});

// Reset to local-first whenever the inputs change.
watch(
  [() => props.localSrc, mbidSrc],
  () => {
    attemptingLocal.value = true;
    state.value = activeSrc.value ? 'loading' : 'error';
  },
  { immediate: true },
);

function onLoad() {
  state.value = 'loaded';
}

function onError() {
  // If localSrc just failed and an MBID fallback exists, switch to it.
  if (attemptingLocal.value && props.localSrc && mbidSrc.value) {
    attemptingLocal.value = false;
    state.value = 'loading';
    return;
  }
  state.value = 'error';
}

const imgRef = ref(null);

defineExpose({ imgRef, activeSrc });
</script>

<template>
  <div class="hx-artwork" :data-state="state" :aria-hidden="!alt || undefined">
    <img
      v-if="activeSrc && state !== 'error'"
      :src="activeSrc"
      :alt="alt"
      loading="lazy"
      decoding="async"
      class="hx-artwork__img"
      :ref="(el) => { imgRef = el; }"
      @load="onLoad"
      @error="onError"
    />
    <span v-else class="hx-artwork-placeholder" aria-hidden="true">
      <slot name="fallback">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M9 18V5l12-2v13"/>
          <circle cx="6" cy="18" r="3"/>
          <circle cx="18" cy="16" r="3"/>
        </svg>
      </slot>
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
  position: relative;
  z-index: 1;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  /* Hidden until loaded so the image fades in deliberately (Batch M pattern)
     over the persistent skeleton below, instead of progressively painting
     under the loading sheen. The container's aspect-ratio reserves the
     geometry, so the opacity change is CLS-free. */
  opacity: 0;
}

.hx-artwork[data-state='loaded'] .hx-artwork__img {
  opacity: 1;
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

/* Skeleton — persists during loaded (under the z-index:1 image) so the image
   fades in over it without flashing the container background. Stops pulsing
   once loaded (the image covers it). */
.hx-artwork[data-state='loading']::after,
.hx-artwork[data-state='loaded']::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    var(--hx-bg-surface-muted) 0%,
    var(--hx-bg-surface-sunken) 50%,
    var(--hx-bg-surface-muted) 100%
  );
  background-size: 200% 100%;
}

.hx-artwork[data-state='loading']::after {
  animation: hx-skeleton-pulse 1.4s ease-in-out infinite;
}

.hx-artwork[data-state='loaded']::after {
  animation: none;
}

@media (prefers-reduced-motion: reduce) {
  .hx-artwork[data-state='loading']::after {
    animation: none;
  }
}

/* Fade the image in only when the user has not requested reduced motion
   (WCAG 2.2.2 / technique C39). Reduced-motion users get an instant appearance. */
@media (prefers-reduced-motion: no-preference) {
  .hx-artwork__img {
    transition: opacity 200ms ease;
  }
}
</style>
