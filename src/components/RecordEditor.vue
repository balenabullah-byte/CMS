<script setup>
import { reactive } from 'vue'
import { api } from '../lib/api'
import { useAction } from '../lib/workspace'
const props = defineProps({
  title: String,
  endpoint: String,
  row: Object,
  fields: Array,
  defaults: Object,
})
const emit = defineEmits(['saved', 'cancel']),
  { run, busy, error } = useAction()
const values = reactive(
  Object.fromEntries(
    props.fields.map((f) => [
      f.key,
      f.type === 'checkbox' ? Boolean(props.row?.[f.key] ?? true) : (props.row?.[f.key] ?? ''),
    ]),
  ),
)
const original = { ...values }
function save() {
  run(async () => {
    const body = props.row ? {} : { ...props.defaults }
    for (const f of props.fields) {
      const v = values[f.key]
      if (props.row && v === original[f.key]) continue
      if (v === '' && props.row && original[f.key] !== '')
        throw Error(f.label + ' cannot be cleared. Enter a replacement value.')
      if (v !== '') body[f.key] = f.type === 'number' ? Number(v) : v
    }
    if (!Object.keys(body).length) {
      emit('cancel')
      return
    }
    if (props.row && ('password' in body || 'is_active' in body) &&
      !window.confirm('Apply these changes to ' + (props.row.full_name || props.row.name || 'this record') + '?')) return
    const record = await api(props.endpoint, { method: props.row ? 'PATCH' : 'POST', body })
    emit('saved', record)
  })
}
</script>
<template>
  <form class="panel narrow editor" @submit.prevent="save">
    <h2>{{ title }}</h2>
    <template v-for="f in fields" :key="f.key">
      <label v-if="f.type === 'checkbox'" class="check">
        <input type="checkbox" v-model="values[f.key]" />
        {{ f.label }}
      </label>
      <label v-else>
        {{ f.label }}
        <select v-if="f.options" v-model="values[f.key]" :required="f.required">
          <option value="" disabled>Select an option</option>
          <option v-for="v in f.options" :value="v">{{ v }}</option>
        </select>
        <textarea
          v-else-if="f.type === 'textarea'"
          v-model.trim="values[f.key]"
          :maxlength="f.max"
          :required="f.required"
        />
        <input
          v-else
          v-model="values[f.key]"
          :type="f.type || 'text'"
          :autocomplete="f.type === 'password' ? 'new-password' : 'off'"
          :required="f.required"
          :maxlength="f.max"
          :minlength="f.minlength"
          :min="f.min"
          :max="f.type === 'number' ? f.max : undefined"
        />
      </label>
    </template>
    <p class="error" role="alert" v-if="error">{{ error }}</p>
    <div class="actions">
      <button class="primary" :disabled="busy">Save</button>
      <button class="secondary" type="button" @click="$emit('cancel')" :disabled="busy">Cancel</button>
    </div>
  </form>
</template>
