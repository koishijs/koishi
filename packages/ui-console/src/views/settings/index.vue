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

</style>
