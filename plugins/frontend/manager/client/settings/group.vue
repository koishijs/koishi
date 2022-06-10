<template>
  <h1 class="config-header">
    {{ current.label }}
    <k-button solid @click="execute('unload', '')">添加插件</k-button>
    <k-button solid @click="execute('group', 'group')">添加分组</k-button>
  </h1>
</template>

<script lang="ts" setup>

import { send, router } from '@koishijs/client'
import { Tree } from './utils'

const props = defineProps<{
  current: Tree
}>()

function execute(action: 'group' | 'unload', name: string) {
  const id = Math.random().toString(36).slice(2, 8)
  const path = (props.current.path ? props.current.path + '/' : '') + name + ':' + id
  send(`manager/${action}`, path)
  router.replace('/plugins/' + path)
}

</script>
