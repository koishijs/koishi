<template>
  <h1 class="config-header">
    配置项
    <template v-if="data.config.disabled">
      <k-button solid @click="execute('load')">登陆账号</k-button>
      <k-button solid @click="execute('unload')">保存配置</k-button>
    </template>
    <template v-else>
      <k-button solid type="error" @click="execute('unload')">登出账号</k-button>
      <k-button solid @click="execute('load')">重载配置</k-button>
    </template>
  </h1>
  <k-schema :schema="schema" :key="current" v-model="data.config"></k-schema>
</template>

<script lang="ts" setup>

import { computed } from 'vue'
import { store } from '~/client'

const props = defineProps<{
  current: number
}>()

const data = computed(() => store.bots[props.current])

const schema = computed(() => {
  const { adapter, config } = data.value
  const key = adapter + (config.protocol ? '.' + config.protocol : '')
  return store.protocols[key] || store.protocols[adapter]
})

function execute(action: string) {
}

</script>

<style scoped lang="scss">

</style>
