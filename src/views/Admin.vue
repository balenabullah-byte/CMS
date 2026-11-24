<script setup>
import { useRoute } from 'vue-router'
import { computed, ref, watch } from 'vue'
import { api, all } from '../lib/api'
import { useWorkspace, usePage, useAction, label } from '../lib/workspace'
import LoadState from '../components/LoadState.vue'
import RecordEditor from '../components/RecordEditor.vue'
const route = useRoute()
const w = useWorkspace(),
  tab = ref('Users'),
  edit = ref(null),
  selected = ref(null),
  roles = ref([]),
  search = ref(''),
  memberType = ref(''), roleFilter = ref(''), statusFilter = ref(''), page = ref(1),
  technician = ref(''),
  category = ref('')
const { data, loading, error, refresh } = usePage(async (signal) => {
  const [users, roles, skills, c] = await Promise.all([
    all('/users', signal),
    all('/roles', signal),
    all('/technician-skills', signal),
    w.catalog(),
  ])
  return { users, roles, skills, c }
})
const matches = computed(() => (data.value?.users || []).filter(u =>
  [u.full_name,u.email,u.campus_id].join(' ').toLowerCase().includes(search.value.toLowerCase())
  && (!memberType.value || memberType.value === u.member_type)
  && (!roleFilter.value || u.roles.includes(roleFilter.value))
  && (!statusFilter.value || Boolean(u.is_active) === (statusFilter.value === 'active'))))
watch([search, memberType, roleFilter, statusFilter], () => { page.value = 1 })
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
        <label>
          Search users
          <input type="search" v-model="search" />
        </label>
        <div class="toolbar">
          <label>Member type<select v-model="memberType"><option value="">All types</option><option v-for="t in userFields.find(f => f.key === 'member_type').options" :value="t">{{ label(t) }}</option></select></label>
          <label>Role<select v-model="roleFilter"><option value="">All roles</option><option v-for="r in data.roles" :value="r.code">{{ label(r.code) }}</option></select></label>
          <label>Account status<select v-model="statusFilter"><option value="">All accounts</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
        </div>
        <p v-if="!matches.length" class="empty">No accounts match these filters.</p>
        <div class="listrow" v-for="u in matches.slice((page-1)*20,page*20)" :key="u.id">
          <div>
            <b>{{ u.full_name }}</b>
            <small>{{ u.email }} · {{ u.is_active ? 'Active' : 'Inactive' }}</small>
          </div>
          <div class="actions">
            <button class="textbtn" @click="userEditor(u)">Edit</button>
            <button class="secondary" :disabled="busy" @click="run(() => membership(u))">Roles</button>
          </div>
        </div>
      </section>
      <div class="pager" v-if="tab === 'Users' && matches.length > 20"><button :disabled="page === 1" @click="page--">Previous</button>Page {{ page }}<button :disabled="page*20 >= matches.length" @click="page++">Next</button></div>
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
            <p>{{ r.description }}</p><button class="textbtn" @click="selectTab('Users'); roleFilter = r.code">{{ data.users.filter(u => u.roles.includes(r.code)).length }} accounts</button>
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
