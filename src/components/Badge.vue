<script setup>
import { label } from '../lib/workspace'
defineProps({ value: String })
</script>
<template>
  <span class="badge-state" :class="'tone-' + value">{{ label(value) }}</span>
</template>
