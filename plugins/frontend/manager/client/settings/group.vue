<template>
  <h1 class="config-header">
    {{ current.label }}
    <k-button solid @click="addPlugin">添加插件</k-button>
    <!-- <k-button solid @click="execute('unload')">添加分组</k-button> -->
  </h1>
</template>

<script lang="ts" setup>

import { useRouter } from 'vue-router'
import { Tree, plugins } from './utils'

const router = useRouter()

const props = defineProps<{
  current: Tree
}>()

function addPlugin() {
  const tree: Tree = {
    label: '',
    path: props.current.path + '$',
    config: {},
    disabled: true,
  }
  props.current.children.push(tree)
  plugins.value.paths[tree.path] = tree
  router.replace('/plugins/' + tree.path)
}

</script>
