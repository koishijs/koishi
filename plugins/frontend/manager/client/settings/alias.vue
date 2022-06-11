<template>
  <span class="k-alias" :class="{ invalid }">
    @ <input v-model="alias" @blur="updateAlias">
  </span>
</template>

<script lang="ts" setup>

import { plugins, setPath, Tree } from './utils'
import { computed, ref, watch } from 'vue'
import { send } from '@koishijs/client'

const props = defineProps<{
  current: Tree
}>()

const alias = ref()

watch(() => props.current.alias, (value) => {
  alias.value = value
}, { immediate: true })

const invalid = computed(() => {
  // group alias cannot be empty
  if (!alias.value && props.current.label !== 'group') return false

  // check invalid characters
  if (alias.value.match(/[:~+#?@&*]/)) return true

  // check duplications
  for (const key in plugins.value.paths) {
    if (key === props.current.path) continue
    const tree = plugins.value.paths[key]
    if (tree.alias === alias.value) return true
  }
})

function updateAlias() {
  if (alias.value === props.current.alias) return
  if (invalid.value) return
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
    color: inherit;
    font-size: inherit;
    font-weight: inherit;
    background-color: transparent;
    width: 6rem;
    border: none;
    outline: none;
    padding: 0;
  }

  &.invalid input {
    color: var(--error);
  }
}

</style>
