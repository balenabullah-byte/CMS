<script setup>
import { computed } from 'vue'
import { causes } from '../../shared/maintenance.js'
import { label } from '../lib/workspace'
const props=defineProps({series:Object,link:Function})
const max=computed(()=>Math.max(1,...props.series.rows.map(r=>Number(r.value))))
function name(v){return String(v).split(' / ').map(k=>causes[k] || (k==='missing'?'Not recorded':label(k))).join(' / ')}
</script>
<template><section class="panel report-series"><h2>{{ series.title }}</h2>
  <p v-if="!series.rows.length" class="empty">No observations for these filters.</p>
  <ol v-else><li v-for="r in series.rows" :key="r.label">
    <RouterLink v-if="link?.(r)" :to="link(r)">{{ name(r.label) }}</RouterLink><span v-else>{{ name(r.label) }}</span>
    <i aria-hidden="true"><i :style="{width:100*r.value/max+'%'}"/></i><strong>{{ r.value }}</strong>
  </li></ol></section></template>
