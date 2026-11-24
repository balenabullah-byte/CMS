<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import {
  Building2,
  House,
  Wrench,
  ClipboardList,
  Users,
  UserRound,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
} from 'lucide-vue-next'
import ThemeSelect from './ThemeSelect.vue'
import { useWorkspace, roles, portals } from '../lib/workspace'
const w = useWorkspace(),
  route = useRoute(),
  drawer = ref(null),
  main = ref(null)
const links = computed(() =>
  [
    ['Dashboard', '/dashboard', House, !!w.portal],
    ['Buildings', '/buildings', Building2, !!w.portal],
    [w.has('campus_member') ? 'My reports' : 'Maintenance requests', '/requests', Wrench, w.canRead],
    [w.has('technician') ? 'My jobs' : 'Assignments', '/assignments', ClipboardList, w.has('coordinator') || w.has('technician')],
    ['Users and roles', '/users', Users, w.has('admin')],
  ].filter((x) => x[3]),
)
const active = (path) => (path === '/' ? route.path === '/' : route.path.startsWith(path) || route.path.startsWith('/' + portals[w.portal] + path))
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
      <nav aria-label="Main navigation">
        <RouterLink
          v-for="[name, path, icon] in links"
          :key="path"
          :to="w.path(path)"
          :class="{ selected: active(path) }"
          :title="name"
        >
          <component :is="icon" />
          <span>{{ name }}</span>
        </RouterLink>
      </nav>
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
