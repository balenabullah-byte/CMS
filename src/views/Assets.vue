<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../lib/api'
import { assetStatuses, assetOptions } from '../lib/assets'
import { usePage, useWorkspace, label } from '../lib/workspace'
import { useReportQuery } from '../lib/reporting'
import AssetDialog from '../components/AssetDialog.vue'
import LoadState from '../components/LoadState.vue'
import ReportPager from '../components/ReportPager.vue'
import Badge from '../components/Badge.vue'
const w = useWorkspace(),
  route = useRoute(),
  router = useRouter(),
  edit = ref(null)
const categories = computed(() => route.path.endsWith('/asset-categories'))
const { page, go, parameters } = useReportQuery()
const { data, loading, error, refresh } = usePage(
  (signal) =>
    api(
      (categories.value ? '/asset-categories' : '/assets') +
        '?' +
        parameters({ limit: 20, offset: (page.value - 1) * 20 }),
      { signal }
    ),
  () => route.fullPath
)
const lookups = usePage(async (signal) => {
  await w.catalog()
  return categories.value ? [] : assetOptions('/asset-categories', {}, signal)
})
function filter(k, v) {
  const q = { ...route.query, [k]: v }
  delete q.page
  if (!v) delete q[k]
  if (k === 'building_id') delete q.room_id
  router.push({ query: q })
}
async function saved(row) {
  edit.value = null
  if (!categories.value) await router.push(w.path('/assets/' + row.id))
  else await refresh()
}
</script>
<template>
  <section class="panel">
    <div class="split">
      <h2>{{ categories ? 'Asset categories' : 'Equipment register' }}</h2>
      <button v-if="w.has('admin')" class="primary" @click="edit = {}">
        {{ categories ? 'New category' : 'Register equipment' }}
      </button>
    </div>
    <div class="filterbar">
      <label
        >Search<input
          type="search"
          :placeholder="categories ? 'Code or name' : 'Code, name or serial number'"
          :value="route.query.search"
          @change="filter('search', $event.target.value)"
      /></label>
      <label v-if="categories"
        >Availability<select
          :value="route.query.active || ''"
          @change="filter('active', $event.target.value)"
        >
          <option value="">All categories</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select></label
      >
      <template v-else
        ><label
          >Status<select
            :value="route.query.operational_status || ''"
            @change="filter('operational_status', $event.target.value)"
          >
            <option value="">All statuses</option>
            <option v-for="v in assetStatuses" :value="v">{{ label(v) }}</option>
          </select></label
        >
        <details>
          <summary>Filters and sorting</summary>
          <div class="form-pair">
            <label
              >Asset category<select
                :value="route.query.asset_category_id || ''"
                @change="filter('asset_category_id', $event.target.value)"
              >
                <option value="">All categories</option>
                <option v-for="c in lookups.data.value" :value="c.id">{{ c.name }}</option>
              </select></label
            >
            <label
              >Building<select
                :value="route.query.building_id || ''"
                @change="filter('building_id', $event.target.value)"
              >
                <option value="">All buildings</option>
                <option v-for="b in w.catalogs?.buildings" :value="b.id">{{ b.name }}</option>
              </select></label
            >
            <label
              >Room<select
                :value="route.query.room_id || ''"
                @change="filter('room_id', $event.target.value)"
              >
                <option value="">All rooms</option>
                <option
                  v-for="r in w.catalogs?.rooms.filter(
                    (r) => !route.query.building_id || r.building_id === Number(route.query.building_id)
                  )"
                  :value="r.id"
                >
                  {{ r.room_code }}
                </option>
              </select></label
            >
            <label
              >Sort by<select
                :value="route.query.sort || 'asset_code'"
                @change="filter('sort', $event.target.value)"
              >
                <option
                  v-for="k in ['asset_code', 'name', 'category', 'building', 'operational_status']"
                  :value="k"
                >
                  {{ label(k) }}
                </option>
              </select></label
            >
            <label
              >Direction<select
                :value="route.query.direction || 'asc'"
                @change="filter('direction', $event.target.value)"
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select></label
            >
          </div>
        </details></template
      >
      <button v-if="Object.keys(route.query).length" @click="router.push({ query: {} })">
        Clear filters
      </button>
    </div>
    <p v-if="lookups.error.value" role="alert">{{ lookups.error.value }}</p>
    <LoadState :loading :error @retry="refresh"
      ><template v-if="data">
        <p v-if="!data.rows.length" class="empty">
          {{ categories ? 'No matching asset categories.' : 'No matching equipment.' }}
        </p>
        <div v-else class="table-scroll" tabindex="0">
          <table class="records">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th v-if="!categories">Category</th>
                <th>{{ categories ? 'Description' : 'Location' }}</th>
                <th>Status</th>
                <th v-if="categories">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in data.rows" :key="r.id">
                <td>
                  <strong v-if="categories">{{ r.code }}</strong
                  ><RouterLink v-else :to="w.path('/assets/' + r.id)">{{ r.asset_code }}</RouterLink>
                </td>
                <td>{{ r.name }}</td>
                <td v-if="!categories">{{ r.category }}</td>
                <td>
                  {{
                    categories
                      ? r.description || '—'
                      : [r.building, r.room_code].filter(Boolean).join(' · ')
                  }}
                </td>
                <td>
                  <Badge
                    :value="categories ? (r.is_active ? 'active' : 'inactive') : r.operational_status"
                  />
                </td>
                <td v-if="categories"><button @click="edit = r">Edit</button></td>
              </tr>
            </tbody>
          </table>
        </div>
        <ReportPager :page :total="data.total" @go="go" /></template
    ></LoadState>
    <AssetDialog
      v-if="edit"
      :mode="categories ? 'category' : 'register'"
      :row="edit.id ? edit : null"
      @close="edit = null"
      @saved="saved"
    />
  </section>
</template>
