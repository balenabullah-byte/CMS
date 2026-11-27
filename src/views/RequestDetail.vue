<script setup>
import DeadlineTargets from "../components/DeadlineTargets.vue"
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { api, all } from '../lib/api'
import { useWorkspace, usePage, useAction, date, label } from '../lib/workspace'
import CompletionRecord from '../components/CompletionRecord.vue'
import Badge from '../components/Badge.vue'
import LoadState from '../components/LoadState.vue'
import CoordinatorActions from '../components/CoordinatorActions.vue'
const id = useRoute().params.id,
  path = '/maintenance-requests/' + id,
  w = useWorkspace()
const saved = w.draft?.user === w.user.id && w.draft?.id === id ? w.draft : null
const message = ref(saved?.body || ''),
  visibility = ref(saved?.visibility || 'reporter_visible'),
  owner = w.user.id
watch([message, visibility], () => {
  if (w.user?.id === owner)
    w.draft = message.value
      ? { user: owner, id, body: message.value, visibility: visibility.value }
      : null
})
const { data, loading, error, refresh } = usePage(async (signal) => {
  const [r, history, comments, jobs, technicians, attachments] = await Promise.all([
    api(path, { signal }),
    all(path + '/history', signal),
    all(path + '/comments', signal),
    w.has('coordinator') || w.has('technician') ? all('/assignments?request_id=' + id, signal) : [],
    w.has('coordinator') ? all(path+'/recommendations', signal) : [],
    all(path+'/attachments',signal),
    w.catalog(),
  ])
  const assignments = jobs.filter((j) => String(j.request_id) === id)
  return { r, history, comments, attachments, assignments, job: assignments.find((j) => !j.ended_at), technicians }
})
const staff = computed(
  () => w.has('coordinator') || (w.has('technician') && data.value?.job?.technician_id === w.user.id),
)
const { run, busy, error: failure } = useAction()
const canComment = computed(() => data.value && !['closed','rejected'].includes(data.value.r.status) &&
  (staff.value || (w.has('campus_member') && data.value.r.reporter_id === owner)))
function post() {
  run(async () => {
    await api(path + '/comments', {
      method: 'POST',
      body: { body: message.value, visibility: staff.value ? visibility.value : 'reporter_visible' },
    })
    message.value = ''
    w.notice = 'Comment posted.'
    await refresh()
  })
}
</script>
<template>
  <LoadState :loading :error @retry="refresh">
    <template v-if="data">
      <RouterLink v-if="w.has('technician')" :to="w.path('/assignments')">← My jobs</RouterLink>
      <RouterLink v-else :to="w.path('/requests')">← Maintenance requests</RouterLink>
      <div class="detailhead">
        <h2>{{ data.r.title }}</h2>
        <p>
          REQ-{{ id }} · {{ w.building(data.r.building_id) }}
          <span v-if="data.r.room_id">· Room {{ w.room(data.r.room_id) }}</span>
        </p>
        <Badge :value="data.r.status" />
        <Badge :value="data.r.priority" />
      </div>
      <div class="detailgrid">
        <div class="stack">
          <DeadlineTargets :request-id="id" />
      <section class="panel">
            <h2>Request description</h2>
            <p class="prose">{{ data.r.description }}</p>
            <p v-if="data.r.location_note">{{ data.r.location_note }}</p>
            <small>
              {{ w.catalogs.categories.find((x) => x.id === data.r.category_id)?.name }} ·
              {{ date(data.r.created_at) }}
            </small>
            <p v-if="w.has('coordinator')">Reporter #{{ data.r.reporter_id }}</p>
            <p v-if="data.r.status_note">{{ data.r.status_note }}</p>
          </section>
          <section v-if="data.attachments.length" class="panel"><h2>Evidence on file</h2>
            <p v-for="a in data.attachments" :key="a.id">{{a.original_filename}} · {{Math.ceil(a.file_size_bytes/1024)}} KB · {{date(a.created_at)}}</p>
          </section>
          <section class="panel">
            <h2>Comments</h2>
            <article v-for="c in data.comments" :key="c.id" class="entry">
              <b>{{ label(c.visibility) }}</b>
              <small>User #{{ c.author_id }} · {{ date(c.created_at) }}</small>
              <p class="prose">{{ c.body }}</p>
            </article>
            <p v-if="!data.comments.length" class="empty">No comments yet.</p>
            <form v-if="canComment" @submit.prevent="post">
              <label>
                Comment
                <textarea required maxlength="12000" v-model.trim="message" />
              </label>
              <label v-if="staff">
                Visibility
                <select v-model="visibility">
                  <option value="reporter_visible">Reporter visible</option>
                  <option value="staff_only">Staff only</option>
                </select>
              </label>
              <p v-if="failure" class="error" role="alert">{{ failure }}</p>
              <button :disabled="busy" class="primary">Post comment</button>
            </form>
            <p v-else class="empty">Comments are read-only.</p>
          </section>
          <section class="panel">
            <h2>History</h2>
            <ol>
              <li class="entry" v-for="h in data.history">
                <b>{{ label(h.event_type) }}</b>
                <span v-if="h.new_status">· {{ label(h.new_status) }}</span>
                <small>{{ date(h.created_at) }}<span v-if="h.actor_id"> · User #{{ h.actor_id }}</span></small>
                <p v-if="h.note">{{ h.note }}</p>
              </li>
            </ol>
          </section>
        </div>
        <div class="stack">
          <CoordinatorActions
            v-if="w.has('coordinator')"
            :request="data.r"
            :job="data.job"
            :technicians="data.technicians"
            @refresh="refresh"
          />
          <section v-if="data.assignments.length" class="panel">
            <h2>Assignments</h2>
            <details v-for="j in data.assignments.filter(x => x.ended_at)" :key="j.id" :open="j.id === data.assignments[0].id"><summary>Assignment #{{ j.id }} · {{ label(j.end_reason) }}</summary><CompletionRecord :job="j" /></details>
            <RouterLink class="listrow" v-for="j in data.assignments" :to="w.path('/assignments/' + j.id)">
              Assignment #{{ j.id }} · {{ j.technician_name }} · {{ label(j.end_reason || (j.started_at ? 'in_progress' : 'assigned')) }}
            </RouterLink>
          </section>
        </div>
      </div>
    </template>
  </LoadState>
</template>
