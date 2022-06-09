<template>
  <h1 class="config-header">
    {{ current.label }}
    <k-button solid @click="addPlugin">添加插件</k-button>
    <!-- <k-button solid @click="execute('unload')">添加分组</k-button> -->
  </h1>
</template>

<script lang="ts" setup>

import { useRouter } from 'vue-router'
import { send } from '@koishijs/client'
import { Tree, plugins } from './utils'

const router = useRouter()

const props = defineProps<{
  current: Tree
}>()

function addPlugin() {
  const id = Math.random().toString(36).slice(2, 8)
  const path = (props.current.path ? props.current.path + '/' : '') + '@' + id
  send(`manager/plugin-unload`, path, {})
  router.replace('/plugins/' + path)
}

</script>
