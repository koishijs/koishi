<template>
  <h1 class="config-header">
    全局设置
    <k-button solid @click="send('manager/app-reload', data.config)">应用配置</k-button>
  </h1>
  <k-form :schema="store.packages[''].schema" :initial="data.config" v-model="config"></k-form>
</template>

<script lang="ts" setup>

import { send, store, clone } from '@koishijs/client'
import { ref, watch } from 'vue'
import { Tree } from './utils'

const props = defineProps<{
  data: Tree
}>()

const config = ref()

watch(() => props.data.config, (value) => {
  config.value = clone(value)
}, { immediate: true })

</script>
