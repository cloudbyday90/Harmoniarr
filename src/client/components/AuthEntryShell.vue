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
    required: true,
    type: String,
  },
  detail: {
    default: '',
    type: String,
  },
  eyebrow: {
    required: true,
    type: String,
  },
  supportCopy: {
    default: 'Choose the path that matches your current task. Related access routes stay outside the primary form so the main action remains clear.',
    type: String,
  },
  supportItems: {
    default: () => [],
    type: Array,
  },
  supportLabel: {
    default: 'Access paths',
    type: String,
  },
  supportTitle: {
    default: 'Related entry points',
    type: String,
  },
  title: {
    required: true,
    type: String,
  },
});
</script>

<template>
  <section class="auth-layout auth-entry-layout">
    <aside class="panel-dark auth-entry-hero">
      <div class="auth-entry-copy">
        <p class="eyebrow">{{ eyebrow }}</p>
        <h1>{{ title }}</h1>
        <p class="auth-entry-body-copy">{{ description }}</p>
        <p v-if="detail" class="auth-entry-detail-copy">{{ detail }}</p>
      </div>

      <article class="auth-entry-context-card">
        <p class="eyebrow">{{ supportLabel }}</p>
        <strong class="auth-entry-context-title">{{ supportTitle }}</strong>
        <p class="auth-entry-context-copy">{{ supportCopy }}</p>

        <div class="auth-entry-support-list" v-if="supportItems.length">
          <template v-for="item in supportItems" :key="item.id">
            <RouterLink v-if="item.to" class="auth-entry-support-item" :to="item.to">
              <strong>{{ item.label }}</strong>
              <p>{{ item.description }}</p>
            </RouterLink>
            <article v-else class="auth-entry-support-item">
              <strong>{{ item.label }}</strong>
              <p>{{ item.description }}</p>
            </article>
          </template>
        </div>
      </article>

      <slot name="hero-footer" />
    </aside>

    <main class="auth-entry-content">
      <slot name="status" />
      <slot />
    </main>
  </section>
</template>