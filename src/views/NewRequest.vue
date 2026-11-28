<script setup>
import { reactive, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../lib/api'
import {assetOptions} from '../lib/assets'
import { useWorkspace, usePage, useAction } from '../lib/workspace'
import LoadState from '../components/LoadState.vue'
const w = useWorkspace(),
  router = useRouter(),
  form = reactive({
    building_id: '',
    room_id: '',
    asset_id: '',
    category_id: '',
    title: '',
    description: '',
    location_note: '',
  })
const { data, loading, error, refresh } = usePage(() => w.catalog()),
  { run, busy, error: failure } = useAction()
const rooms = computed(
  () => data.value?.rooms.filter((r) => r.is_active && r.building_id === form.building_id) || [],
)
watch(()=>[form.building_id,form.room_id],()=>{form.asset_id=''})
const equipment=usePage(signal=>form.building_id?assetOptions('/asset-lookup',{
  building_id:form.building_id,...(form.room_id && {room_id:form.room_id})
},signal):[],()=>[form.building_id,form.room_id])
function submit() {
  run(async () => {
    const body = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== ''))
    const row = await api('/maintenance-requests', { method: 'POST', body })
    w.notice = 'Request #' + row.id + ' submitted.'
    await router.push('/requests/' + row.id)
  })
}
</script>
<template>
  <LoadState :loading :error @retry="refresh">
    <form v-if="data" class="panel narrow" @submit.prevent="submit">
      <h2>Report a maintenance issue</h2>
      <label>
        Building
        <select aria-label="Building" v-model="form.building_id" required @change="form.room_id = ''">
          <option disabled value="">Select a building</option>
          <option v-for="b in data.buildings.filter((b) => b.is_active)" :value="b.id">
            {{ b.name }}
          </option>
        </select>
      </label>
      <label>
        Room (optional)
        <select aria-label="Room (optional)" v-model="form.room_id">
          <option value="">No room selected</option>
          <option v-for="r in rooms" :value="r.id">{{ r.room_code }}</option>
        </select>
      </label>
      <label>
        Equipment (optional)
        <select v-model="form.asset_id" :disabled="!form.building_id || equipment.loading.value">
          <option value="">General location issue</option>
          <option v-for="e in equipment.data.value" :key="e.id" :value="e.id">{{ e.asset_code }} · {{ e.name }}</option>
        </select>
      </label>
      <p v-if="equipment.error.value" role="alert">{{equipment.error.value}} <button type="button" @click="equipment.refresh">Retry equipment lookup</button></p>
      <label>
        Category
        <select aria-label="Category" v-model="form.category_id" required>
          <option disabled value="">Select a category</option>
          <option v-for="c in data.categories.filter((c) => c.is_active)" :value="c.id">
            {{ c.name }}
          </option>
        </select>
      </label>
      <label>
        Title
        <input required maxlength="150" v-model.trim="form.title" />
      </label>
      <label>
        Description
        <textarea required maxlength="12000" v-model.trim="form.description" />
      </label>
      <label>
        Location note (optional)
        <input maxlength="255" v-model.trim="form.location_note" />
      </label>
      <p v-if="failure" class="error" role="alert">{{ failure }}</p>
      <button class="primary" :disabled="busy">Submit request</button>
    </form>
  </LoadState>
</template>
