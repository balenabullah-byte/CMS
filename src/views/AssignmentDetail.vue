<script setup>
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { MapPin, ArrowLeft, ChevronDown } from 'lucide-vue-next'
import { api, all } from '../lib/api'
import { usePage, useWorkspace, useAction, date } from '../lib/workspace'
import LoadState from '../components/LoadState.vue'
import CompletionRecord from '../components/CompletionRecord.vue'
import { causes, maxLaborMinutes } from '../../shared/maintenance.js'
import Badge from '../components/Badge.vue'
const id = useRoute().params.id,
  w = useWorkspace(),
  progress = ref(''),
  completion = ref(''), cause = ref(''), explanation = ref(''), materials = ref(''), hours = ref(''), minutes = ref('')
const labor = computed(() => hours.value === '' && minutes.value === '' ? null : Number(hours.value)*60 + Number(minutes.value))
const { data, loading, error, refresh } = usePage(async (signal) => {
  const job = await api('/assignments/' + id, { signal })
  let request = null
  if (!job.ended_at || w.has('coordinator')) {
    request = await api('/maintenance-requests/' + job.request_id, { signal })
    await w.catalog()
  }
  const comments=request? await all('/maintenance-requests/'+job.request_id+'/comments',signal):[]
  return { job, request, instructions:comments.filter(c=>c.visibility==='staff_only' && c.body.startsWith('Instructions for assignment #'+job.id+': ')) }
})
const owned = computed(
  () => w.has('technician') && data.value?.job.technician_id === w.user.id && !data.value.job.ended_at,
)
const { run, busy, error: failure } = useAction()
function act(action, body) {
  run(async () => {
    await api('/assignments/' + id + '/' + action, { method: 'PATCH', body })
    progress.value = ''
    w.notice = {
      start: 'Work started.',
      progress: 'Staff-only update posted.',
      complete: 'Assignment completed.',
    }[action]
    await refresh()
  }, refresh)
}
</script>
<template>
  <LoadState :loading :error @retry="refresh">
    <div v-if="data" class="stack narrow">
      <RouterLink class="inline" :to="w.path('/assignments')">
        <ArrowLeft />
        Assignments
      </RouterLink>
      <div class="detailhead">
        <h2 class="job-title">{{ data.job.title }}</h2>
        <small>Assigned {{ date(data.job.assigned_at) }} · {{ data.job.technician_name }}</small>
        <p>Request #{{ data.job.request_id }} · Assignment #{{ id }}</p>
        <div class="actions">
          <Badge :value="data.job.end_reason || data.request?.status" /><Badge :value="data.job.priority" />
          <span class="inline" v-if="data.request">
            <MapPin />
            {{ w.building(data.request.building_id) }}
            <template v-if="data.request.room_id">· Room {{ w.room(data.request.room_id) }}</template>
          </span>
        </div>
      </div>
      <details open class="panel job-description">
        <summary>
          Request description
          <ChevronDown aria-hidden="true" />
        </summary>
        <p class="prose">{{ data.job.description }}</p>
        <p v-for="c in data.instructions" :key="c.id" class="prose">{{c.body}}</p>
        <p v-if="data.job.location_note">{{ data.job.location_note }}</p>
        <RouterLink v-if="data.request" :to="w.path('/requests/' + data.job.request_id)">Request history and comments</RouterLink>
      </details>
      <section v-if="owned && data.request.status === 'assigned'" class="panel">
        <button class="primary" :disabled="busy" @click="act('start')">Start work</button>
      </section>
      <template v-if="owned && data.request.status === 'in_progress'">
        <form class="panel" @submit.prevent="act('progress', { body: progress })">
          <h2>Work progress</h2>
          <label>
            Staff-only update
            <textarea
              maxlength="12000"
              required
              placeholder="Add a work update…"
              v-model.trim="progress"
            />
          </label>
          <button class="primary" :disabled="busy">Post update</button>
        </form>
        <form class="panel" @submit.prevent="act('complete', { completion_note: completion,root_cause:cause,
          ...(explanation && {root_cause_details:explanation}), ...(materials && {materials_used:materials}), ...(labor !== null && {labor_minutes:labor}) })">
          <h2>Repair completion</h2>
          <label>Root cause<select aria-label="Root cause" required v-model="cause"><option disabled value="">Select a cause</option>
            <option v-for="(name,code) in causes" :value="code">{{ name }}</option></select></label>
          <label>Cause explanation {{ cause === 'other' ? '(required)' : '(optional)' }}<textarea rows="2" maxlength="4000" :required="cause==='other'" v-model.trim="explanation" /></label>
          <label>
            Completion note
            <textarea
              rows="2"
              maxlength="12000"
              required
              placeholder="Briefly describe the work completed."
              v-model.trim="completion"
            />
          </label>
          <label>Materials used (optional)<textarea rows="2" maxlength="4000" v-model.trim="materials" /></label>
          <fieldset><legend>Actual labor (optional)</legend><div class="form-pair">
            <label>Hours<input type="number" min="0" max="720" step="1" v-model="hours"></label>
            <label>Minutes<input type="number" min="0" :max="hours == 720 ? 0 : 59" step="1" v-model="minutes"></label>
          </div></fieldset>
          <p v-if="labor > maxLaborMinutes" class="error">Enter up to 720 hours.</p>
          <button class="primary" :disabled="busy || labor > maxLaborMinutes">Submit for verification</button>
        </form>
      </template>
      <section class="panel" v-if="data.job.ended_at">
        <h2>Assignment record</h2>
        <small>{{ date(data.job.ended_at) }} · Technician #{{ data.job.technician_id }}</small>
        <CompletionRecord :job="data.job" />
      </section>
    </div>
  </LoadState>
  <p v-if="failure" class="error" role="alert">{{ failure }}</p>
</template>
