<template>
  <el-scrollbar class="plugin-view">
    <div class="content">
      <template v-if="!data.name">
        <h1>
          全局设置
          <k-button solid>应用配置</k-button>
        </h1>
      </template>
      <template v-else>
        <h1>
          {{ getFullname(data) }}
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
        <k-comment v-for="key in data.delegates?.providing || []" type="success">
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
      <p v-if="!data.schema">此插件暂不支持在线配置。</p>
      <template v-else>
        <k-schema :schema="data.schema" v-model="data.config" prefix=""/>
      </template>
    </div>
  </el-scrollbar>
</template>

<script setup lang="ts">

import { computed } from 'vue'
import type { Context, Dict } from '~/server'
import { registry, market, send } from '~/client'
import { Data, available } from './shared'
import TButton from './button.vue'

const props = defineProps<{
  current: string
}>()

const data = computed<Data>(() => {
  return registry.value[props.current] || available.value.find(data => data.name === props.current)
})

const peerDeps = computed(() => Object.fromEntries((data.value.peerDeps || [])
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
  const fulfilled = registry.value[''].delegates.providing.includes(name)
  if (fulfilled) return { required, fulfilled }
  return {
    required,
    fulfilled,
    available: available.value.filter(item => item.delegates?.providing?.includes(name)).map(getFullname),
  }
}

const delegates = computed(() => {
  const { required = [], optional = [] } = data.value.delegates || {}
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
  const { required = [] } = data.value.delegates || {}
  if (required.some(name => !registry.value[''].delegates.providing.includes(name))) {
    return '存在未安装的依赖接口。'
  }

  if (!Object.values(peerDeps.value).every(v => v)) {
    return '存在未安装的依赖插件。'
  }
})

function execute(event: string) {
  const { name, config } = data.value
  send('config/' + event, { name, config })
}

</script>

<style lang="scss">

.plugin-view {
  position: absolute;
  top: 0;
  left: 16rem;
  right: 0;
  height: 100%;
  overflow: auto;

  .content {
    margin: auto;
    max-width: 50rem;
    padding: 3rem 3rem 1rem;
  }

  h1 {
    margin: 0 0 2rem;
  }

  h1 .k-button {
    float: right;
    font-size: 1rem;
  }
}

</style>
