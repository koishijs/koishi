<template>
  <k-content class="plugin-view">
    <!-- title -->
    <h1 v-if="data.name">
      {{ data.name }}
      <span v-if="data.workspace">(工作区)</span>
      <span v-else-if="data.id">({{ data.version }})</span>
    </h1>
    <h1 v-else>
      全局设置
      <k-button solid>应用配置</k-button>
    </h1>

    <!-- market -->
    <template v-if="data.name">
      <!-- versions -->
      <p v-if="remote && !data.workspace">
        选择版本：
        <el-select v-model="version">
          <el-option
            v-for="({ version }, index) in remote.versions"
            :key="version" :label="version + (index ? '' : ' (最新)')" :value="version"
          ></el-option>
        </el-select>
        <k-tip-button v-if="local" :tip="loadTip" type="error" @click="uninstall">卸载插件</k-tip-button>
        <k-tip-button :tip="loadTip" @click="install">
          <template #content v-if="version === data.version && local">要安装的版本与当前版本一致。</template>
          <template #default>{{ local ? '更新插件' : '安装插件' }}</template>
        </k-tip-button>
      </p>

      <!-- dependencies -->
      <k-dep-alert
        v-for="({ fulfilled, required, available }, key) in delegates" :key="key"
        :fulfilled="fulfilled" :required="required" :name="key" type="服务">
        <ul v-if="!fulfilled">
          <li v-for="name in available" @click="configurate(name)">
            <k-dep-link :name="name"></k-dep-link>
          </li>
        </ul>
      </k-dep-alert>
      <k-dep-alert
        v-for="(fulfilled, name) in getDeps('peerDeps')" :key="name"
        :fulfilled="fulfilled" :required="true" type="依赖">
        <template #name><k-dep-link :name="name"></k-dep-link></template>
      </k-dep-alert>
      <k-dep-alert
        v-for="(fulfilled, name) in getDeps('devDeps')" :key="name"
        :fulfilled="fulfilled" :required="false" type="依赖">
        <template #name><k-dep-link :name="name"></k-dep-link></template>
      </k-dep-alert>
    </template>

    <!-- schema -->
    <template v-if="data.schema">
      <h1 class="schema-header" v-if="data.shortname">
        配置项
        <template v-if="data.id">
          <k-button solid type="error" @click="execute('dispose')">停用插件</k-button>
          <k-tip-button :tip="depTip" @click="execute('reload')">重载配置</k-tip-button>
        </template>
        <template v-else>
          <k-tip-button :tip="depTip" @click="execute('install')">启用插件</k-tip-button>
          <k-button solid @click="execute('save')">保存配置</k-button>
        </template>
      </h1>
      <k-schema :schema="data.schema" v-model="data.config" prefix=""></k-schema>
    </template>
  </k-content>
</template>

<script setup lang="ts">

import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Dict } from 'koishi'
import { store, send } from '~/client'
import { KSchema } from '../components'
import { addFavorite, state } from '../utils'
import { MarketProvider } from '../../src'
import { ElMessage } from 'element-plus'
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

function getDeps(type: 'peerDeps' | 'devDeps') {
  return Object.fromEntries((data.value[type] || [])
    .map(name => [name, !!store.packages[name]?.id]))
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

const depTip = computed(() => {
  const required = getKeywords('required')
  if (required.some(name => !store.services[name])) {
    return '存在未安装的依赖接口。'
  }

  if (!Object.values(getDeps('peerDeps')).every(v => v)) {
    return '存在未安装的依赖插件。'
  }
})

const loadTip = computed(() => {
  if (state.downloading) return '请先等待未完成的任务。'
})

function execute(event: string) {
  const { name, config } = data.value
  send('plugin/' + event, { name, config })
}

const router = useRouter()

function configurate(name: string) {
  addFavorite(name)
  router.replace({ query: { name } })
}

async function install() {
  state.downloading = true
  try {
    const code = await send('install', `${data.value.name}@^${version.value}`)
    if (code === 0) {
      ElMessage.success('安装成功！')
    } else {
      ElMessage.error('安装失败！')
    }
  } catch (err) {
    ElMessage.error('安装超时！')
  } finally {
    state.downloading = false
  }
}

async function uninstall() {
  state.downloading = true
  try {
    const code = await send('uninstall', data.value.name)
    if (code === 0) {
      ElMessage.success('卸载成功！')
    } else {
      ElMessage.error('卸载失败！')
    }
  } catch (err) {
    ElMessage.error('卸载超时！')
  } finally {
    state.downloading = false
  }
}

</script>

<style lang="scss">

.plugin-view {
  h1 {
    margin: 0 0 2rem;
  }

  .k-button {
    float: right;
    font-size: 1rem;
  }

  h1.schema-header {
    font-size: 1.375rem;
    margin: 2rem 0;
  }
}

</style>
