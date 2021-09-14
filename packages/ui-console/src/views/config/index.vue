<template>
  <k-card class="page-config frameless">
    <div class="plugin-select">
      <div class="content">
        <k-choice class="group" :data="registry[0]" v-model="current"/>
        <div class="group">正在运行的插件</div>
        <k-choice v-for="data in registry.slice(1)" :data="data" v-model="current"/>
        <template v-if="market">
          <div class="group">未运行的插件</div>
          <k-choice v-for="data in available" :data="createExternal(data)" v-model="current"/>
        </template>
      </div>
    </div>
    <div class="plugin-view">
      <div class="content">
        <template v-if="!current.name">
          <h1>全局设置</h1>
        </template>
        <template v-else>
          <h1>
            <span>{{ title }}</span>
            <template v-if="current.id">
              <k-button solid type="error">停用插件</k-button>
              <k-button solid>重载配置</k-button>
            </template>
            <template v-else>
              <k-button solid type="success">启用插件</k-button>
              <k-button solid @click="send('config/save-external', { module: current.module, config: current.config })">保存配置</k-button>
            </template>
          </h1>
        </template>
        <p v-if="!current.schema">此插件暂无可用配置项。</p>
        <k-schema v-else :schema="current.schema" v-model="current.config" prefix=""/>
      </div>
    </div>
  </k-card>
</template>

<script setup lang="ts">

import { ref, computed } from 'vue'
import { registry, market, send } from '~/client'
import { Registry, Dict, Market } from '~/server'
import kChoice from './choice.vue'

interface PluginData extends Registry.Data {
  module?: string
}

const current = ref<PluginData>(registry.value[0])
const cache: Dict<PluginData> = {}

function createExternal(data: Market.Data) {
  return cache[data.name] ||= {
    name: data.shortname,
    module: data.name,
    schema: data.local.schema,
    config: {},
  }
}

const title = computed(() => {
  const { name, module, id } = current.value
  if (!name || module) return module
  const item = market.value?.find(item => item.local?.uuid === id)
  if (item) return item.name
  return name
})

const available = computed(() => {
  return market.value
    .filter(data => data.local && !data.local.uuid)
    .sort((a, b) => a.shortname > b.shortname ? 1 : -1)
})

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

  .choice {
    cursor: pointer;
    padding: 0 2rem 0 4rem;
    transition: 0.3s ease;
  }

  .choice:hover, .choice.active {
    background-color: var(--bg1);
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
