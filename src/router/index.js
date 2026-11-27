import { createRouter, createWebHistory } from 'vue-router'
import { useWorkspace, portals } from '../lib/workspace'
const views = import.meta.glob('../views/*.vue')
const route = (path, name, view, roles) => ({
  path,
  name,
  component: views['../views/' + view + '.vue'],
  meta: { roles },
})
const readers = ['coordinator', 'technician', 'campus_member']
const pages = [
    route('/specializations','Technician specializations','Operations',['admin','coordinator','technician']),
    route('/notifications','Notifications','Operations'),
    route('/audit-logs','Administrative audit','Operations',['admin']),
    route('/deadlines','Maintenance deadlines','Operations',['coordinator','technician','campus_member']),
    route('/priority-policies','Priority policies','PriorityPolicies',['admin']),
    route('/dashboard', 'Dashboard', 'Dashboard'),
    route('/buildings', 'Buildings', 'Buildings'),
    route('/buildings/:id(\\d+)', 'Building', 'Buildings'),
    route('/requests', 'Maintenance requests', 'Requests', readers),
    route('/requests/new', 'New request', 'NewRequest', ['campus_member']),
    route('/requests/:id(\\d+)', 'Request details', 'RequestDetail', readers),
    route('/assignments', 'Assignments', 'Assignments', ['coordinator', 'technician']),
    route('/assignments/:id(\\d+)', 'Assignment', 'AssignmentDetail', ['coordinator', 'technician']),
    route('/history','Maintenance history','Assignments',['coordinator','technician']),
    route('/verification','Verification queue','Assignments',['coordinator']),
    route('/technicians','Technicians','Technicians',['coordinator']),
    ...Object.entries({operations:'Maintenance operations',causes:'Root cause analysis',workload:'Technician workload',
      accounts:'Account analytics',infrastructure:'Campus infrastructure',trends:'Maintenance trends'}).map(([key,title]) =>
        route('/analytics/'+key,title,'Analytics',[['accounts','infrastructure','trends'].includes(key)?'admin':'coordinator'])),
    route('/users', 'Users and roles', 'Admin', ['admin']),
    route('/profile', 'Profile and settings', 'Profile'),
]
const router = createRouter({
  history: createWebHistory(),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    { path: '/', component: views['../views/Dashboard.vue'] },
    route('/login', 'Sign in', 'Login'),
    route('/unavailable', 'Access denied', 'Unavailable'),
    ...pages,
    ...Object.entries(portals).flatMap(([role, prefix]) => pages.map(page => ({
      ...page, path: '/' + prefix + page.path, name: prefix + '-' + page.name,
      meta: { ...page.meta, portal: role, title: page.name },
    }))),
    { path: '/qa/results', name: 'API test results', meta: { roles: ['admin'], portal: 'admin' }, component: () => import('../QaResults.vue') },
    route('/:pathMatch(.*)*', 'Page unavailable', 'Unavailable'),
  ],
})
router.beforeEach(async (to) => {
  document.title = String(to.name) + ' | Campus Resource Hub'
  const w = useWorkspace()
  if (to.path === '/login' && !w.user) return
  try {
    await w.identify()
  } catch (error) {
    if (error.status === 401) w.clear(true)
    else { w.clear(true); w.notice = error.message }
    if (!w.user) {
      if (to.path !== '/login') return {path:'/login', query:{next:to.fullPath}}
      return
    }
  }
  const role = to.meta.portal || (w.available.includes(w.portal) && w.portal) || w.available[0]
  if (!role) {
    w.selectPortal(null)
    if (!['/unavailable','/profile'].includes(to.path)) return '/unavailable'
    return
  }
  if (!w.available.includes(role) || (to.meta.roles && !to.meta.roles.includes(role))) return '/unavailable'
  w.selectPortal(role)
  if (to.path === '/login' || to.path === '/') return '/' + portals[role] + '/dashboard'
  if (pages.some(page => page.name === to.name))
    return { path: '/' + portals[role] + to.path, query: to.query, hash: to.hash }
  document.title = (to.meta.title || to.name) + ' | Campus Resource Hub'
})
export default router
