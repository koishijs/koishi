<template>
  <tr>
    <td class="package-name">
      <a
        :href="'http://npmjs.com/package/' + remote.name"
        target="blank" rel="noopener noreferrer"
        :title="remote.description"
      >{{ remote.name }}</a>
      <k-badge type="success" v-if="current.isOfficial">官方</k-badge>
      <k-badge type="default" v-if="current.isLocal">本地</k-badge>
      <k-badge type="warning" v-else-if="current.version && remote.version !== current.version">可更新</k-badge>
    </td>
    <td>{{ current.version || '-' }}</td>
    <td>{{ current.isLocal ? '-' : remote.version }}</td>
    <td>{{ +remote.score.final.toFixed(2) }}</td>
  </tr>
</template>

<script lang="ts" setup>

import type { PackageMeta } from './manager'
import { registry } from '~/client'
import { defineProps, computed } from 'vue'

const props = defineProps<{ remote: PackageMeta }>()

const current = computed(() => {
  return registry.value.packages[props.remote.name] || {}
})

</script>
