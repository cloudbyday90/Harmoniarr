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
import { RouterLink } from 'vue-router';

defineProps({
  step: {
    required: true,
    type: Object,
  },
});
</script>

<template>
  <section class="settings-setup-next-action" :data-tone="step.tone" aria-labelledby="settings-setup-next-action-title">
    <p class="settings-setup-next-action__eyebrow">Your next step</p>
    <h3 id="settings-setup-next-action-title" class="settings-setup-next-action__title">{{ step.title }}</h3>
    <p class="settings-setup-next-action__copy">{{ step.copy }}</p>
    <RouterLink class="hx-btn" data-variant="primary" :to="{ name: step.routeName }">
      {{ step.label }}
    </RouterLink>
  </section>
</template>

<style scoped>
.settings-setup-next-action {
  border-left: 3px solid var(--hx-warning);
  margin-top: var(--hx-space-4);
  padding: var(--hx-space-3) 0 var(--hx-space-3) var(--hx-space-3);
}

.settings-setup-next-action[data-tone='danger'] {
  border-left-color: var(--hx-danger);
}

.settings-setup-next-action[data-tone='info'] {
  border-left-color: var(--hx-info);
}

.settings-setup-next-action__eyebrow {
  color: var(--hx-text-muted);
  font-size: var(--hx-text-xs);
  font-weight: 650;
  letter-spacing: 0.06em;
  margin: 0;
  text-transform: uppercase;
}

.settings-setup-next-action__title {
  color: var(--hx-text-strong);
  font-size: var(--hx-text-md);
  margin: var(--hx-space-1) 0 0;
}

.settings-setup-next-action__copy {
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
  margin: var(--hx-space-1) 0 0;
}

.settings-setup-next-action .hx-btn {
  margin-top: var(--hx-space-3);
}
</style>
