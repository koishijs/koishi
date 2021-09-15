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
            {{ title }}
            <template v-if="current.schema">
              <template v-if="current.id">
                <k-button solid type="error" @click="execute('dispose')">停用插件</k-button>
                <k-button solid @click="execute('reload')">重载配置</k-button>
              </template>
              <template>
                <k-button solid @click="execute('install')">启用插件</k-button>
                <k-button solid @click="execute('save')">保存配置</k-button>
              </template>
            </template>
          </h1>
        </template>
        <p v-if="!current.schema">此插件暂不支持在线配置。</p>
        <template v-else>
          <p v-if="current.delegates?.providing">实现接口：{{ current.delegates.providing }}</p>
          <p v-if="current.delegates?.required">依赖接口（必选）：{{ current.delegates.required }}</p>
          <p v-if="current.delegates?.optional">依赖接口（可选）：{{ current.delegates.optional }}</p>
          <k-schema :schema="current.schema" v-model="current.config" prefix=""/>
        </template>
      </div>
    </div>
  </k-card>
</template>

<script setup lang="ts">

import { ref, computed, watch } from 'vue'
import { registry, market, send } from '~/client'
import { Dict, Registry } from '~/server'
import ChoiceView from './choice.vue'

interface PluginData extends Registry.Data {
  fullname?: string
}

const current = ref<PluginData>(registry.value[0])

const title = computed(() => {
  const { name, fullname, id } = current.value
  if (fullname) return fullname
  const item = market.value?.find(item => item.local?.id === id)
  if (item) return item.name
  return name
})

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

  return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a > b ? 1 : -1))
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
  }

  .choice:hover, .choice.active {
    background-color: var(--bg1);
  }

  .choice.readonly {
    color: var(--fg3);
    opacity: 0.75;
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
