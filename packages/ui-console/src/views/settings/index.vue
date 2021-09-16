<template>
  <k-card class="page-config frameless">
    <plugin-selector v-model="current"></plugin-selector>
    <plugin-settings :current="current"></plugin-settings>
  </k-card>
</template>

<script setup lang="ts">

import { ref, watch } from 'vue'
import { registry } from '~/client'
import { available, Data } from './shared'
import PluginSelector from './selector.vue'
import PluginSettings from './settings.vue'

const current = ref<Data>(registry.value[0])

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

  .fa-filter {
    font-size: 0.9em;
    cursor: pointer;

    &:active, &.filtered {
      opacity: 1;
    }

    &:active {
      color: var(--fg0);
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
