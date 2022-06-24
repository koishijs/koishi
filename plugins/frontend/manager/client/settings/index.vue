<template>
  <k-card-aside class="page-plugins">
    <template #aside>
      <tree-view v-model="path"></tree-view>
    </template>
    <k-content class="plugin-view" :key="path">
      <global-settings v-if="current.path === '@global'" :current="current"></global-settings>
      <group-settings v-else-if="current.children" v-model="path" :current="current"></group-settings>
      <plugin-settings v-else :current="current"></plugin-settings>
    </k-content>
  </k-card-aside>
</template>

<script setup lang="ts">

import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { plugins, Tree } from './utils'
import GlobalSettings from './global.vue'
import GroupSettings from './group.vue'
import TreeView from './tree.vue'
import PluginSettings from './plugin.vue'

const route = useRoute()
const router = useRouter()

const path = computed<string>({
  get() {
    const name = route.path.slice(9)
    return name in plugins.value.paths ? name : '@global'
  },
  set(name) {
    if (!(name in plugins.value.paths)) name = '@global'
    router.replace('/plugins/' + name)
  },
})

const current = ref<Tree>()

watch(() => plugins.value.paths[path.value], (value) => {
  current.value = value
}, { immediate: true })

</script>

<style lang="scss">

.page-plugins {
  h1 {
    display: flex;
    justify-content: space-between;
    font-size: 1.375rem;
    margin: 0 0 2rem;
    height: 2rem;
    align-items: center;
  }
}

</style>
