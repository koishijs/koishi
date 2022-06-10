<template>
  <span class="k-alias">
    @ <input v-model="alias" @blur="updateAlias">
  </span>
</template>

<script lang="ts" setup>

import { setPath, Tree } from './utils'
import { ref, watch } from 'vue'
import { send } from '@koishijs/client'

const props = defineProps<{
  current: Tree
}>()

const alias = ref()

watch(() => props.current.alias, (value) => {
  alias.value = value
}, { immediate: true })

function updateAlias() {
  if (alias.value === props.current.alias) return
  props.current.alias = alias.value
  send('manager/alias', props.current.path, alias.value)
  const oldPath = props.current.path
  const segments = oldPath.split('/')
  const oldKey = segments.pop()
  segments.push(oldKey.split(':', 1)[0] + (alias.value ? ':' : '') + alias.value)
  setPath(oldPath, segments.join('/'))
}

</script>

<style lang="scss" scoped>

.k-alias {
  user-select: none;

  input {
    font-size: inherit;
    color: inherit;
    border: none;
    outline: none;
    padding: 0;
  }
}

</style>
