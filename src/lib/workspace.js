import { ref, computed, onScopeDispose, watch } from 'vue'
import { defineStore } from 'pinia'
import { api, all, setPortalRole } from './api'
export const roles = {
  admin: 'Administrator',
  campus_member: 'Campus member',
  coordinator: 'Coordinator',
  technician: 'Technician',
}
export const portals = { admin: 'admin', coordinator: 'coordinator', technician: 'technician', campus_member: 'member' }
export const statuses = [
  'submitted',
  'approved',
  'assigned',
  'in_progress',
  'completed',
  'closed',
  'reopened',
  'rejected',
]
export const label = (value) => (value || '').replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase())
let campusTimeZone
export const date = (value) =>
  value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone:campusTimeZone }) : '—'
export const useWorkspace = defineStore('workspace', () => {
  const user = ref(null),
    notice = ref(''),
    catalogs = ref(null),
    draft = ref(null)
  const collapsed = ref(matchMedia('(min-width:768px) and (max-width:1199px)').matches)
  const portal = ref(null)
  const available = computed(() => Object.keys(portals).filter(role => user.value?.roles.includes(role)))
  function selectPortal(role) {
    if (portal.value !== role) {
      portal.value = role
      setPortalRole(role, user.value?.id)
      catalogs.value = null
      pending = null
      generation++
    }
  }
  let pending,
    generation = 0
  const has = (role) => role === portal.value && !!user.value?.roles.includes(role)
  const canRead = computed(() => ['coordinator', 'campus_member', 'technician'].some(has))
  function clear(keepDraft = false) {
    selectPortal(null)
    user.value = null
    catalogs.value = null
    notice.value = ''
    pending = null
    generation++
    if (!keepDraft) draft.value = null
  }
  async function identify() {
    const account = await api('/me')
    if (user.value && user.value.id !== account.id) clear()
    if (draft.value && draft.value.user !== account.id) draft.value = null
    campusTimeZone = account.campus_time_zone
    user.value = account
  }
  async function catalog(force = false) {
    if (catalogs.value && !force) return catalogs.value
    if (!pending || force) {
      const run = ++generation
      pending = Promise.all(['/buildings', '/rooms', '/maintenance-categories'].map((path) => all(path)))
        .then(([buildings, rooms, categories]) => {
          const result = { buildings, rooms, categories }
          if (run === generation) catalogs.value = result
          return result
        })
        .finally(() => {
          if (run === generation) pending = null
        })
    }
    return pending
  }
  function building(id) {
    return catalogs.value?.buildings.find((x) => x.id === id)?.name || 'Building #' + id
  }
  function room(id) {
    return catalogs.value?.rooms.find((x) => x.id === id)?.room_code || id
  }
  function compact(value) {
    collapsed.value = value

  }
  return {
    user,
    notice,
    catalogs,
    draft,
    collapsed,
    has,
    canRead,
    available, portal, selectPortal,
    path: suffix => (portal.value ? '/' + portals[portal.value] : '') + suffix,
    clear,
    identify,
    catalog,
    building,
    room,
    compact,
  }
})
// Abort superseded reads and keep older responses out of the current view.
export function usePage(loader, key = () => true, { refetchOnFocus = false } = {}) {
  const data = ref(null),
    loading = ref(false),
    error = ref('')
  let current
  async function refresh(background = false) {
    current?.abort()
    const controller = new AbortController()
    current = controller
    if (!background || data.value === null) loading.value = true
    error.value = ''
    try {
      const next = await loader(controller.signal)
      if (!controller.signal.aborted) data.value = next
    } catch (e) {
      if (!controller.signal.aborted) {
        error.value = e.message
        data.value = null
      }
    } finally {
      if (!controller.signal.aborted) loading.value = false
    }
  }
  watch(
    key,
    () => {
      data.value = null
      refresh(false)
    },
    { immediate: true },
  )
  const onFocus = () => {
    if (!document.hidden && data.value !== null) refresh(true)
  }
  if (refetchOnFocus) {
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
  }
  onScopeDispose(() => {
    if (refetchOnFocus) {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
    }
    current?.abort()
  })
  return { data, loading, error, refresh: () => refresh(false) }
}
export function useAction() {
  const busy = ref(false),
    error = ref('')
  async function run(task, onConflict) {
    if (busy.value) return
    error.value = ''
    busy.value = true
    try {
      await task()
    } catch (e) {
      error.value = e.message
      if (e.status === 409 && onConflict) await onConflict()
    } finally {
      busy.value = false
    }
  }
  return { busy, error, run }
}
