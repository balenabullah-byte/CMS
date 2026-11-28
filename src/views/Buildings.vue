<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useWorkspace, usePage } from '../lib/workspace'
import LoadState from '../components/LoadState.vue'
import RecordEditor from '../components/RecordEditor.vue'
const route = useRoute(),
  router = useRouter(),
  id = Number(route.params.id),
  w = useWorkspace(),
  search = ref(''),
  active = ref('All'),
  edit = ref(null)
const { data, loading, error, refresh } = usePage(async () => {
  const catalog = await w.catalog()
  if (id && !catalog.buildings.some((b) => b.id === id)) throw Error('Building unavailable.')
  return catalog
})
const building = computed(() => data.value?.buildings.find((b) => b.id === id)),
  filtered = computed(() =>
    (data.value?.buildings || []).filter(
      (b) =>
        (b.code + ' ' + b.name).toLowerCase().includes(search.value.toLowerCase()) &&
        (active.value === 'All' || (active.value === 'Active') === !!b.is_active),
    ),
  )
const state = { key: 'is_active', label: 'Active', type: 'checkbox' },
  desc = { key: 'description', label: 'Description', type: 'textarea', max: 12000 }
const fields = {
  buildings: [
    { key: 'code', label: 'Building code', required: true, max: 20 },
    { key: 'name', label: 'Building name', required: true, max: 150 },
    desc,
    state,
  ],
  rooms: [
    { key: 'room_code', label: 'Room code', required: true, max: 30 },
    { key: 'floor_number', label: 'Floor', type: 'number', min: -32768, max: 32767 },
    { ...desc, max: 255 },
    state,
  ],
}
async function saved(row) {
  const type = edit.value.type
  edit.value = null
  w.catalogs = null
  w.notice = 'Changes saved.'
  if (type === 'buildings' && !id) await router.push('/buildings/' + row.id)
  else await refresh()
}
</script>
<template>
  <LoadState :loading :error @retry="refresh">
    <div v-if="data" class="stack">
      <RecordEditor
        v-if="edit"
        :key="edit.type + edit.row?.id"
        :title="edit.title"
        :row="edit.row"
        :fields="fields[edit.type]"
        :endpoint="'/' + edit.type + (edit.row ? '/' + edit.row.id : '')"
        :defaults="edit.type === 'rooms' ? { building_id: id } : {}"
        @cancel="edit = null"
        @saved="saved"
      />
      <section v-if="!id" class="panel">
        <div class="split">
          <h2>Building directory</h2>
          <button
            v-if="w.has('admin')"
            class="primary"
            @click="edit = { type: 'buildings', title: 'New building' }"
          >
            New building
          </button>
        </div>
        <div class="toolbar">
          <label>
            Search buildings
            <input type="search" v-model="search" />
          </label>
          <label>
            Status
            <select v-model="active">
              <option>All</option>
              <option>Active</option>
              <option>Inactive</option>
            </select>
          </label>
        </div>
        <RouterLink class="listrow" v-for="b in filtered" :to="w.path('/buildings/' + b.id)">
          <b>{{ b.name }}</b>
          <span>{{ b.code }} · {{ b.is_active ? 'Active' : 'Inactive' }}</span>
        </RouterLink>
        <p class="empty" v-if="!filtered.length">No matching buildings.</p>
      </section>
      <template v-else-if="building">
        <RouterLink :to="w.path('/buildings')">← Buildings</RouterLink>
        <section class="panel">
          <div class="split">
            <h2>{{ building.name }}</h2>
            <RouterLink v-if="w.has('admin')" :to="w.path('/qr-labels')+'?type=building&id='+building.id">Building QR label</RouterLink>
            <button
              v-if="w.has('admin')"
              class="secondary"
              @click="edit = { type: 'buildings', row: building, title: 'Edit building' }"
            >
              Edit building
            </button>
          </div>
          <p>{{ building.code }} · {{ building.is_active ? 'Active' : 'Inactive' }}</p>
          <p>{{ building.description }}</p>
        </section>
        <section class="panel">
          <div class="split">
            <h2>Rooms</h2>
            <button
              v-if="w.has('admin')"
              class="primary"
              @click="edit = { type: 'rooms', title: 'New room' }"
            >
              New room
            </button>
          </div>
          <div v-for="r in data.rooms.filter((x) => x.building_id === id)" class="listrow">
            <b>{{ r.room_code }}</b>
            <RouterLink v-if="w.has('admin')" :to="w.path('/qr-labels')+'?type=room&id='+r.id">Room QR label</RouterLink>
            <span>{{ r.is_active ? 'Active' : 'Inactive' }}</span>
            <button
              class="textbtn"
              v-if="w.has('admin')"
              @click="edit = { type: 'rooms', row: r, title: 'Edit room' }"
            >
              Edit room {{ r.room_code }}
            </button>
          </div>
          <p v-if="!data.rooms.some((x) => x.building_id === id)" class="empty">No rooms recorded.</p>
        </section>
      </template>
    </div>
  </LoadState>
</template>
