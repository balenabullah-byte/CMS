<script setup>
import { ref } from 'vue'
import { api } from '../lib/api'
import { usePage, useWorkspace, useAction, label } from '../lib/workspace'
import { assetStatuses } from '../lib/assets'
import AssetHistory from './AssetHistory.vue'
import LoadState from './LoadState.vue'
const props = defineProps({ requestId: [Number, String], status: String })
const w = useWorkspace(),
  page = ref(1)
const condition = ref(''),
  note = ref(''),
  { run, busy, error: failure } = useAction()
function recommend() {
  run(async () => {
    await api('/maintenance-requests/' + props.requestId + '/comments', {
      method: 'POST',
      body: {
        visibility: 'staff_only',
        body: 'Equipment condition recommendation: ' + label(condition.value) + '. ' + note.value,
      },
    })
    condition.value = ''
    note.value = ''
    w.notice = 'Condition recommendation recorded in staff comments.'
  })
}
const { data, loading, error, refresh } = usePage(
  (signal) =>
    api(
      '/maintenance-requests/' + props.requestId + '/equipment?limit=20&offset=' + (page.value - 1) * 20,
      { signal }
    ),
  () => [props.requestId, page.value]
)
</script>
<template>
  <section class="panel">
    <h2>Reported equipment</h2>
    <LoadState :loading :error @retry="refresh"
      ><template v-if="data">
        <strong>{{ data.asset.name }}</strong> ·
        <RouterLink v-if="w.has('coordinator')" :to="w.path('/assets/' + data.asset.id)">{{
          data.asset.asset_code
        }}</RouterLink
        ><span v-else>{{ data.asset.asset_code }}</span>
        <dl class="facts" v-if="data.asset.category">
          <dt>Category</dt>
          <dd>{{ data.asset.category }}</dd>
          <dt>Current location</dt>
          <dd>{{ [data.asset.building, data.asset.room_code].filter(Boolean).join(' · ') }}</dd>
          <dt>Equipment status</dt>
          <dd>{{ label(data.asset.operational_status) }}</dd>
          <template v-for="k in ['manufacturer', 'model', 'serial_number']"
            ><dt>{{ label(k) }}</dt>
            <dd>{{ data.asset[k] || 'Not recorded' }}</dd></template
          >
          <template v-if="w.has('coordinator')"
            ><dt>Warranty expiry</dt>
            <dd>{{ data.asset.warranty_expires_at || 'Not recorded' }}</dd></template
          >
        </dl>
        <details v-if="data.history">
          <summary>
            {{ w.has('technician') ? 'Previous repairs' : 'Equipment maintenance history' }}
          </summary>
          <AssetHistory :records="data.history" :page @go="page = $event" />
        </details>
        <details v-if="data.history && !['closed', 'rejected'].includes(status)">
          <summary>Recommend a condition change</summary>
          <form @submit.prevent="recommend">
            <label
              >Recommended condition<select required v-model="condition">
                <option value="" disabled>Select condition</option>
                <option v-for="s in assetStatuses" :value="s">{{ label(s) }}</option>
              </select></label
            >
            <label>Staff note<textarea v-model.trim="note" required maxlength="1000" /></label>
            <p v-if="failure" role="alert">{{ failure }}</p>
            <button :disabled="busy">Record recommendation</button>
          </form>
        </details>
      </template></LoadState
    >
  </section>
</template>
