<template>
  <k-card class="page-config frameless">
    <div class="plugin-select">
      <div class="content">
        <choice-view class="group" :data="registry[0]" v-model="current"/>
        <div class="group">运行中的插件</div>
        <choice-view v-for="data in registry.filter(data => data.id)" :data="data" v-model="current"/>
        <template v-if="market">
          <div class="group">未运行的插件</div>
          <choice-view v-for="data in available" :data="data" v-model="current"/>
        </template>
      </div>
    </div>
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
                <el-tooltip :content="message" placement="bottom-end" effect="dark">
                  <k-button solid :disabled="!!message" @click="execute('reload')">重载配置</k-button>
                </el-tooltip>
              </template>
              <template v-else>
                <el-tooltip :content="message" placement="bottom-end" effect="dark">
                  <k-button solid :disabled="!!message" :title="message" @click="execute('install')">启用插件</k-button>
                </el-tooltip>
                <k-button solid @click="execute('save')" :title="message">保存配置</k-button>
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
        </template>
        <p v-if="!current.schema">此插件暂不支持在线配置。</p>
        <template v-else>
          <k-schema :schema="current.schema" v-model="current.config" prefix=""/>
        </template>
      </div>
    </div>
  </k-card>
</template>

<script setup lang="ts">

import { ref, computed, watch } from 'vue'
import { registry, market, send } from '~/client'
import { Dict, Registry, Context } from '~/server'
import ChoiceView from './choice.vue'

interface PluginData extends Registry.Data {
  fullname?: string
}

const current = ref<PluginData>(registry.value[0])

const available = computed(() => {
  const result: Dict<PluginData> = {}
  for (const data of registry.value.filter(data => data.name && !data.id)) {
    result[data.name] = data
  }

  for (const data of market.value.filter(data => data.local && !data.local.id)) {
    result[data.shortname] = {
      name: data.shortname,
      fullname: data.name,
      schema: data.local?.schema,
      delegates: data.local?.delegates,
      config: {},
      ...result[data.shortname],
    }
  }

  return Object.entries(result).sort(([a], [b]) => a > b ? 1 : -1).map(([, v]) => v)
})

const message = computed(() => {
  const { required = [] } = current.value.delegates || {}
  if (required.some(name => !registry.value[0].delegates.providing.includes(name))) {
    return '存在未安装的依赖接口。'
  }
})

interface DelegateData {
  required: boolean
  fulfilled: boolean
  available?: string[]
}

function getFullname({ name, fullname, id }: PluginData) {
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
  const { required = [], optional = [] } = current.value.delegates || {}
  const result: Dict<DelegateData> = {}
  for (const name of required) {
    result[name] = getDelegateData(name, true)
  }
  for (const name of optional) {
    result[name] = getDelegateData(name, false)
  }
  return result
})

watch(registry, plugins => {
  const data = plugins.find(item => item.name === current.value.name)
  if (!data) return
  current.value = data
})

watch(available, () => {
  const data = available.value[current.value.name]
  if (!data) return
  current.value = data
})

function execute(event: string) {
  const { name, config } = current.value
  send('config/' + event, { name, config })
}

</script>

<style lang="scss">

.page-config .k-card-body {
  height: calc(100vh - 4rem);
}

.plugin-select {
  width: 16rem;
  height: 100%;
  border-right: 1px solid var(--border);
  overflow: auto;

  .content {
    padding: 1rem 0;
    line-height: 2.25rem;
  }

  .group {
    padding: 0 2rem !important;
    font-weight: bold;
  }

  .group:not(.choice) {
    margin-top: 0.5rem;
  }

  .choice {
    cursor: pointer;
    padding: 0 2rem 0 4rem;
    transition: 0.3s ease;

    &:hover, &.active {
      background-color: var(--bg1);
    }
  }

  .choice.readonly {
    color: var(--fg3t);

    &:hover, &.active {
      color: var(--fg1);
    }
  }
}

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
