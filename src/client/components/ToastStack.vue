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
import { useToast } from '../composables/useToast.js';

const { toasts, dismiss } = useToast();
</script>

<template>
  <div
    v-if="toasts.length"
    class="hx-toast-stack"
    role="region"
    aria-live="polite"
    aria-label="Notifications"
  >
    <TransitionGroup name="hx-toast" tag="ul" class="hx-toast-list">
      <li
        v-for="toast in toasts"
        :key="toast.id"
        class="hx-toast"
        :data-tone="toast.tone"
        role="status"
      >
        <span class="hx-toast__message">{{ toast.message }}</span>
        <button
          type="button"
          class="hx-toast__dismiss"
          :aria-label="`Dismiss: ${toast.message}`"
          @click="dismiss(toast.id)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>
      </li>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.hx-toast-stack {
  position: fixed;
  bottom: var(--hx-space-5);
  right: var(--hx-space-5);
  z-index: 200;
  width: 340px;
  max-width: calc(100vw - var(--hx-space-5) * 2);
  pointer-events: none;
}

.hx-toast-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--hx-space-2);
}

.hx-toast {
  display: flex;
  align-items: flex-start;
  gap: var(--hx-space-3);
  padding: var(--hx-space-3) var(--hx-space-4);
  background: var(--hx-bg-surface);
  border: 1px solid var(--hx-border);
  border-radius: var(--hx-radius-md);
  box-shadow: var(--hx-shadow-lg);
  font-size: var(--hx-text-sm);
  color: var(--hx-text);
  pointer-events: all;
}

.hx-toast[data-tone='success'] {
  border-left: 3px solid var(--hx-success);
}

.hx-toast[data-tone='error'] {
  border-left: 3px solid var(--hx-danger);
}

.hx-toast[data-tone='warning'] {
  border-left: 3px solid var(--hx-warning);
}

.hx-toast[data-tone='info'] {
  border-left: 3px solid var(--hx-info);
}

.hx-toast__message {
  flex: 1;
  line-height: 1.45;
}

.hx-toast__dismiss {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  background: transparent;
  border: 0;
  border-radius: var(--hx-radius-xs);
  color: var(--hx-text-muted);
  cursor: pointer;
  padding: 0;
  margin-top: 1px;
}

.hx-toast__dismiss:hover {
  background: var(--hx-bg-surface-muted);
  color: var(--hx-text-strong);
}

.hx-toast__dismiss svg {
  width: 14px;
  height: 14px;
}

/* Transition */
.hx-toast-enter-active {
  transition: transform 220ms ease, opacity 220ms ease;
}
.hx-toast-leave-active {
  transition: transform 180ms ease, opacity 180ms ease;
}
.hx-toast-enter-from {
  transform: translateX(20px);
  opacity: 0;
}
.hx-toast-leave-to {
  transform: translateX(20px);
  opacity: 0;
}
.hx-toast-move {
  transition: transform 200ms ease;
}

/* ── Mobile: lift toasts above the bottom navigation bar ────────────────── */
@media (max-width: 640px) {
  .hx-toast-stack {
    /* Sit just above the bottom nav so toasts are never hidden behind it */
    bottom: calc(var(--hx-bottom-nav-height, 60px) + var(--hx-space-3, 12px));
    /* Full-width with symmetric gutters */
    left: var(--hx-space-3, 12px);
    right: var(--hx-space-3, 12px);
    width: auto;
    max-width: none;
  }

  /* Slide in from bottom on mobile instead of from the right */
  .hx-toast-enter-from,
  .hx-toast-leave-to {
    transform: translateY(8px);
    opacity: 0;
  }
}
</style>
