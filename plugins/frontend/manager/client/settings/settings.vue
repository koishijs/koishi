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
      <!-- dependencies -->
      <k-dep-alert
        v-for="({ fulfilled, required, available }, key) in services" :key="key"
        :fulfilled="fulfilled" :required="required" :name="key" type="服务">
        <ul v-if="!fulfilled">
          <li v-for="name in available">
            <k-dep-link :name="name"></k-dep-link>
          </li>
        </ul>
      </k-dep-alert>
      <k-dep-alert
        v-for="(fulfilled, name) in deps" :key="name"
        :fulfilled="fulfilled" :required="true" type="依赖">
        <template #name><k-dep-link :name="name.toString()"></k-dep-link></template>
      </k-dep-alert>
    </template>

    <!-- schema -->
    <template v-if="data.root || !data.id">
      <h1 class="config-header" v-if="data.shortname">
        配置项
        <template v-if="data.id">
          <k-button solid type="error" @click="execute('unload')">停用插件</k-button>
          <k-button solid :disabled="depTip" @click="execute('load')">重载配置</k-button>
        </template>
        <template v-else>
          <k-button solid :disabled="depTip" @click="execute('load')">启用插件</k-button>
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
import { MarketProvider } from '@koishijs/plugin-manager'
import KDepAlert from './dep-alert.vue'
import KDepLink from './dep-link.vue'
import KTipButton from './tip-button.vue'

const props = defineProps<{
  current: string
}>()

const local = computed(() => store.packages[props.current])
const remote = computed(() => store.market[props.current])

const data = computed(() => ({
  ...remote.value,
  ...local.value,
}))

const version = ref('')

watch(data, (value) => {
  version.value = value.version
}, { immediate: true })

const deps = computed(() => {
  return Object
    .fromEntries((data.value.peerDeps || [])
    .map(name => [name, !!store.packages[name]?.id]))
})

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

function isAvailable(name: string, remote: MarketProvider.Data) {
  const { keywords } = remote.versions[0]
  return getKeywords('service', keywords).includes(name)
}

function getDelegateData(name: string, required: boolean): DelegateData {
  const fulfilled = name in store.services
  if (fulfilled) return { required, fulfilled }
  return {
    required,
    fulfilled,
    available: Object.values(store.market || {})
      .filter(data => isAvailable(name, data))
      .map(data => data.name),
  }
}

const services = computed(() => {
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

const depTip = computed(() => {
  const required = getKeywords('required')
  if (required.some(name => !store.services[name])) {
    return '存在未安装的依赖接口。'
  }

  if (!Object.values(deps.value).every(v => v)) {
    return '存在未安装的依赖插件。'
  }
})

function execute(event: string) {
  const { shortname, config } = data.value
  send('plugin/' + event, shortname, config)
}

</script>

<style lang="scss">

</style>
