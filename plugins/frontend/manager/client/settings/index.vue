<template>
  <k-card-aside class="page-settings">
    <template #aside>
      <plugin-select v-model="current"></plugin-select>
    </template>
    <plugin-settings :current="current"></plugin-settings>
  </k-card-aside>
</template>

<script setup lang="ts">

import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import PluginSelect from './select.vue'
import PluginSettings from './settings.vue'

function takeFirst(source: string | string[]) {
  return Array.isArray(source) ? source[0] : source
}

const route = useRoute()
const router = useRouter()

const current = computed<string>({
  get() {
    return takeFirst(route.query.name) || ''
  },
  set(name) {
    const query = name ? { name } : {}
    router.replace({ query })
  },
})

</script>

<style lang="scss">

</style>
