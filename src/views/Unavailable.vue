<script setup>
import { useWorkspace } from '../lib/workspace'
const w = useWorkspace()
</script>
<template>
  <section class="panel">
    <h2>This page is unavailable</h2>
    <p>{{ w.available.length ? 'Check the address and the portal assigned to your account.' : 'Your account needs a portal role. Contact a university administrator for access.' }}</p>
    <RouterLink v-if="w.available.length" to="/">Return to dashboard</RouterLink>
    <RouterLink v-else :to="w.path('/profile')">Account and sign out</RouterLink>
  </section>
</template>
