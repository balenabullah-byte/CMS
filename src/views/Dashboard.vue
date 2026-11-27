<script setup>
import DeadlineSummary from "../components/DeadlineSummary.vue"
import { useRoute } from 'vue-router'
import FilterToolbar from '../components/FilterToolbar.vue'
import { api } from '../lib/api'
import { useWorkspace, usePage, roles, statuses, label } from '../lib/workspace'
import LoadState from '../components/LoadState.vue'
import Queue from '../components/Queue.vue'
import RequestTable from '../components/RequestTable.vue'
const w = useWorkspace(), route=useRoute()
const { data, loading, error, refresh } = usePage(async (signal) => {
  await w.catalog()
  const list = (status, n) =>
    api('/maintenance-requests?limit=' + n + (status ? '&status=' + status : ''), { signal })
  const coord = w.has('coordinator')
  const [recent, submitted, approved, reopened, stats, jobs] = await Promise.all([
    w.has('campus_member') ? api('/maintenance-requests?limit=6&sort=updated_at',{signal}) : w.canRead ? list('',10) : [],
    coord ? list('submitted', 10) : [],
    coord ? list('approved', 2) : [],
    coord ? list('reopened', 2) : [],
    w.has('admin') ? api('/statistics', { signal }) : [],
    w.has('technician') ? api('/work-records?scope=active&limit=6',{signal}).then(p=>p.rows) : [],
  ])
  const accounts = w.has('admin') ? await api('/analytics/accounts',{signal}) : null
  const workload = coord ? await api('/analytics/workload',{signal}) : null
  const mySummary = w.has('technician') ? await api('/my-job-summary?'+new URLSearchParams(route.query),{signal}) : null
  const summary = coord || w.has('campus_member') ? await api('/maintenance-requests/summary', { signal }) : []
  const resolved = w.has('campus_member') ? await list('closed', 4) : []
  const total = status => Number(summary.find(row => row.status === status)?.count || 0)
  return {
    workload: workload?.series[0].rows.map(r=>[r.label,r.value]) || [], mySummary,
    personalCount: summary.reduce((sum,r)=>sum+Number(r.count),0), accounts, total, resolved,
    active: summary.reduce((sum, r) => sum + (['closed','rejected'].includes(r.status) ? 0 : Number(r.count)), 0),
    recent,
    submitted,
    ready: [...approved, ...reopened].sort((a, b) => b.id - a.id).slice(0, 2),
    stats: Object.fromEntries(stats.map((x) => [x.status, Number(x.count)])),
    max: Math.max(1, ...stats.map((x) => Number(x.count))),
    jobs: jobs.filter((x) => x.technician_id === w.user.id && !x.ended_at),
  }
},()=>route.fullPath,{refetchOnFocus:true})
</script>
<template>
  <LoadState :loading :error @retry="refresh">
    <div v-if="data" class="stack">
      <DeadlineSummary v-if="w.has('admin') || w.has('coordinator')" />
      <section v-if="w.has('admin')" class="panel">
        <div class="split"><h2>University accounts</h2><RouterLink :to="w.path('/users?create=1')">Create account</RouterLink></div>
        <dl class="facts">
          <template v-for="m in data.accounts.metrics.slice(0,3)" :key="m.label"><dt>{{m.label}}</dt><dd>{{m.value}}</dd></template>
          <template v-for="r in data.accounts.series[1].rows" :key="r.label"><dt>{{roles[r.label]}}</dt><dd>{{r.value}}</dd></template>
          <dt>Campus buildings</dt><dd>{{ w.catalogs.buildings.length }}</dd>
          <dt>Rooms</dt><dd>{{ w.catalogs.rooms.length }}</dd>
        </dl>
      </section>
      <section v-if="w.has('campus_member')" class="panel">
        <div class="split"><h2>Welcome, {{ w.user.full_name }}</h2><RouterLink class="primary" :to="w.path('/requests/new')">Report an issue</RouterLink></div>
        <p>{{ w.user.member_type === 'faculty' ? 'Report a classroom, laboratory or teaching equipment problem.' : 'Report a problem in a study area, classroom or campus facility.' }}</p>
        <RouterLink :to="w.path('/requests?status=active')">{{ data.active }} active reports</RouterLink> · {{ data.total('closed') }} resolved · {{ data.personalCount }} total
        <h3 class="subheading">Recently resolved</h3><RequestTable :rows="data.resolved" empty="Your closed reports will appear here." />
      </section>
      <div v-if="w.has('coordinator')" class="queues">
        <Queue
          title="Review queue"
          :rows="data.submitted"
          link="/requests?status=submitted"
          action="View queue"
          empty="No requests awaiting review."
        />
        <Queue
          title="Ready to assign"
          :rows="data.ready"
          link="/requests?status=ready"
          action="View requests"
          empty="No work awaiting assignment."
        />
      </div>
      <section v-if="w.has('coordinator')" class="panel">
        <h2>Maintenance workflow</h2>
        <div class="actions"><RouterLink v-for="s in statuses" :key="s" :to="w.path('/requests?status=' + s)">{{ s === 'completed' ? 'Awaiting verification' : label(s) }} ({{ data.total(s) }})</RouterLink></div>
      </section>
      <section v-if="w.has('admin')" class="panel">
        <div class="split">
          <h2>Requests by status</h2>
          <RouterLink :to="w.path('/users')">Manage users</RouterLink>
        </div>
        <div class="chart">
          <div v-for="s in statuses" :key="s">
            <span>{{ label(s) }}</span>
            <i><i :style="{ width: ((data.stats[s] || 0) * 100) / data.max + '%' }" /></i>
            <b>{{ data.stats[s] || 0 }}</b>
          </div>
        </div>
        <RouterLink :to="w.path('/buildings')">Manage buildings</RouterLink>
      </section>
      <section v-if="w.has('coordinator')" class="panel">
        <div class="split"><h2>Technician workload</h2><RouterLink :to="w.path('/assignments')">Monitor work</RouterLink></div>
        <p v-if="!data.workload.length">No active assignments.</p>
        <dl v-if="data.workload.length" class="facts"><template v-for="[name,count] in data.workload" :key="name"><dt>{{ name }}</dt><dd>{{ count }} active</dd></template></dl>
      </section>
      <section v-if="w.has('technician')" class="panel">
        <div class="split">
          <h2>My active assignments</h2><RouterLink :to="w.path('/specializations')">My specializations</RouterLink>
          <RouterLink :to="w.path('/assignments')">View assignments</RouterLink>
        </div>
        <FilterToolbar :fields="[]" date-label="Work completion" />
        <p>{{ data.mySummary.active }} active · {{ data.mySummary.waiting }} awaiting action · {{ data.mySummary.started }} in progress ·
          {{ data.mySummary.verification }} awaiting verification · {{ data.mySummary.completed }} completed in period</p>
        <RouterLink class="listrow" v-for="j in data.jobs" :key="j.id" :to="w.path('/assignments/' + j.id)">
          Assignment #{{ j.id }} · Request #{{ j.request_id }}
          <span>{{j.title}} · {{j.building}} · {{label(j.priority)}}</span>
        </RouterLink>
        <p class="empty" v-if="!data.jobs.length">No active assignments.</p>
      </section>
      <section v-if="w.canRead" class="panel">
        <div class="split">
          <h2>
            {{
              w.has('campus_member') && !w.has('coordinator') && !w.has('technician')
                ? 'My recent requests'
                : 'Recent maintenance requests'
            }}
          </h2>
          <RouterLink v-if="w.has('campus_member')" :to="w.path('/requests')">
            All reports
          </RouterLink>
        </div>
        <RequestTable :rows="data.recent" empty="No maintenance requests yet." />
      </section>
      <section v-if="!w.canRead && !w.has('admin')" class="panel">
        <h2>Campus buildings</h2>
        <RouterLink :to="w.path('/buildings')">Browse buildings</RouterLink>
      </section>
    </div>
  </LoadState>
</template>
