<template>
  <div class="plugin-view">
    <div class="content">
      <template v-if="!current.name">
        <h1>
          全局设置
          <k-button solid>应用配置</k-button>
        </h1>
      </template>
      <template v-else>
        <h1>
          {{ getFullname(current) }}
          <template v-if="current.schema">
            <template v-if="current.id">
              <k-button solid type="error" @click="execute('dispose')">停用插件</k-button>
              <t-button :message="message" @click="execute('reload')">重载配置</t-button>
            </template>
            <template v-else>
              <t-button :message="message" @click="execute('install')">启用插件</t-button>
              <k-button solid @click="execute('save')">保存配置</k-button>
            </template>
          </template>
        </h1>
        <k-comment v-for="key in current.delegates?.providing || []" type="success">
          <template #header>实现接口：{{ key }}</template>
        </k-comment>
        <k-comment v-for="(data, key) in delegates" :type="data.fulfilled ? 'success' : data.required ? 'warning' : 'default'">
          <template #header>{{ data.required ? '依赖' : '可选' }}接口：{{ key }}</template>
          <ul>
            <li v-for="name in data.available">{{ name }}</li>
          </ul>
        </k-comment>
        <k-comment v-for="(fulfilled, name) in peerDeps" :type="fulfilled ? 'success' : 'warning'">
          <template #header>依赖插件：{{ name }}</template>
        </k-comment>
      </template>
      <p v-if="!current.schema">此插件暂不支持在线配置。</p>
      <template v-else>
        <k-schema :schema="current.schema" v-model="current.config" prefix=""/>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">

import { computed } from 'vue'
import type { Context, Dict } from '~/server'
import { registry, market, send } from '~/client'
import { Data, available } from './shared'
import TButton from './button.vue'

const props = defineProps<{
  current: Data
}>()

const peerDeps = computed(() => Object.fromEntries((props.current.peerDeps || [])
  .map(name => [name, market.value.some(data => data.name === name && data.local?.id)]))
)

interface DelegateData {
  required: boolean
  fulfilled: boolean
  available?: string[]
}

function getFullname({ name, fullname, id }: Data) {
  if (fullname) return fullname
  const item = market.value?.find(item => item.local?.id === id)
  if (item) return item.name
  return name
}

function getDelegateData(name: Context.Delegates.Keys, required: boolean) {
  const fulfilled = registry.value[0].delegates.providing.includes(name)
  if (fulfilled) return { required, fulfilled }
  return {
    required,
    fulfilled,
    available: available.value.filter(item => item.delegates?.providing?.includes(name)).map(getFullname),
  }
}

const delegates = computed(() => {
  const { required = [], optional = [] } = props.current.delegates || {}
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
  const { required = [] } = props.current.delegates || {}
  if (required.some(name => !registry.value[0].delegates.providing.includes(name))) {
    return '存在未安装的依赖接口。'
  }

  if (!Object.values(peerDeps.value).every(v => v)) {
    return '存在未安装的依赖插件。'
  }
})

function execute(event: string) {
  const { name, config } = props.current
  send('config/' + event, { name, config })
}

</script>
