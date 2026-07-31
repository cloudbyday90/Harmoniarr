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
import { computed, ref } from 'vue';

const props = defineProps({
  actionStyle: {
    default: 'full',
    type: String,
    validator: (value) => ['compact', 'full'].includes(value),
  },
  category: {
    default: '',
    type: String,
    validator: (value) => ['', 'advanced', 'optional'].includes(value),
  },
  headingLevel: {
    default: 2,
    type: Number,
    validator: (value) => Number.isInteger(value) && value >= 1 && value <= 6,
  },
  hideLabel: {
    default: 'Hide options',
    type: String,
  },
  open: {
    default: undefined,
    type: Boolean,
  },
  panelId: {
    required: true,
    type: String,
  },
  showLabel: {
    default: 'Show options',
    type: String,
  },
  startOpen: {
    default: false,
    type: Boolean,
  },
  subtitle: {
    default: '',
    type: String,
  },
  title: {
    required: true,
    type: String,
  },
  variant: {
    default: 'card',
    type: String,
    validator: (value) => ['card', 'inline'].includes(value),
  },
});

const emit = defineEmits(['update:open']);
const internalOpen = ref(props.startOpen);
const headingId = `${props.panelId}-heading`;
const headingTag = computed(() => `h${props.headingLevel}`);
const isControlled = computed(() => typeof props.open === 'boolean');
const isOpen = computed(() => isControlled.value ? props.open : internalOpen.value);
const categoryLabel = computed(() => ({
  advanced: 'Advanced',
  optional: 'Optional',
}[props.category] ?? ''));
const actionLabel = computed(() => {
  if (props.actionStyle === 'compact') {
    return isOpen.value ? 'Hide' : 'Show';
  }

  return isOpen.value ? props.hideLabel : props.showLabel;
});
const actionAriaLabel = computed(() => isOpen.value ? props.hideLabel : props.showLabel);

function toggle() {
  const nextValue = !isOpen.value;
  if (isControlled.value) {
    emit('update:open', nextValue);
    return;
  }

  internalOpen.value = nextValue;
}
</script>

<template>
  <section class="settings-disclosure" :class="{ 'settings-disclosure--inline': variant === 'inline' }">
    <div class="settings-disclosure__header">
      <div>
        <p v-if="categoryLabel" class="settings-disclosure__category">{{ categoryLabel }}</p>
        <component :is="headingTag" :id="headingId" class="settings-disclosure__title">{{ title }}</component>
        <p v-if="subtitle" class="settings-disclosure__subtitle">{{ subtitle }}</p>
      </div>
      <button
        type="button"
        class="hx-btn"
        :aria-controls="panelId"
        :aria-expanded="isOpen"
        :aria-label="actionAriaLabel"
        @click="toggle"
      >
        {{ actionLabel }}
      </button>
    </div>

    <div
      v-show="isOpen"
      :id="panelId"
      class="settings-disclosure__content"
      role="region"
      :aria-labelledby="headingId"
    >
      <slot />
    </div>
  </section>
</template>

<style scoped>
.settings-disclosure {
  background: var(--hx-bg-surface);
  border: 1px solid var(--hx-border-subtle);
  border-radius: var(--hx-radius-md);
  overflow: clip;
}

.settings-disclosure__header {
  align-items: center;
  display: flex;
  gap: var(--hx-space-4);
  justify-content: space-between;
  padding: var(--hx-space-4);
}

.settings-disclosure__title {
  color: var(--hx-text-strong);
  font-size: var(--hx-text-md);
  margin: 0;
}

.settings-disclosure__category {
  color: var(--hx-text-muted);
  font-size: var(--hx-text-xs);
  font-weight: 650;
  letter-spacing: 0.06em;
  margin: 0 0 var(--hx-space-1);
  text-transform: uppercase;
}

.settings-disclosure__subtitle {
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
  margin: var(--hx-space-1) 0 0;
}

.settings-disclosure__content {
  border-top: 1px solid var(--hx-border-subtle);
  padding: var(--hx-space-4);
}

.settings-disclosure--inline {
  background: transparent;
  border: 0;
  border-top: 1px solid var(--hx-border-subtle);
  border-radius: 0;
  margin-top: var(--hx-space-2);
}

.settings-disclosure--inline .settings-disclosure__header {
  padding: var(--hx-space-3) 0 0;
}

.settings-disclosure--inline .settings-disclosure__content {
  border-top: 0;
  padding: var(--hx-space-3) 0 0;
}

@media (max-width: 640px) {
  .settings-disclosure__header {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
