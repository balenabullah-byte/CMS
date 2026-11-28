<script setup>
import { ref } from 'vue'
import { api } from '../lib/api'
import { usePage } from '../lib/workspace'
import ReportSeries from '../components/ReportSeries.vue'
import LoadState from '../components/LoadState.vue'
const from = ref(''),
  to = ref('')
function clearDates() {
  from.value = ''
  to.value = ''
}
const { data, loading, error, refresh } = usePage(
  (signal) => {
    const p = new URLSearchParams()
    if (from.value) p.set('from', from.value)
    if (to.value) p.set('to', to.value)
    return api('/analytics/assets?' + p, { signal })
  },
  () => [from.value, to.value]
)
</script>
<template>
  <div class="stack">
    <section class="panel">
      <div class="filterbar">
        <label>From<input type="date" v-model="from" :max="to" /></label
        ><label>To<input type="date" v-model="to" :min="from" /></label>
        <button v-if="from || to" @click="clearDates">
          Clear dates
        </button>
      </div>
      <p>
        Dates filter registrations, reported issues and completed repairs. Inventory and warranty counts
        show the current register.
      </p>
    </section>
    <LoadState :loading :error @retry="refresh"
      ><template v-if="data"
        ><dl class="metric-strip">
          <div v-for="m in data.metrics">
            <dt>{{ m.label }}</dt>
            <dd>{{ m.value ?? '—' }} {{ m.unit }}</dd>
            <small v-if="m.samples != null"
              >{{ m.samples }} {{ m.samples === 1 ? 'record' : 'records' }} with labor</small
            >
          </div>
        </dl>
        <div class="analytics-grid">
          <ReportSeries v-for="s in data.series" :key="s.title" :series="s" /></div></template
    ></LoadState>
  </div>
</template>
