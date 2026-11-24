

<script setup>
import { useRouter } from 'vue-router'
import { api } from '../lib/api'
import { roles, label, useWorkspace, useAction } from '../lib/workspace'
const w = useWorkspace(),
  router = useRouter(),
  { run, busy, error } = useAction()
function logout() {
  run(async () => {
    await api('/auth/logout', { method: 'POST' })
    w.clear()
    router.replace('/login')
  })
}
</script>
<template>
  <section class="panel narrow">
    <h2>{{ w.user.full_name }}</h2>
    <dl class="facts">
      <dt>Email</dt>
      <dd>{{ w.user.email }}</dd>
      <dt>Member type</dt>
      <dd>{{ label(w.user.member_type) }}</dd>
      <dt>Roles</dt>
      <dd>{{ w.user.roles.map((r) => roles[r]).join(', ') || 'None assigned' }}</dd>
    </dl>
    <label class="check">
      <input type="checkbox" :checked="w.collapsed" @change="w.compact($event.target.checked)" />
      Compact desktop sidebar
    </label>
    <button class="secondary" :disabled="busy" @click="logout">Sign out</button>
    <p class="error" role="alert" v-if="error">{{ error }}</p>
  </section>
</template>
