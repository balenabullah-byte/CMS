<script setup>
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { MapPin, ArrowLeft, ChevronDown } from 'lucide-vue-next'
import { api } from '../lib/api'
import { usePage, useWorkspace, useAction, date } from '../lib/workspace'
import LoadState from '../components/LoadState.vue'
import Badge from '../components/Badge.vue'
const id = useRoute().params.id,
  w = useWorkspace(),
  progress = ref(''),
  completion = ref('')
const { data, loading, error, refresh } = usePage(async (signal) => {
  const job = await api('/assignments/' + id, { signal })
  let request = null
  if (!job.ended_at || w.has('coordinator')) {
    request = await api('/maintenance-requests/' + job.request_id, { signal })
    await w.catalog()
  }
  return { job, request }
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
      <details open class="panel job-description" v-if="data.request">
        <summary>
          Request description
          <ChevronDown aria-hidden="true" />
        </summary>
        <p class="prose">{{ data.request.description }}</p>
        <p v-if="data.request.location_note">{{ data.request.location_note }}</p>
        <RouterLink :to="w.path('/requests/' + data.job.request_id)">Request history and comments</RouterLink>
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
        <form class="panel" @submit.prevent="act('complete', { completion_note: completion })">
          <h2>Complete assignment</h2>
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
          <button class="primary" :disabled="busy">Complete assignment</button>
        </form>
      </template>
      <section class="panel" v-if="data.job.ended_at">
        <h2>Assignment record</h2>
        <small>{{ date(data.job.ended_at) }} · Technician #{{ data.job.technician_id }}</small>
        <p class="prose">{{ data.job.completion_note }}</p>
      </section>
    </div>
  </LoadState>
  <p v-if="failure" class="error" role="alert">{{ failure }}</p>
</template>
