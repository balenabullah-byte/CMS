<script setup>
defineProps({ loading: Boolean, error: String })
defineEmits(['retry'])
</script>
<template>
  <div v-if="loading" class="panel muted" role="status" aria-busy="true">Loading…</div>
  <div v-else-if="error" class="panel">
    <p class="error" role="alert">{{ error }}</p>
    <div class="actions"><button class="secondary" @click="$emit('retry')">Try again</button>
      <slot name="recovery"><RouterLink to="/">Dashboard</RouterLink></slot>
    </div>
  </div>
  <slot v-else />
</template>
