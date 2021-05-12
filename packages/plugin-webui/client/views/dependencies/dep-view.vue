<template>
  <tr>
    <td class="package-name">
      <a
        :href="'http://npmjs.com/package/' + remote.name"
        target="blank" rel="noopener noreferrer"
        :title="remote.description"
      >{{ remote.name }}</a>
      <k-badge type="success" v-if="current.isOfficial">官方</k-badge>
      <k-badge type="warning" v-if="hasUpdate">可更新</k-badge>
    </td>
    <td>{{ current.version || '-' }}</td>
    <td>{{ current.isLocal ? '-' : remote.version }}</td>
    <td>{{ +remote.score.final.toFixed(2) }}</td>
    <td>
      <k-button frameless v-if="hasUpdate || !current.version"
      >{{ current.version ? '更新' : '下载' }}</k-button>
    </td>
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

const hasUpdate = computed(() => {
  return !current.value.isLocal && current.value.version && props.remote.version !== current.value.version
})

</script>

<style lang="scss">

.package-name {
  text-align: left;

  a {
    font-weight: bold;
    transition: 0.3s ease;
    color: rgba(244, 244, 245, 0.6);
  }
  a:hover {
    color: rgba(244, 244, 245);
  }
}

</style>
