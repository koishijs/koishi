<template>
  <k-card-aside class="page-settings">
    <template #aside>
      <tree-view v-model="path"></tree-view>
    </template>
    <keep-alive>
      <k-content class="plugin-view" :key="path">
        <global-settings v-if="current.path === '@global'" :current="current"></global-settings>
        <group-settings v-else-if="current.children" :current="current"></group-settings>
        <plugin-settings v-else :current="current"></plugin-settings>
      </k-content>
    </keep-alive>
  </k-card-aside>
</template>

<script setup lang="ts">

import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { plugins } from './utils'
import GlobalSettings from './global.vue'
import GroupSettings from './group.vue'
import TreeView from './tree.vue'
import PluginSettings from './plugin.vue'

function join(source: string | string[]) {
  return Array.isArray(source) ? source.join('/') : source || ''
}

const route = useRoute()
const router = useRouter()

const path = computed<string>({
  get() {
    const name = join(route.params.name)
    return name in plugins.value.paths ? name : '@global'
  },
  set(name) {
    if (!(name in plugins.value.paths)) name = '@global'
    router.replace('/plugins/' + name)
  },
})

const current = ref(plugins.value.paths[path.value])

watch(() => path.value, () => {
  current.value = plugins.value.paths[path.value]
})

</script>

<style lang="scss">

</style>
