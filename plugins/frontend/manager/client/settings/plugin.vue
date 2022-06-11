<template>
  <h1 class="config-header plugin">
    <template v-if="!current.label">
      <el-select v-model="current.target" placeholder="插件选择">
        <el-option
          v-for="name in Object.values(store.packages).slice(1).map(value => value.shortname).sort()"
          :key="name" :label="name" :value="name"
        ></el-option>
      </el-select>
    </template>
    <template v-else>
      <span class="label">{{ current.label }}</span>
      <k-alias :current="current"></k-alias>
    </template>
    <template v-if="!current.disabled">
      <k-button solid type="error" @click="execute('unload')">停用插件</k-button>
      <k-button solid :disabled="env.invalid" @click="execute('reload')">重载配置</k-button>
    </template>
    <template v-else-if="name">
      <k-button solid :disabled="env.invalid" @click="execute('reload')">启用插件</k-button>
      <k-button solid @click="execute('unload')">保存配置</k-button>
    </template>
  </h1>

  <template v-if="name">
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

  <k-comment v-else-if="current.label" type="error">
    此插件尚未安装，<span class="link" @click.stop="gotoMarket">点击前往插件市场</span>。
  </k-comment>
</template>

<script lang="ts" setup>

import { send, store, clone, router } from '@koishijs/client'
import { computed, ref, watch } from 'vue'
import { getMixedMeta } from '../utils'
import { envMap, Tree } from './utils'
import KAlias from './alias.vue'
import KDepLink from './dep-link.vue'

const props = defineProps<{
  current: Tree
}>()

const config = ref()

watch(() => props.current.config, (value) => {
  config.value = clone(value)
}, { immediate: true })

const name = computed(() => {
  const { label, target: temporary } = props.current
  const shortname = temporary || label
  if (shortname.includes('/')) {
    const [left, right] = shortname.split('/')
    return [`${left}/koishi-plugin-${right}`].find(name => name in store.packages)
  }
  return [
    `@koishijs/plugin-${shortname}`,
    `koishi-plugin-${shortname}`,
  ].find(name => name in store.packages)
})

const data = computed(() => getMixedMeta(name.value))
const env = computed(() => envMap.value[name.value])
const hint = computed(() => data.value.workspace ? '，请检查源代码' : '，请联系插件作者')

const hasUpdate = computed(() => {
  if (!data.value.versions || data.value.workspace) return
  return data.value.versions[0].version !== data.value.version
})

function execute(event: 'unload' | 'reload') {
  send(`manager/${event}`, props.current.path, config.value, props.current.target)
  if (props.current.target) {
    const segments = props.current.path.split('/')
    segments[segments.length - 1] = props.current.target
    router.replace('/plugins/' + segments.join('/'))
  }
}

function gotoMarket() {
  router.push('/market?keyword=' + props.current.label)
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

  .config-header.plugin .k-alias {
    font-size: 1.15rem;
    color: var(--fg3);
  }

  span.link {
    &:hover {
      cursor: pointer;
      text-decoration: underline;
    }
  }
}

</style>
