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
import { computed, reactive, ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import AuthEntryShell from '../components/AuthEntryShell.vue';
import { startPlexSignIn } from '../lib/auth-api.js';
import { buildAuthEntrySupportItems } from '../lib/auth-entry-support.js';
import { navigateAfterAuthSuccess } from '../lib/auth-navigation.js';
import { buildClaimAccountRoute, buildLoginDescription, buildLoginInfoMessage } from '../lib/login-presentation.js';
import { useAutoFocus } from '../composables/useAutoFocus.js';
import { sessionStore } from '../state/session.js';

const route = useRoute();
const router = useRouter();
const firstInput = ref(null);
const form = reactive({
  username: typeof route.query.username === 'string' ? route.query.username : '',
  password: '',
});
const errorMessage = ref('');
const isStartingPlex = ref(false);
const isSubmitting = ref(false);
const infoMessage = computed(() => buildLoginInfoMessage(
  typeof route.query.reason === 'string' ? route.query.reason : undefined,
));
const supportItems = computed(() => buildAuthEntrySupportItems('login', { username: form.username }));
useAutoFocus(firstInput);

async function submit() {
  errorMessage.value = '';
  isSubmitting.value = true;
  try {
    await sessionStore.login(form);
    await navigateAfterAuthSuccess({
      router,
      target: typeof route.query.redirect === 'string' ? route.query.redirect : { name: 'dashboard' },
    });
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Login failed';
  } finally {
    isSubmitting.value = false;
  }
}

async function startPlex() {
  errorMessage.value = '';
  isStartingPlex.value = true;

  try {
    const payload = await startPlexSignIn({
      redirect: typeof route.query.redirect === 'string' ? route.query.redirect : '/app',
    });
    const authorizationUrl = typeof payload?.authorizationUrl === 'string'
      ? payload.authorizationUrl
      : '';

    if (!authorizationUrl) {
      throw new Error('Plex sign-in URL was not returned');
    }

    globalThis.location.assign(authorizationUrl);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Plex sign-in failed';
  } finally {
    isStartingPlex.value = false;
  }
}
</script>

<template>
  <AuthEntryShell
    title="Log in to Harmoniarr"
    :description="buildLoginDescription()"
    :support-items="supportItems"
  >
    <template #status>
      <article class="panel-light bootstrap-status-card" v-if="infoMessage">
        <p class="eyebrow">Session status</p>
        <h2>Continue with local login</h2>
        <p class="auth-entry-inline-status">{{ infoMessage }}</p>
      </article>
    </template>

    <article class="form-card panel-light auth-entry-form-card">
      <p class="auth-entry-form-copy">Enter your username or email and password to access your account.</p>
      <form class="stack-form" @submit.prevent="submit">
        <label>
          Username or email
          <input
            id="username"
            ref="firstInput"
            v-model="form.username"
            name="username"
            autocomplete="username"
            autocapitalize="none"
            spellcheck="false"
            required
          />
        </label>
        <label>
          Password
          <input
            id="current-password"
            v-model="form.password"
            name="password"
            type="password"
            autocomplete="current-password"
            required
          />
        </label>
        <p class="error-copy" v-if="errorMessage">{{ errorMessage }}</p>
        <button type="submit" :disabled="isSubmitting">
          {{ isSubmitting ? 'Logging in...' : 'Log in' }}
        </button>
      </form>
      <div class="auth-entry-divider" aria-hidden="true">or</div>
      <button type="button" class="hx-btn" @click="startPlex" :disabled="isStartingPlex || isSubmitting">
        {{ isStartingPlex ? 'Redirecting to Plex…' : 'Continue with Plex' }}
      </button>
      <p class="auth-entry-inline-note">Use your Plex account when it is already linked to a direct-sign-in-capable Harmoniarr user.</p>
      <p class="auth-entry-inline-note">First time here? <RouterLink :to="buildClaimAccountRoute(form.username)">Claim your account</RouterLink> with the code from your administrator.</p>
    </article>
  </AuthEntryShell>
</template>
