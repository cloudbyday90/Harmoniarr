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
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { sessionStore } from '../state/session.js';

const route = useRoute();
const router = useRouter();
const form = reactive({ username: '', password: '' });
const errorMessage = ref('');
const isSubmitting = ref(false);

async function submit() {
  errorMessage.value = '';
  isSubmitting.value = true;
  try {
    await sessionStore.login(form);
    await router.push(typeof route.query.redirect === 'string' ? route.query.redirect : { name: 'dashboard' });
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Login failed';
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <section class="auth-layout">
    <article class="hero-card panel-dark">
      <p class="eyebrow">Browser auth</p>
      <h1>Sign in to Harmoniarr</h1>
      <p>
        Session cookies and CSRF protection are now active. Login uses the same local
        auth model planned in the implementation docs.
      </p>
    </article>

    <article class="form-card panel-light">
      <h2>Login</h2>
      <form class="stack-form" @submit.prevent="submit">
        <label>
          Username
          <input v-model="form.username" autocomplete="username" required />
        </label>
        <label>
          Password
          <input v-model="form.password" type="password" autocomplete="current-password" required />
        </label>
        <p class="error-copy" v-if="errorMessage">{{ errorMessage }}</p>
        <button type="submit" :disabled="isSubmitting">
          {{ isSubmitting ? 'Signing in...' : 'Login' }}
        </button>
      </form>
    </article>
  </section>
</template>
