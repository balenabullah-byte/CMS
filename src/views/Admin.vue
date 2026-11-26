<script setup>
import FilterToolbar from '../components/FilterToolbar.vue'
import ReportPager from '../components/ReportPager.vue'
import { useReportQuery } from '../lib/reporting'
import { useRoute, useRouter } from 'vue-router'
import { ref, watch } from 'vue'
import { api, all } from '../lib/api'
import { useWorkspace, usePage, useAction, label } from '../lib/workspace'
import LoadState from '../components/LoadState.vue'
import RecordEditor from '../components/RecordEditor.vue'
const route = useRoute(), router=useRouter(), {page,go,filters}=useReportQuery()
const w = useWorkspace(),
  tab = ref(['Roles','Categories','Technician skills'].includes(route.query.section) ? route.query.section : 'Users'),
  edit = ref(null),
  selected = ref(null),
  roles = ref([]),
  technician = ref(''),
  category = ref('')
const { data, loading, error, refresh } = usePage(async (signal) => {
  const {section,create,...criteria}=filters.value
  const [directory, roles, skills, c, overview] = await Promise.all([
    api('/user-directory?'+new URLSearchParams({...criteria,limit:20,offset:(page.value-1)*20}),{signal}),
    all('/roles', signal), all('/technician-skills', signal), w.catalog(), api('/analytics/accounts',{signal})
  ])
  return { directory, roles, skills, c, counts:Object.fromEntries(overview.series[1].rows.map(r=>[r.label,r.value])) }
},()=>route.fullPath)
const { run, busy, error: failure } = useAction()
const userFields = [
  { key: 'full_name', label: 'Full name', required: true, max: 150 },
  { key: 'email', label: 'Email', type: 'email', required: true, max: 254 },
  { key: 'campus_id', label: 'Campus ID', max: 30 },
  {
    key: 'member_type',
    label: 'Member type',
    options: ['student', 'faculty', 'staff', 'contractor'],
    required: true,
  },
  { key: 'password', label: 'Password', type: 'password', minlength: 12, max: 256 },
  { key: 'is_active', label: 'Active', type: 'checkbox' },
]
function userEditor(row) {
  edit.value = {
    row,
    title: row ? 'Edit user' : 'New user',
    path: '/users' + (row ? '/' + row.id : ''),
    fields: userFields.map((f) =>
      f.key === 'password'
        ? { ...f, required: !row, label: row ? 'New password (optional)' : 'Password' }
        : f,
    ),
  }
}
if (route.query.create === '1') userEditor(null)
async function membership(u) {
  const codes = await api('/users/' + u.id + '/roles')
  selected.value = u
  roles.value = codes
}
function changeRole(role, revoke) {
  run(async () => {
    const u = selected.value,
      path = '/users/' + u.id + '/roles'
    if (!window.confirm((revoke ? 'Revoke ' : 'Grant ') + label(role.code) + ' for ' + u.full_name + '?')) return
    await api(path + (revoke ? '/' + role.id : ''), {
      method: revoke ? 'DELETE' : 'POST',
      body: revoke ? undefined : { role_id: role.id },
    })
    if (u.id === w.user.id) {
      await w.identify()
      if (!w.has('admin')) {
        location.assign('/')
        return
      }
    }
    await membership(u)
    await refresh()
    w.notice = 'Role membership updated.'
  })
}
function skill(row) {
  run(async () => {
    if (row && !window.confirm('Remove this technician skill?')) return
    await api('/technician-skills' + (row ? '/' + row.technician_id + '/' + row.category_id : ''), {
      method: row ? 'DELETE' : 'POST',
      body: row
        ? undefined
        : { technician_id: Number(technician.value), category_id: Number(category.value) },
    })
    w.notice = 'Technician skills updated.'
    await refresh()
  })
}
async function saved(record) {
  const newAccount = edit.value?.path === '/users'
  edit.value = null
  selected.value = null
  w.notice = 'Changes saved.'
  w.catalogs = null
  await refresh()
  if (newAccount) { await membership(record); w.notice = 'Account created. Assign a portal role below.' }
}
watch(()=>route.query.section,t=>selectTab(['Roles','Categories','Technician skills'].includes(t)?t:'Users'))
function selectTab(t) {
  tab.value = t
  edit.value = null
  selected.value = null
}
</script>
<template>
  <LoadState :loading :error @retry="refresh">
    <div v-if="data" class="stack">
      <nav class="tabs" aria-label="Administration sections">
        <button
          v-for="t in ['Users', 'Roles', 'Technician skills', 'Categories']"
          :aria-pressed="tab === t"
          @click="selectTab(t)"
        >
          {{ t }}
        </button>
      </nav>
      <p class="error" role="alert" v-if="failure">{{ failure }}</p>
      <RecordEditor
        v-if="edit"
        :key="edit.path"
        :title="edit.title"
        :row="edit.row"
        :fields="edit.fields"
        :endpoint="edit.path"
        @saved="saved"
        @cancel="edit = null"
      />
      <section class="panel" v-if="tab === 'Users'">
        <div class="split">
          <h2>User directory</h2>
          <button class="primary" @click="userEditor(null)">New user</button>
        </div>
        <FilterToolbar :fields="['search','member_type','role','active']" date-label="Account creation"/>
        <div class="table-scroll"><table class="records" v-if="data.directory.rows.length"><thead><tr><th>Name</th><th>Email</th><th>Member type</th><th>Roles</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody><tr class="user-row" v-for="u in data.directory.rows" :key="u.id"><td>{{u.full_name}}</td><td>{{u.email}}</td><td>{{label(u.member_type)}}</td><td>{{u.roles.map(label).join(', ')}}</td><td>{{u.is_active?'Active':'Inactive'}}</td>
            <td><div class="actions"><button class="textbtn" @click="userEditor(u)">Edit</button><button class="secondary" :disabled="busy" @click="run(()=>membership(u))">Roles</button></div></td>
          </tr></tbody></table></div><p v-if="!data.directory.rows.length" class="empty">No matching accounts.</p>
        <ReportPager :total="data.directory.total" :page @go="go"/>
      </section>
      <section v-if="selected" class="panel">
        <h2>{{ selected.full_name }} · Role memberships</h2>
        <div v-for="r in data.roles" class="listrow">
          <span>{{ label(r.code) }}</span>
          <button class="secondary" :disabled="busy" @click="changeRole(r, roles.includes(r.code))">
            {{ roles.includes(r.code) ? 'Revoke' : 'Grant' }} {{ label(r.code) }}
          </button>
        </div>
      </section>
      <section v-if="tab === 'Roles'" class="panel">
        <h2>Permission roles</h2>
        <div v-for="r in data.roles" class="listrow">
          <div>
            <b>{{ label(r.code) }}</b>
            <p>{{ r.description }}</p><button class="textbtn" @click="selectTab('Users'); router.push({query:{role:r.code}})">{{ data.counts[r.code] || 0 }} accounts</button>
          </div>
          <button
            class="secondary"
            @click="
              edit = {
                row: r,
                path: '/roles/' + r.id,
                title: 'Edit role description',
                fields: [{ key: 'description', label: 'Description', required: true, max: 255 }],
              }
            "
          >
            Edit description
          </button>
        </div>
      </section>
      <section v-if="tab === 'Technician skills'" class="panel">
        <h2>Technician skills</h2>
        <form class="toolbar" @submit.prevent="skill(null)">
          <label>
            Technician ID
            <input type="number" min="1" v-model="technician" required />
          </label>
          <label>
            Category
            <select aria-label="Category" v-model="category" required>
              <option value="" disabled>Select category</option>
              <option v-for="c in data.c.categories" :value="c.id">{{ c.name }}</option>
            </select>
          </label>
          <button class="primary" :disabled="busy">Add skill</button>
        </form>
        <div v-for="s in data.skills" class="listrow">
          <span>
            Technician #{{ s.technician_id }} ·
            {{ data.c.categories.find((c) => c.id === s.category_id)?.name }}
          </span>
          <button class="secondary" :disabled="busy" @click="skill(s)">Remove skill</button>
        </div>
      </section>
      <section v-if="tab === 'Categories'" class="panel">
        <div class="split">
          <h2>Maintenance categories</h2>
          <button
            class="primary"
            @click="
              edit = {
                path: '/maintenance-categories',
                title: 'New category',
                fields: [
                  { key: 'code', label: 'Code', required: true, max: 40 },
                  { key: 'name', label: 'Name', required: true, max: 100 },
                ],
              }
            "
          >
            New category
          </button>
        </div>
        <div class="listrow" v-for="c in data.c.categories">
          <b>{{ c.name }}</b>
          <button
            class="secondary"
            @click="
              edit = {
                path: '/maintenance-categories/' + c.id,
                row: c,
                title: 'Edit category',
                fields: [
                  { key: 'name', label: 'Name', required: true, max: 100 },
                  { key: 'code', label: 'Code', required: true, max: 40 },
                  { key: 'is_active', label: 'Active', type: 'checkbox' },
                ],
              }
            "
          >
            Edit category
          </button>
        </div>
      </section>
    </div>
  </LoadState>
</template>
