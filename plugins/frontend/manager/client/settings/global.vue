<template>
  <h1 class="config-header">
    <span class="left">全局设置</span>
    <span class="right">
      <k-button solid @click="send('manager/app-reload', config)">应用配置</k-button>
    </span>
  </h1>
  <k-form :schema="store.packages[''].schema" :initial="current.config" v-model="config"></k-form>
</template>

<script lang="ts" setup>

import { send, store, clone } from '@koishijs/client'
import { ref, watch } from 'vue'
import { Tree } from './utils'

const props = defineProps<{
  current: Tree
}>()

const config = ref()

watch(() => props.current.config, (value) => {
  config.value = clone(value)
}, { immediate: true })

</script>
