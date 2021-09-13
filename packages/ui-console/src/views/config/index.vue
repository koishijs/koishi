<template>
  <k-card class="page-config frameless">
    <div class="plugin-select">
      <k-choice class="group" :data="registry[0]" v-model="current"/>
      <div class="group">已加载的插件</div>
      <k-choice v-for="data in registry.slice(1)" :data="data" v-model="current"/>
      <template v-if="market">
        <div class="group">未加载的插件</div>
        <k-choice v-for="data in available" :data="createExternal(data)" v-model="current"/>
      </template>
    </div>
    <div class="plugin-view">
      <template v-if="!current.name">
        <h1>全局配置</h1>
      </template>
      <template v-else>
        <h1>插件：{{ title }}</h1>
        <k-button v-if="current.id">停用</k-button>
        <k-button v-else>启用</k-button>
      </template>
      <p v-if="!current.schema">此插件暂无可用配置项。</p>
      <k-schema v-else :schema="current.schema" :config="current.config"/>
    </div>
  </k-card>
</template>

<script setup lang="ts">

import { ref, computed } from 'vue'
import { registry, market } from '~/client'
import { Registry, Dict, Market } from '~/server'
import kChoice from './choice.vue'
import kSchema from './schema.vue'

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
  display: grid;
  grid-template-columns: 16rem 1fr;
}

.plugin-select {
  padding: 1rem 0;
  line-height: 2.25rem;
  border-right: 1px solid var(--border);

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
  padding: 2rem 3rem;

  h1 {
    margin: 0 0 2rem;
  }
}

.table-header {
  font-weight: bold;
  border-top: var(--border-dark) 1px solid;

  .title {
    margin-left: 3rem;
  }
}

</style>
