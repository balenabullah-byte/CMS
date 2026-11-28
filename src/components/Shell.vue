<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import {
  Building2,
  House,
  Wrench,
  ClipboardList,
  ChartColumn, History, ListChecks, Settings2,
  Users,
  UserRound,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
} from 'lucide-vue-next'
import NotificationBell from './NotificationBell.vue'
import ThemeSelect from './ThemeSelect.vue'
import { useWorkspace, roles, portals } from '../lib/workspace'
const w = useWorkspace(),
  route = useRoute(),
  drawer = ref(null),
  main = ref(null)
const groups = computed(() => {
  const main = [['Dashboard','/dashboard',House]]
  const config = [], analytics = []
  if(w.has('coordinator')) {
    main.push(['Incoming reports','/requests',Wrench],['Work orders','/assignments',ClipboardList],['Verification queue','/verification',ListChecks])
    config.push(['Maintenance history','/history',History],['Technicians','/technicians',Users])
    analytics.push(['Maintenance operations','/analytics/operations'],['Root cause analysis','/analytics/causes'],['Technician workload','/analytics/workload'])
  }
  if(w.has('technician')) main.push(['My jobs','/assignments',ClipboardList],['Work history','/history',History])
  if(w.has('campus_member')) main.push(['My reports','/requests',Wrench])
  if(w.has('admin')) {
    main.push(['Users and roles','/users',Users],['Roles and permissions','/users?section=Roles',ListChecks])
    config.push(['Maintenance categories','/users?section=Categories',Settings2])
    analytics.push(['Account analytics','/analytics/accounts'],['Campus infrastructure','/analytics/infrastructure'],['Maintenance trends','/analytics/trends'])
  }
  if(w.has('admin')) config.push(['Priority policies','/priority-policies',Settings2],['Administrative audit','/audit-logs',History])
  if(w.has('technician') || w.has('coordinator')) main.push(['Deadlines','/deadlines',ListChecks])
  if(w.portal) config.push(['Buildings','/buildings',Building2])
  const assets=[]
  if(w.has('admin')) config.push(['QR labels','/qr-labels',ClipboardList])
  if(w.has('admin') || w.has('coordinator')) analytics.push(['QR reporting','/analytics/qr'])
  if(w.has('admin') || w.has('coordinator')) assets.push(['Asset directory','/assets',ClipboardList])
  if(w.has('admin')) assets.push(['Asset categories','/asset-categories',Settings2],['Asset analytics','/analytics/assets',ChartColumn])
  return w.portal ? [['Workspace',main],['Asset management',assets],['Management',config],['Analytics',analytics.map(([n,p])=>[n,p,ChartColumn])]].filter(([,items])=>items.length) : []
})
const links=computed(()=>groups.value.flatMap(([,items])=>items))
const active = path => path.includes('?') ? route.fullPath===w.path(path) : route.path===w.path(path) && !(path==='/users' && route.query.section)
watch(
  () => route.path,
  async () => {
    drawer.value?.close()
    await nextTick()
    main.value?.focus({ preventScroll: true })
  },
)
</script>
<template>
  <div class="workspace layout" :class="{ compact: w.collapsed }">
    <a class="skip" href="#workspace-main">Skip to content</a>
    <aside>
      <div class="brandline">
        <Building2 />
        <b>Campus Resource Hub</b>
      </div>
      <nav aria-label="Main navigation"><div v-for="[group,items] in groups" :key="group"><div class="nav-group">{{ group }}</div>
        <RouterLink
          v-for="[name, path, icon] in items"
          :key="path"
          :to="w.path(path)"
          :class="{ selected: active(path) }"
          :title="name"
        >
          <component :is="icon" />
          <span>{{ name }}</span>
        </RouterLink>
      </div></nav>
      <div class="railfoot">
        <button
          @click="w.compact(!w.collapsed)"
          :title="w.collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
        >
          <component :is="w.collapsed ? PanelLeftOpen : PanelLeftClose" />
          <span>Collapse sidebar</span>
        </button>
        <RouterLink :to="w.path('/profile')" title="Profile and settings">
          <UserRound />
          <span>Profile &amp; settings</span>
        </RouterLink>
      </div>
    </aside>
    <div class="mobilebar">
      <button aria-label="Open navigation" @click="drawer.showModal()"><Menu /></button>
      <b>Campus Resource Hub</b>
    </div>
    <dialog ref="drawer" class="drawer" aria-label="Navigation">
      <div class="split">
        <b>Campus Resource Hub</b>
        <button aria-label="Close navigation" @click="drawer.close()"><X /></button>
      </div>
      <nav aria-label="Mobile navigation">
        <RouterLink v-for="[name, path, icon] in links" :key="path" :to="w.path(path)" @click="drawer.close()">
          <component :is="icon" />
          {{ name }}
        </RouterLink>
        <RouterLink :to="w.path('/profile')" @click="drawer.close()">
          <UserRound />
          Profile &amp; settings
        </RouterLink>
      </nav>
    </dialog>
    <main id="workspace-main" ref="main" tabindex="-1">
      <header class="pagehead">
        <h1>{{ route.meta.title || route.name }}</h1>
        <div class="portal-tools">
          <span v-if="w.available.length === 1">{{ roles[w.portal] }}</span>
          <select v-if="w.available.length > 1" aria-label="Switch portal" :value="w.portal"
            @change="$router.push('/' + portals[$event.target.value] + '/dashboard')">
            <option v-for="role in w.available" :key="role" :value="role">{{ roles[role] }}</option>
          </select>
          <NotificationBell :key="w.user.id + ':' + w.portal"/>
          <ThemeSelect />
        <RouterLink class="account" :to="w.path('/profile')">
          <UserRound />
          {{ w.user.full_name }}
        </RouterLink>
        </div>
      </header>
      <p class="notice" role="status" v-if="w.notice">
        {{ w.notice }}
        <button aria-label="Dismiss message" @click="w.notice = ''">×</button>
      </p>
      <slot />
    </main>
  </div>
</template>
