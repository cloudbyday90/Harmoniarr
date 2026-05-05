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
        <h1 class="hx-page-title">Missing</h1>
        <p class="hx-page-subtitle">Missing albums, songs, partials, and quality upgrade gaps across the monitored library.</p>
      </div>
    </header>

    <ComingSoonPanel
      title="Missing acquisition workspace"
      description="Filters for artist, album, type, kind, monitored state, quality, and last-search age, with bulk Search / Manual / Ignore / Unmonitor / Mark Satisfied actions."
    />
  </section>
</template>
