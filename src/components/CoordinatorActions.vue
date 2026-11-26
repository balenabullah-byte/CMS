<script setup>
import { computed, ref, watch } from 'vue'
import { api } from '../lib/api'
import { useAction, useWorkspace, label } from '../lib/workspace'
const props = defineProps({ request: Object, job: Object, technicians: Array })
const emit = defineEmits(['refresh'])
const op = ref(''),
  note = ref(''),
  instructions = ref(''),
  tech = ref(''),
  priority = ref(''),
  w = useWorkspace(),
  { run, busy, error } = useAction()
const actions = {
  submitted: ['approve', 'reject'],
  approved: ['assign'],
  assigned: ['reassign', 'reopen'],
  in_progress: ['reassign', 'reopen'],
  completed: ['close', 'reopen'],
  closed: ['reopen'],
  reopened: ['assign'],
  rejected: [],
}
const titles = {
  approve: 'Approve request',
  reject: 'Reject request',
  assign: 'Assign technician',
  reassign: 'Reassign technician',
  reopen: 'Reopen request',
  close: 'Close request',
  priority: 'Change priority',
}
const allowed = computed(() => [...(actions[props.request.status] || []), 'priority'])
watch(
  () => props.request,
  () => {
    op.value = ''
    note.value = ''
    tech.value = ''
    priority.value = props.request.priority
  },
  { immediate: true },
)
function submit() {
  run(
    async () => {
      const action = op.value
      const path =
        '/maintenance-requests/' +
        props.request.id +
        '/' +
        (action === 'assign' ? 'assignments' : action)
      const body =
        action === 'priority'
          ? { priority: priority.value }
          : {
              ...(note.value && { note: note.value }),
              ...(['assign','reassign'].includes(action) && instructions.value && { instructions: instructions.value }),
              ...(['assign', 'reassign'].includes(action) && { technician_id: Number(tech.value) }),
            }
      await api(path, { method: ['assign', 'reassign'].includes(action) ? 'POST' : 'PATCH', body })
      w.notice = 'Request #' + props.request.id + ' updated.'
      emit('refresh')
    },
    () => {
      w.notice = 'The action could not be applied. Review the refreshed request.'
      emit('refresh')
    },
  )
}
function chooseAction(a) {
  op.value = a
  instructions.value = ''
  note.value = ''
  tech.value = ''
  error.value = ''
}
</script>
<template>
  <section class="panel">
    <h2>Manage request</h2>
    <p v-if="request.status === 'submitted'">Approve this request to assign a technician.</p>
    <div class="actions">
      <button
        v-for="(a, i) in allowed"
        :class="i === 0 ? 'primary' : 'secondary'"
        @click="chooseAction(a)"
        :disabled="busy"
      >
        {{ titles[a] }}
      </button>
    </div>
    <form v-if="op" @submit.prevent="submit">
      <h3>{{ titles[op] }}</h3>
      <p v-if="op === 'reopen' && job">
        Reopening ends assignment #{{ job.id }}. Enter a reason to continue.
      </p>
      <label v-if="['assign', 'reassign'].includes(op)">
        Technician
        <select aria-label="Technician" required v-model="tech"><option disabled value="">Select technician</option>
          <option v-for="t in technicians.filter(t => op !== 'reassign' || t.id !== job?.technician_id)" :key="t.id" :value="t.id">{{ t.full_name }}</option>
        </select>
      </label>
      <label v-if="['assign','reassign'].includes(op)">Instructions for technician (optional)
        <textarea maxlength="2000" v-model.trim="instructions" />
      </label>
      <label v-if="op === 'priority'">
        Priority
        <select v-model="priority">
          <option v-for="p in ['low', 'normal', 'high']" :value="p">{{ label(p) }}</option>
        </select>
      </label>
      <label v-if="op === 'close'">Resolution for reporter (optional)<textarea maxlength="500" v-model.trim="note" /></label>
      <label v-if="['reject', 'reopen', 'reassign'].includes(op)">
        Reason
        <textarea required maxlength="500" v-model.trim="note" />
      </label>
      <div class="actions">
        <button class="primary" :disabled="busy">Confirm {{ label(op).toLowerCase() }}</button>
        <button type="button" class="secondary" :disabled="busy" @click="op = ''">Cancel</button>
      </div>
    </form>
    <p class="error" role="alert" v-if="error">{{ error }}</p>
  </section>
</template>
