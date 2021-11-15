<template>
  <k-content class="plugin-view">
    <template v-if="!data.shortname">
      <h1>
        全局设置
        <k-button solid>应用配置</k-button>
      </h1>
    </template>
    <template v-else>
      <h1>
        {{ data.fullname }}
        <template v-if="data.schema">
          <template v-if="data.id">
            <k-button solid type="error" @click="execute('dispose')">停用插件</k-button>
            <t-button :message="message" @click="execute('reload')">重载配置</t-button>
          </template>
          <template v-else>
            <t-button :message="message" @click="execute('install')">启用插件</t-button>
            <k-button solid @click="execute('save')">保存配置</k-button>
          </template>
        </template>
      </h1>
      <k-comment v-for="key in getKeywords('service')" type="success">
        <template #header>实现功能：{{ key }}</template>
      </k-comment>
      <k-comment v-for="(data, key) in delegates" :type="data.fulfilled ? 'success' : data.required ? 'warning' : 'default'">
        <template #header>{{ data.required ? '依赖' : '可选' }}功能：{{ key }}</template>
        <ul>
          <li v-for="name in data.available">{{ name }}</li>
        </ul>
      </k-comment>
      <k-comment v-for="(fulfilled, name) in getDeps('peerDeps')" :type="fulfilled ? 'success' : 'warning'">
        <template #header>依赖插件：{{ name }}</template>
      </k-comment>
      <k-comment v-for="(fulfilled, name) in getDeps('devDeps')" :type="fulfilled ? 'success' : 'default'">
        <template #header>可选插件：{{ name }}</template>
      </k-comment>
    </template>
    <p v-if="!data.schema">此插件暂不支持在线配置。</p>
    <template v-else>
      <k-schema :schema="data.schema" v-model="data.config" prefix=""/>
    </template>
  </k-content>
</template>

<script setup lang="ts">

import { computed } from 'vue'
import type { Dict } from 'koishi'
import { store, send } from '~/client'
import { Data, plugins } from './shared'
import { KSchema } from '../components'
import TButton from './button.vue'

const props = defineProps<{
  current: string
}>()

const data = computed(() => plugins.value[props.current])

function getDeps(type: 'peerDeps' | 'devDeps') {
  return Object.fromEntries((data.value[type] || [])
    .map(name => [name, store.packages[name]?.id]))
}

function getKeywords(prefix: string, keywords = data.value.keywords) {
  if (!keywords) return []
  prefix += ':'
  return keywords
    .filter(name => name.startsWith(prefix))
    .map(name => name.slice(prefix.length))
}

interface DelegateData {
  required: boolean
  fulfilled: boolean
  available?: string[]
}

function getDelegateData(name: string, required: boolean): DelegateData {
  const fulfilled = store.services.includes(name)
  if (fulfilled) return { required, fulfilled }
  return {
    required,
    fulfilled,
    available: store.market
      ?.filter(data => getKeywords('service', data.keywords).includes(name))
      .map(data => data.name),
  }
}

const delegates = computed(() => {
  const required = getKeywords('required')
  const optional = getKeywords('optional')
  const result: Dict<DelegateData> = {}
  for (const name of required) {
    result[name] = getDelegateData(name, true)
  }
  for (const name of optional) {
    result[name] = getDelegateData(name, false)
  }
  return result
})

const message = computed(() => {
  const required = getKeywords('required')
  if (required.some(name => !store.services.includes(name))) {
    return '存在未安装的依赖接口。'
  }

  if (!Object.values(getDeps('peerDeps')).every(v => v)) {
    return '存在未安装的依赖插件。'
  }
})

function execute(event: string) {
  const { name, config } = data.value
  send('plugin/' + event, { name, config })
}

</script>

<style lang="scss">

.plugin-view {
  h1 {
    margin: 0 0 2rem;
  }

  h1 .k-button {
    float: right;
    font-size: 1rem;
  }
}

</style>
