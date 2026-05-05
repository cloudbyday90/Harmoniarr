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
import ComingSoonPanel from '../components/ComingSoonPanel.vue';
</script>

<template>
  <section class="hx-page">
    <header class="hx-page-header">
      <div>
        <h1 class="hx-page-title">Search</h1>
        <p class="hx-page-subtitle">Manual Soulseek discovery: query, filter, select, and correlate results to wanted items.</p>
      </div>
    </header>

    <ComingSoonPanel
      title="Manual Soulseek search workspace"
      description="Multi-mode query (artist / album / track / folder), large result table with bulk selection, folder browsing, and correlate / override actions back into the library."
    />
  </section>
</template>
