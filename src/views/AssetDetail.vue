<script setup>
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '../lib/api'
import { useWorkspace, usePage, date, label } from '../lib/workspace'
import { assetDates, dateLabels } from '../lib/assets'
import LoadState from '../components/LoadState.vue'
import ReportPager from '../components/ReportPager.vue'
import AssetDialog from '../components/AssetDialog.vue'
import AssetHistory from '../components/AssetHistory.vue'
import Badge from '../components/Badge.vue'
const w = useWorkspace(),
  id = useRoute().params.id,
  path = '/assets/' + id,
  mode = ref(''),
  tab = ref('history'),
  page = ref(1)
const { data, loading, error, refresh } = usePage((signal) => api(path, { signal }))
const log = usePage(
  (signal) => api(path + '/' + tab.value + '?limit=20&offset=' + (page.value - 1) * 20, { signal }),
  () => [tab.value, page.value]
)
async function saved() {
  mode.value = ''
  await Promise.all([refresh(), log.refresh()])
}
function select(t) {
  tab.value = t
  page.value = 1
}
</script>
<template>
  <div class="stack">
    <RouterLink :to="w.path('/assets')">← Equipment register</RouterLink>
    <LoadState :loading :error @retry="refresh"
      ><template v-if="data"
        ><section class="panel">
          <div class="split">
            <div>
              <small>{{ data.asset_code }}</small>
              <h2>{{ data.name }}</h2>
              <RouterLink v-if="w.has('admin')" :to="w.path('/qr-labels')+'?type=asset&id='+id">Equipment QR label</RouterLink>
            </div>
            <Badge :value="data.operational_status" />
          </div>
          <p>{{ data.category }} · {{ [data.building, data.room_code].filter(Boolean).join(' · ') }}</p>
          <div class="actions" v-if="w.has('admin') && data.operational_status !== 'retired'">
            <button @click="mode = 'edit'">Edit equipment</button
            ><button @click="mode = 'status'">Change status</button
            ><button @click="mode = 'transfer'">Transfer</button
            ><button @click="mode = 'retire'">Retire</button>
          </div>
        </section>
        <section class="panel">
          <h2>Equipment details</h2>
          <dl class="facts">
            <template v-for="k in ['manufacturer', 'model', 'serial_number', ...assetDates]"
              ><dt>{{ dateLabels[k] || label(k) }}</dt>
              <dd>{{ data[k] || 'Not recorded' }}</dd></template
            >
            <dt>Registered</dt>
            <dd>{{ date(data.created_at) }}</dd>
            <template v-if="data.retired_at"
              ><dt>Retired</dt>
              <dd>{{ date(data.retired_at) }} · {{ data.retirement_reason }}</dd></template
            >
          </dl>
          <p v-if="data.description">{{ data.description }}</p>
        </section>
        <section class="panel">
          <div class="actions">
            <button
              v-for="t in ['history', 'locations']"
              :aria-pressed="t === tab"
              :class="{ primary: t === tab }"
              @click="select(t)"
            >
              {{ t === 'history' ? 'Maintenance history' : 'Location history' }}
            </button>
          </div>
          <LoadState :loading="log.loading.value" :error="log.error.value" @retry="log.refresh"
            ><template v-if="log.data.value">
              <AssetHistory
                v-if="tab === 'history'"
                :records="log.data.value"
                :page
                @go="page = $event" />
              <template v-else
                ><p v-if="!log.data.value.total" class="empty">No transfers recorded.</p>
                <div v-for="r in log.data.value.rows" :key="r.id" class="entry">
                  <strong
                    >{{ [r.previous_building, r.previous_room].filter(Boolean).join(' · ') }} →
                    {{ [r.new_building, r.new_room].filter(Boolean).join(' · ') }}</strong
                  >
                  <p>{{ r.reason }}</p>
                  <small>{{ r.actor }} · {{ date(r.created_at) }}</small>
                </div>
                <ReportPager
                  v-if="log.data.value.total > 20"
                  :total="log.data.value.total"
                  :page
                  @go="page = $event" /></template></template
          ></LoadState>
        </section>
        <AssetDialog v-if="mode" :mode :row="data" @close="mode = ''" @saved="saved" /></template
    ></LoadState>
  </div>
</template>
