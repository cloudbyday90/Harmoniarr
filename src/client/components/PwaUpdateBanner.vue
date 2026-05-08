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
/**
 * PwaUpdateBanner — shown when a new service worker is installed and waiting.
 *
 * The banner sits above the bottom nav on mobile and above the viewport
 * bottom on desktop. It is only rendered when isUpdateAvailable is true,
 * so it costs nothing in the common case.
 */
import { usePwaUpdate } from '../composables/usePwaUpdate.js';

const { isUpdateAvailable, applyUpdate } = usePwaUpdate();
</script>

<template>
  <Transition name="pwa-banner">
    <div v-if="isUpdateAvailable" class="pwa-update-banner" role="status" aria-live="polite">
      <span class="pwa-update-banner-text">A new version of Harmoniarr is available.</span>
      <button type="button" class="pwa-update-banner-btn" @click="applyUpdate">
        Reload
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.pwa-update-banner {
  position: fixed;
  bottom: calc(var(--hx-bottom-nav-height, 56px) + var(--hx-space-3, 12px));
  left: 50%;
  transform: translateX(-50%);
  z-index: 200;
  display: flex;
  align-items: center;
  gap: var(--hx-space-3, 12px);
  padding: var(--hx-space-2, 8px) var(--hx-space-4, 16px);
  background: var(--hx-surface-1, #1e2636);
  border: 1px solid var(--hx-border, rgba(255,255,255,0.12));
  border-radius: var(--hx-radius-pill, 999px);
  box-shadow: 0 4px 20px rgba(0,0,0,0.4);
  font-size: var(--hx-text-sm, 0.875rem);
  white-space: nowrap;
}

@media (max-width: 640px) {
  .pwa-update-banner {
    /* Sit just above the bottom nav bar on mobile */
    bottom: calc(var(--hx-bottom-nav-height, 56px) + var(--hx-space-2, 8px));
    left: var(--hx-space-3, 12px);
    right: var(--hx-space-3, 12px);
    transform: none;
    white-space: normal;
    border-radius: var(--hx-radius-lg, 12px);
  }
}

@media (min-width: 641px) {
  .pwa-update-banner {
    /* On desktop there is no bottom nav — sit near the bottom of the viewport */
    bottom: var(--hx-space-5, 24px);
  }
}

.pwa-update-banner-text {
  flex: 1;
  color: var(--hx-text-primary, #f0f4ff);
}

.pwa-update-banner-btn {
  flex-shrink: 0;
  padding: var(--hx-space-1, 4px) var(--hx-space-3, 12px);
  background: var(--hx-accent, #2dd4bf);
  color: #0a0f1a;
  border: none;
  border-radius: var(--hx-radius-sm, 6px);
  font-weight: 600;
  font-size: var(--hx-text-sm, 0.875rem);
  cursor: pointer;
  min-height: 32px;
}

.pwa-update-banner-btn:hover,
.pwa-update-banner-btn:focus-visible {
  filter: brightness(1.1);
}

/* Slide-up / fade-out transition */
.pwa-banner-enter-active {
  transition: opacity 200ms ease, transform 200ms ease;
}
.pwa-banner-leave-active {
  transition: opacity 150ms ease, transform 150ms ease;
}
.pwa-banner-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(12px);
}
.pwa-banner-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(12px);
}

@media (max-width: 640px) {
  .pwa-banner-enter-from {
    opacity: 0;
    transform: translateY(12px);
  }
  .pwa-banner-leave-to {
    opacity: 0;
    transform: translateY(12px);
  }
}
</style>
