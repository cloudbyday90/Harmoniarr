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
  /** Heading text for the empty state. */
  title: {
    type: String,
    required: true,
  },
  /** Supporting body copy. */
  body: {
    type: String,
    default: null,
  },
  /** Label for an optional call-to-action button. */
  ctaLabel: {
    type: String,
    default: null,
  },
  /**
   * When provided, the CTA renders as a `<RouterLink>` pointing to this route
   * name. When omitted, the `cta` slot is used for custom CTA content.
   */
  ctaTo: {
    type: [String, Object],
    default: null,
  },
  /**
   * Visual variant. Currently 'default' and 'discover' are defined;
   * additional variants can be added as needed.
   */
  variant: {
    type: String,
    default: 'default',
  },
});
</script>

<template>
  <div class="hx-empty" :data-variant="variant">
    <div class="hx-empty-icon" aria-hidden="true">
      <slot name="icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 18V5l12-2v13"/>
          <circle cx="6" cy="18" r="3"/>
          <circle cx="18" cy="16" r="3"/>
        </svg>
      </slot>
    </div>

    <h3 class="hx-empty-title">{{ title }}</h3>

    <p v-if="body" class="hx-empty-copy">{{ body }}</p>

    <div v-if="ctaTo || $slots.cta" class="hx-empty-actions">
      <RouterLink
        v-if="ctaTo"
        :to="typeof ctaTo === 'string' ? { name: ctaTo } : ctaTo"
        class="hx-btn"
        data-variant="primary"
      >
        {{ ctaLabel || 'Get started' }}
      </RouterLink>
      <slot v-else name="cta" />
    </div>
  </div>
</template>

<style scoped>
.hx-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--hx-space-3);
  padding: var(--hx-space-8) var(--hx-space-6);
  text-align: center;
  background: var(--hx-bg-surface);
  border: 1px dashed var(--hx-border);
  border-radius: var(--hx-radius-lg);
}

.hx-empty-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--hx-text-faint);
  opacity: 0.7;
}

.hx-empty-icon svg {
  width: 100%;
  height: 100%;
}

.hx-empty-title {
  margin: 0;
  font-size: var(--hx-text-md);
  font-weight: 600;
  color: var(--hx-text-strong);
}

.hx-empty-copy {
  margin: 0;
  font-size: var(--hx-text-sm);
  color: var(--hx-text-muted);
  line-height: 1.55;
  max-width: 36em;
}

.hx-empty-actions {
  margin-top: var(--hx-space-2);
  display: flex;
  gap: var(--hx-space-2);
  align-items: center;
  flex-wrap: wrap;
  justify-content: center;
}

/* Discover variant — slightly wider, taller breathing room */
.hx-empty[data-variant='discover'] {
  padding: var(--hx-space-8) var(--hx-space-7);
  border-style: dashed;
  background: linear-gradient(160deg, var(--hx-bg-surface) 60%, var(--hx-accent-soft) 100%);
}
</style>
