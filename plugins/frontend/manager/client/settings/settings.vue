<template>
  <k-content class="plugin-view">
    <!-- title -->
    <h1 class="config-header" v-if="data.name">
      {{ data.name }}
      <span v-if="data.workspace">(工作区)</span>
      <span v-else-if="data.id">({{ data.version }})</span>
    </h1>
    <h1 class="config-header" v-else>
      全局设置
      <k-button solid>应用配置</k-button>
    </h1>

    <!-- market -->
    <template v-if="data.name">
      <!-- impl -->
      <k-comment
        v-for="name in env.impl" :key="name"
        :type="data.id ? 'success' : 'primary'" #header>
        此插件{{ data.id ? '提供了' : '将会提供' }} {{ name }} 服务。
      </k-comment>

      <!-- using -->
      <k-comment
        v-for="({ fulfilled, required, available, name }) in env.using" :key="name"
        :type="fulfilled ? 'success' : required ? 'warning' : 'primary'" #header>
        {{ required ? '必需' : '可选' }}服务：{{ name }}
        <template v-if="fulfilled">(已加载)</template>
        <template v-else>
          (未加载，启用下列任一插件可实现此服务)
          <ul v-if="!fulfilled">
            <li v-for="name in available">
              <k-dep-link :name="name"></k-dep-link>
            </li>
          </ul>
        </template>
      </k-comment>

      <!-- dep -->
      <k-comment
        v-for="({ fulfilled, required, local, name }) in env.deps" :key="name"
        :type="fulfilled ? 'success' : required ? 'warning' : 'primary'" #header>
        {{ required ? '必需' : '可选' }}依赖：<k-dep-link :name="name"></k-dep-link>
        ({{ local ? `${fulfilled ? '已' : '未'}启用，点击配置` : '未安装，点击添加' }})
      </k-comment>
    </template>

    <!-- schema -->
    <template v-if="data.root || !data.id">
      <h1 class="config-header" v-if="data.shortname">
        配置项
        <template v-if="data.id">
          <k-button solid type="error" @click="execute('unload')">停用插件</k-button>
          <k-button solid :disabled="!env.ready" @click="execute('reload')">重载配置</k-button>
        </template>
        <template v-else>
          <k-button solid :disabled="!env.ready" @click="execute('reload')">启用插件</k-button>
          <k-button solid @click="execute('unload')">保存配置</k-button>
        </template>
      </h1>
      <k-form :schema="data.schema" v-model="data.config"></k-form>
    </template>
    <template v-else>
      <k-comment type="warning">
        <template #header>此插件已被加载，但并非是在配置文件中。你无法修改其配置。</template>
      </k-comment>
    </template>
  </k-content>
</template>

<script setup lang="ts">

import { computed, ref, watch } from 'vue'
import { Dict } from 'koishi'
import { store, send } from '~/client'
import { MarketProvider, Package } from '@koishijs/plugin-manager'
import KDepAlert from './dep-alert.vue'
import KDepLink from './dep-link.vue'
import { getMixedMeta } from '../utils'

const props = defineProps<{
  current: string
}>()

const data = computed(() => getMixedMeta(props.current))

const version = ref('')

watch(data, (value) => {
  version.value = value.version
}, { immediate: true })

function getKeywords(prefix: string, meta: Package.Meta = data.value) {
  prefix += ':'
  return meta.keywords
    .filter(name => name.startsWith(prefix))
    .map(name => name.slice(prefix.length))
}

interface ServiceData {
  name: string
  required: boolean
  fulfilled: boolean
  available?: string[]
  local?: boolean
}

interface EnvInfo {
  impl: string[]
  deps: Dict<ServiceData>
  using: Dict<ServiceData>
  ready?: boolean
  console?: boolean
}

function isAvailable(name: string, remote: MarketProvider.Data) {
  return getKeywords('impl', {
    ...remote.versions[0],
    ...store.packages[remote.name],
  }).includes(name)
}

const env = computed(() => {
  function setService(name: string, required: boolean) {
    if (name === 'console') {
      result.console = true
      return
    }

    const fulfilled = name in store.services
    if (required && !fulfilled) result.ready = false
    result.using[name] = { name, required, fulfilled }
    if (!fulfilled) {
      result.using[name].available = Object.values(store.market || {})
        .filter(data => isAvailable(name, data))
        .map(data => data.name)
    }
  }

  const result: EnvInfo = { impl: [], using: {}, deps: {} }
  for (const name of getKeywords('impl')) {
    if (name === 'adapter') continue
    result.impl.push(name)
  }
  for (const name of getKeywords('required')) {
    setService(name, true)
  }
  for (const name of getKeywords('optional')) {
    setService(name, false)
  }
  for (const name of data.value.peerDeps) {
    if (name === '@koishijs/plugin-console') continue
    const local = name in store.packages
    const fulfilled = !!store.packages[name]?.id
    if (!fulfilled) result.ready = false
    result.deps[name] = { name, required: true, fulfilled, local }
    for (const impl of getKeywords('impl', getMixedMeta(name))) {
      delete result.using[impl]
    }
  }
  return result
})

function execute(event: string) {
  const { shortname, config } = data.value
  send('manager/plugin-' + event, shortname, config)
}

</script>

<style lang="scss">

</style>
