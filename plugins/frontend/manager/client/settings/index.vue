<template>
  <k-card-aside class="page-settings">
    <template #aside>
      <plugin-select v-model="path"></plugin-select>
    </template>
    <k-content class="plugin-view">
      <global-settings v-if="current.path === '@global'" :data="current"></global-settings>
      <group-settings v-else-if="current.children" :data="current"></group-settings>
      <plugin-settings v-else :current="current"></plugin-settings>
    </k-content>
  </k-card-aside>
</template>

<script setup lang="ts">

import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { plugins } from './utils'
import GlobalSettings from './global.vue'
import GroupSettings from './group.vue'
import PluginSelect from './select.vue'
import PluginSettings from './plugin.vue'

function join(source: string | string[]) {
  return Array.isArray(source) ? source.join('/') : source || ''
}

const route = useRoute()
const router = useRouter()

const path = computed<string>({
  get() {
    const name = join(route.params.name)
    return name in plugins.value.map ? name : '@global'
  },
  set(name) {
    if (!(name in plugins.value.map)) name = '@global'
    router.replace('/plugins/' + name)
  },
})

const current = computed(() => plugins.value.map[path.value])

</script>

<style lang="scss">

</style>
