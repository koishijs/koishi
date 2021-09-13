<template>
  <k-card class="page-config frameless">
    <div class="plugin-select">
      <k-choice class="group" :data="registry[0]" v-model="current"/>
      <div class="group">已加载的插件</div>
      <k-choice v-for="data in registry.slice(1)" :data="data" v-model="current"/>
      <template v-if="market">
        <div class="group">未加载的插件</div>
        <k-choice v-for="data in available" :data="{ name: data.title }" v-model="current"/>
      </template>
    </div>
    <div class="plugin-view" v-if="current.config">
      {{ current.config }}
    </div>
    <div class="plugin-view" v-else>
      暂不支持
    </div>
  </k-card>
</template>

<script setup lang="ts">

import { ref, computed } from 'vue'
import { registry, market } from '~/client'
import { Registry } from '~/server'
import kChoice from './choice.vue'

const current = ref<Registry.Data>(registry.value[0])

const available = computed(() => {
  return market.value
    .filter(data => data.local && !data.local.isInstalled && !registry.value[data.title])
    .sort((a, b) => a.title > b.title ? 1 : -1)
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
  padding: 2rem;
}

.table-header {
  font-weight: bold;
  border-top: var(--border-dark) 1px solid;

  .title {
    margin-left: 3rem;
  }
}

</style>
