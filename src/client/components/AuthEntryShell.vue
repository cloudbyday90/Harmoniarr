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
  description: {
    default: '',
    type: String,
  },
  eyebrow: {
    default: '',
    type: String,
  },
  supportItems: {
    default: () => [],
    type: Array,
  },
  title: {
    required: true,
    type: String,
  },
});
</script>

<template>
  <div class="auth-page">
    <div class="auth-shell">
      <div class="auth-shell-wordmark" aria-label="Harmoniarr">Harmoniarr</div>

      <header class="auth-shell-heading">
        <p v-if="eyebrow" class="eyebrow">{{ eyebrow }}</p>
        <h1>{{ title }}</h1>
        <p v-if="description">{{ description }}</p>
      </header>

      <slot name="status" />

      <slot />

      <nav v-if="supportItems.length" class="auth-footer-links" aria-label="Related entry points">
        <template v-for="item in supportItems" :key="item.id">
          <RouterLink v-if="item.to" class="auth-footer-link" :to="item.to">{{ item.label }}</RouterLink>
          <span v-else class="auth-footer-link auth-footer-link--static">{{ item.label }}</span>
        </template>
      </nav>
    </div>
  </div>
</template>