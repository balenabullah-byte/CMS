<script setup>
defineProps({total:Number,page:Number,size:{type:Number,default:20}})
defineEmits(['go'])
</script>
<template><div class="pager"><span>{{ total }} {{ total===1?'result':'results' }} · Page {{ page }} of {{ Math.max(1,Math.ceil(total/size)) }}</span>
  <button class="secondary" :disabled="page<=1" @click="$emit('go',page-1)">Previous</button>
  <button class="secondary" :disabled="page*size>=total" @click="$emit('go',page+1)">Next</button>
</div></template>
