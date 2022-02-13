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
      <k-button solid>应用配置</k-button>
    </h1>

    <!-- market -->
    <template v-if="data.name">
      <!-- impl -->
      <template v-for="name in env.impl" :key="name">
        <k-comment v-if="name in store.services && !data.id" type="error">
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
    <template v-if="data.root || !data.id">
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
import { store, send } from '~/client'
import { envMap } from './utils'
import { getMixedMeta } from '../utils'
import KDepLink from './dep-link.vue'

const props = defineProps<{
  current: string
}>()

const data = computed(() => getMixedMeta(props.current))
const env = computed(() => envMap.value[props.current])

const version = ref('')

watch(data, (value) => {
  version.value = value.version
}, { immediate: true })

function execute(event: 'unload' | 'reload') {
  const { shortname, config } = data.value
  send(`manager/plugin-${event}`, shortname, config)
}

</script>

<style lang="scss">

</style>
