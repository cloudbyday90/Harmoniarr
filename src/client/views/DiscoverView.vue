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
import EmptyState from '../components/EmptyState.vue';
</script>

<template>
  <div class="hx-page">
    <header class="hx-page-header">
      <div>
        <h1 class="hx-page-title">Discover</h1>
        <p class="hx-page-subtitle">Find artists you love and monitor them for new releases.</p>
      </div>
    </header>

    <EmptyState
      title="Start with an artist you love"
      body="Search for an artist to begin building your monitored collection. Once you monitor artists, Harmoniarr will surface new releases for you to request."
      variant="discover"
    >
      <template #icon>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7"/>
          <path d="m20 20-3.5-3.5"/>
          <path d="M11 8v6M8 11h6"/>
        </svg>
      </template>

      <template #cta>
        <RouterLink :to="{ name: 'search' }" class="hx-btn" data-variant="primary">
          Search for an artist
        </RouterLink>
      </template>
    </EmptyState>
  </div>
</template>
