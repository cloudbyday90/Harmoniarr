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

const props = defineProps({
  description: {
    default: '',
    type: String,
  },
  kind: {
    default: '',
    type: String,
    validator: (value) => ['', 'core', 'optional'].includes(value),
  },
  title: {
    required: true,
    type: String,
  },
});

const kindLabel = computed(() => ({
  core: 'Main setup',
  optional: 'Optional',
}[props.kind] ?? ''));
</script>

<template>
  <fieldset class="settings-form-group">
    <legend class="settings-form-group__legend">
      <span>{{ title }}</span>
      <span v-if="kindLabel" class="settings-form-group__kind">{{ kindLabel }}</span>
    </legend>
    <p v-if="description" class="settings-form-group__description">{{ description }}</p>
    <div class="settings-form-group__controls">
      <slot />
    </div>
  </fieldset>
</template>

<style scoped>
.settings-form-group {
  border: 0;
  display: grid;
  gap: var(--hx-space-3);
  margin: 0;
  min-inline-size: 0;
  padding: 0;
}

.settings-form-group + .settings-form-group {
  border-top: 1px solid var(--hx-border-subtle);
  padding-top: var(--hx-space-4);
}

.settings-form-group__legend {
  align-items: center;
  color: var(--hx-text-strong);
  display: flex;
  flex-wrap: wrap;
  font-size: var(--hx-text-sm);
  font-weight: 650;
  gap: var(--hx-space-2);
  margin: 0;
  padding: 0;
}

.settings-form-group__kind {
  color: var(--hx-text-muted);
  font-size: var(--hx-text-xs);
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.settings-form-group__description {
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
  line-height: 1.45;
  margin: calc(-1 * var(--hx-space-2)) 0 0;
}

.settings-form-group__controls {
  display: grid;
  gap: var(--hx-space-3);
}
</style>
