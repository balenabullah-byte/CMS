<script setup>
import { computed, onMounted, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { api } from '../lib/api'
import { useWorkspace, useAction, usePage, label } from '../lib/workspace'
import { assetStatuses, assetDates, dateLabels, assetOptions } from '../lib/assets'
import LoadState from './LoadState.vue'
const props = defineProps({ mode: String, row: Object })
const emit = defineEmits(['close', 'saved'])
const modal = ref(),
  w = useWorkspace(),
  form = reactive({ ...props.row })
const category = props.mode === 'category'
if (category && props.row) form.is_active = Boolean(props.row.is_active)
const inventory = ['register', 'edit'].includes(props.mode)
const location = ['register', 'transfer'].includes(props.mode)
const titles = {
  register: 'Register equipment',
  edit: 'Edit equipment',
  transfer: 'Transfer equipment',
  retire: 'Retire equipment',
  status: 'Change operational status',
  category: props.row ? 'Edit asset category' : 'New asset category',
}
if (!props.row)
  Object.assign(form, {
    is_active: true,
    operational_status: 'operational',
    building_id: '',
    room_id: null,
    asset_category_id: '',
  })
const { data, loading, error, refresh } = usePage(async (signal) => {
  if (location) await w.catalog()
  return inventory ? assetOptions('/asset-categories', { active: true }, signal) : []
})
const rooms = computed(
  () => w.catalogs?.rooms.filter((r) => r.is_active && r.building_id === form.building_id) || []
)
const { run, busy, error: failure } = useAction()
onMounted(() => modal.value.showModal())
watch(data, () => modal.value?.querySelector('input,select,textarea')?.focus(), { flush: 'post' })
onBeforeUnmount(() => modal.value?.close())
function submit() {
  run(async () => {
    let path = '/assets',
      method = 'POST',
      body = {}
    if (category) {
      path = '/asset-categories'
      if (props.row) {
        path += '/' + props.row.id
        method = 'PATCH'
      }
      body = {
        code: form.code,
        name: form.name,
        description: form.description || null,
        is_active: !!form.is_active,
      }
    } else {
      if (props.row) path += '/' + props.row.id
      if (inventory) {
        body = { name: form.name, asset_category_id: form.asset_category_id }
        for (const k of ['manufacturer', 'model', 'serial_number', 'description', ...assetDates])
          body[k] = form[k] || null
        if (props.mode === 'edit') method = 'PATCH'
      } else path += '/' + props.mode
      if (location) Object.assign(body, { building_id: form.building_id, room_id: form.room_id || null })
      if (['register', 'status'].includes(props.mode)) body.operational_status = form.operational_status
      if (props.mode === 'status') method = 'PATCH'
      if (['transfer', 'retire'].includes(props.mode)) body.reason = form.reason
    }
    const result = await api(path, { method, body })
    emit('saved', result)
  })
}
</script>
<template>
  <dialog
    ref="modal"
    class="asset-dialog"
    aria-labelledby="asset-editor-title"
    @cancel.prevent="!busy && $emit('close')"
  >
    <form @submit.prevent="submit">
      <h2 id="asset-editor-title">{{ titles[mode] }}</h2>
      <p v-if="row?.asset_code">{{ row.asset_code }} · {{ row.name }}</p>
      <LoadState :loading :error @retry="refresh"
        ><div class="stack" v-if="data">
          <template v-if="category"
            ><label>Category code<input v-model.trim="form.code" required maxlength="40" /></label>
            <label>Category name<input v-model.trim="form.name" required maxlength="100" /></label>
            <label>Description<textarea v-model.trim="form.description" maxlength="4000" /></label>
            <label class="check"
              ><input v-model="form.is_active" type="checkbox" /> Active category</label
            ></template
          >
          <template v-if="inventory"
            ><label>Equipment name<input v-model.trim="form.name" required maxlength="150" /></label>
            <label
              >Asset category<select
                aria-label="Asset category"
                v-model="form.asset_category_id"
                required
              >
                <option disabled value="">Select category</option>
                <option
                  v-if="row && !data.some((c) => c.id === row.asset_category_id)"
                  :value="row.asset_category_id"
                >
                  {{ row.category }} (inactive)
                </option>
                <option v-for="c in data" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select></label
            >
            <p class="empty" v-if="!data.length && !row">
              Create an active asset category before registering equipment.
            </p></template
          >
          <div class="form-pair" v-if="location">
            <label
              >Building<select
                aria-label="Building"
                required
                v-model="form.building_id"
                @change="form.room_id = null"
              >
                <option disabled value="">Select building</option>
                <option
                  v-for="b in w.catalogs.buildings.filter((b) => b.is_active)"
                  :key="b.id"
                  :value="b.id"
                >
                  {{ b.name }}
                </option>
              </select></label
            >
            <label
              >Room<select aria-label="Room" v-model="form.room_id">
                <option :value="null">Building only</option>
                <option v-for="r in rooms" :key="r.id" :value="r.id">{{ r.room_code }}</option>
              </select></label
            >
          </div>
          <label v-if="['register', 'status'].includes(mode)"
            >Operational status<select aria-label="Operational status" v-model="form.operational_status">
              <option v-for="v in assetStatuses.slice(0, 3)" :value="v">{{ label(v) }}</option>
            </select></label
          >
          <details v-if="inventory">
            <summary>Equipment details and warranty</summary>
            <div class="form-pair">
              <label v-for="k in ['manufacturer', 'model', 'serial_number']"
                >{{ label(k) }}<input maxlength="150" v-model.trim="form[k]"
              /></label>
              <label v-for="k in assetDates"
                >{{ dateLabels[k] }}<input type="date" v-model="form[k]"
              /></label>
            </div>
            <label>Description<textarea v-model.trim="form.description" maxlength="4000" /></label>
          </details>
          <p v-if="mode === 'retire'">
            Retired equipment stays in the register and its repair history remains available.
          </p>
          <label v-if="['transfer', 'retire'].includes(mode)"
            >Reason<textarea v-model.trim="form.reason" required maxlength="500" />
          </label>
          <p v-if="failure" role="alert" class="error">{{ failure }}</p>
          <div class="actions">
            <button class="primary" :disabled="busy">
              {{
                mode === 'retire'
                  ? 'Confirm retirement'
                  : mode === 'transfer'
                  ? 'Confirm transfer'
                  : 'Save'
              }}
            </button>
            <button type="button" class="secondary" :disabled="busy" @click="$emit('close')">
              Cancel
            </button>
          </div>
        </div></LoadState
      ><button v-if="error || loading" type="button" @click="$emit('close')">Close</button>
    </form>
  </dialog>
</template>
