<template>
  <h1 class="config-header">
    {{ data.shortname }}
    <span class="version">({{ data.workspace ? '工作区' : data.version }})</span>
    <template v-if="data.id">
      <k-button solid type="error" @click="execute('unload')">停用插件</k-button>
      <k-button solid :disabled="env.invalid" @click="execute('reload')">重载配置</k-button>
    </template>
    <template v-else>
      <k-button solid :disabled="env.invalid" @click="execute('reload')">启用插件</k-button>
      <k-button solid @click="execute('unload')">保存配置</k-button>
    </template>
  </h1>

  <!-- latest -->
  <k-comment v-if="hasUpdate">
    当前的插件版本不是最新，<router-link to="/dependencies">点击前往依赖管理</router-link>。
  </k-comment>

  <!-- external -->
  <k-comment type="warning" v-if="!data.workspace && !store.dependencies[name]">
    尚未将当前插件列入依赖，<a @click="send('market/patch', name, data.version)">点击添加</a>。
  </k-comment>

  <!-- impl -->
  <template v-for="name in env.impl" :key="name">
    <k-comment v-if="name in store.services && !data.id" type="warning">
      此插件将会提供 {{ name }} 服务，但此服务已被其他插件实现。
    </k-comment>
    <k-comment v-else :type="data.id ? 'success' : 'primary'">
      此插件{{ data.id ? '提供了' : '将会提供' }} {{ name }} 服务。
    </k-comment>
  </template>

  <!-- using -->
  <k-comment
    v-for="({ fulfilled, required, available, name }) in env.using" :key="name"
    :type="fulfilled ? 'success' : required ? 'error' : 'primary'">
    {{ required ? '必需' : '可选' }}服务：{{ name }}
    {{ fulfilled ? '(已加载)' : '(未加载，启用下列任一插件可实现此服务)' }}
    <template v-if="!fulfilled" #body>
      <ul>
        <li v-for="name in available">
          <k-dep-link :name="name"></k-dep-link> (点击{{ name in store.packages ? '配置' : '添加' }})
        </li>
      </ul>
    </template>
  </k-comment>

  <!-- dep -->
  <k-comment
    v-for="({ fulfilled, required, local, name }) in env.deps" :key="name"
    :type="fulfilled ? 'success' : required ? 'error' : 'primary'">
    {{ required ? '必需' : '可选' }}依赖：<k-dep-link :name="name"></k-dep-link>
    ({{ local ? `${fulfilled ? '已' : '未'}启用` : '未安装，点击添加' }})
  </k-comment>

  <!-- schema -->
  <k-comment v-if="!data.schema" type="warning">
    此插件未声明配置项，这可能并非预期行为{{ hint }}。
  </k-comment>
  <k-form :schema="data.schema" :initial="current.config" v-model="config">
    <template #hint>{{ hint }}</template>
  </k-form>
</template>

<script lang="ts" setup>

import { send, store, clone } from '@koishijs/client'
import { computed, ref, watch } from 'vue'
import { getMixedMeta } from '../utils'
import { envMap, Tree } from './utils'
import KDepLink from './dep-link.vue'

const props = defineProps<{
  current: Tree
}>()

const config = ref()

watch(() => props.current.config, (value) => {
  config.value = clone(value)
}, { immediate: true })

const name = computed(() => {
  const { label } = props.current
  if (label.includes('/')) {
    const [left, right] = label.split('/')
    return `${left}/koishi-plugin-${right}`
  }
  return [`@koishijs/plugin-${label}`, `koishi-plugin-${label}`].find(name => name in store.packages)
})

const data = computed(() => getMixedMeta(name.value))
const env = computed(() => envMap.value[name.value])
const hint = computed(() => data.value.workspace ? '，请检查源代码' : '，请联系插件作者')

const hasUpdate = computed(() => {
  if (!data.value.versions || data.value.workspace) return
  return data.value.versions[0].version !== data.value.version
})

function execute(event: 'unload' | 'reload') {
  send(`manager/plugin-${event}`, props.current.path, config.value)
}

</script>

<style lang="scss">

.plugin-view {
  a {
    cursor: pointer;
    &:hover {
      text-decoration: underline;
    }
  }
}

</style>
