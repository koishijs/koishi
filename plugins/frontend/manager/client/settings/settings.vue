<template>
  <k-content class="plugin-view">
    <!-- title -->
    <h1 class="config-header" v-if="data.name">
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
    <h1 class="config-header" v-else>
      全局设置
      <k-button solid @click="send('manager/app-reload', data.config)">应用配置</k-button>
    </h1>

    <!-- market -->
    <template v-if="data.name">
      <!-- latest -->
      <k-comment v-if="hasUpdate">
        当前的插件版本不是最新，<router-link to="/dependencies">点击前往依赖管理</router-link>。
      </k-comment>

      <!-- external -->
      <k-comment type="warning" v-if="!store.dependencies[current]">
        尚未将当前插件列入依赖，<a @click="send('market/patch', current, data.version)">点击添加</a>。
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
    </template>

    <!-- schema -->
    <k-comment v-if="!data.root && data.id" type="warning">
      此插件已被加载，但并非是在配置文件中。你无法修改其配置。
    </k-comment>
    <template v-else>
      <k-comment v-if="!data.schema" type="warning">
        此插件未声明配置项，这可能并非预期行为{{ hint }}。
      </k-comment>
      <k-form :schema="data.schema" v-model="data.config">
        <template #hint>{{ hint }}</template>
      </k-form>
    </template>
  </k-content>
</template>

<script setup lang="ts">

import { computed } from 'vue'
import { store, send } from '@koishijs/client'
import { envMap } from './utils'
import { getMixedMeta } from '../utils'
import KDepLink from './dep-link.vue'

const props = defineProps<{
  current: string
}>()

const data = computed(() => getMixedMeta(props.current))
const env = computed(() => envMap.value[props.current])
const hint = computed(() => data.value.workspace ? '，请检查源代码' : '，请联系插件作者')

const hasUpdate = computed(() => {
  if (!data.value.versions || data.value.workspace) return
  return data.value.versions[0].version !== data.value.version
})

function execute(event: 'unload' | 'reload') {
  const { shortname, config } = data.value
  send(`manager/plugin-${event}`, shortname, config)
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
