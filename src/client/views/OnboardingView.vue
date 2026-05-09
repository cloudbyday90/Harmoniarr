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
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import OnboardingSummaryPanel from '../components/OnboardingSummaryPanel.vue';
import { useOnboardingSummary } from '../composables/useOnboardingSummary.js';

const router = useRouter();

const {
  errorMessage,
  isLoading,
  loadOnboardingSummary,
  nextAction,
  steps,
  summary,
} = useOnboardingSummary();

onMounted(() => {
  void loadOnboardingSummary();
});

function dismiss() {
  void router.push({ name: 'dashboard' });
}
</script>

<template>
  <div class="hx-page">
    <OnboardingSummaryPanel
      :error-message="errorMessage"
      :is-loading="isLoading"
      :is-setup-mode="true"
      :next-action="nextAction"
      :steps="steps"
      :summary="summary"
      @dismiss="dismiss"
      @refresh="loadOnboardingSummary"
    />
  </div>
</template>
