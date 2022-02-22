<template>
  <k-card-aside class="page-settings">
    <template #aside>
      <plugin-select v-model="current"></plugin-select>
    </template>
    <plugin-settings :key="current" :current="current"></plugin-settings>
  </k-card-aside>
</template>

<script setup lang="ts">

import { store } from '@koishijs/client'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PluginSelect from './select.vue'
import PluginSettings from './settings.vue'

function join(source: string | string[]) {
  return Array.isArray(source) ? source.join('/') : source || ''
}

const route = useRoute()
const router = useRouter()

const current = computed<string>({
  get() {
    const name = join(route.params.name)
    return store.packages[name] ? name : ''
  },
  set(name) {
    if (!store.packages[name]) name = ''
    router.replace('/settings/' + name)
  },
})

</script>

<style lang="scss">

</style>
