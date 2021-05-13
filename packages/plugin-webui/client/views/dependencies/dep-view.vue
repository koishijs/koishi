<template>
  <tr :class="{ local: current.isLocal }">
    <td class="package">
      <div>
        <a
          :href="'http://npmjs.com/package/' + remote.name"
          target="blank" rel="noopener noreferrer"
        >{{ remote.name.replace('koishi-plugin-', '') }}</a>
        <k-badge type="success" v-if="current.isOfficial">官方</k-badge>
        <k-badge type="warning" v-if="hasUpdate">可更新</k-badge>
      </div>
      <div class="description">
        {{ remote.description }}
      </div>
    </td>
    <td class="version">{{ current.version || '-' }}</td>
    <td class="latest">{{ remote.version }}</td>
    <td class="size">{{ !remote.distSize ? '-' : formatSize(remote.distSize) }}</td>
    <td class="score">{{ +remote.score.final.toFixed(2) }}</td>
    <td class="operation">
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

function formatSize(size: number) {
  if (size >= 1024000) {
    return Math.round(size / 1048576) + ' MB'
  } else {
    return Math.round(size / 1024) + ' KB'
  }
}

</script>

<style lang="scss">

.package {
  text-align: left;
  width: 50%;

  a {
    font-weight: bold;
    transition: 0.3s ease;
    color: rgba(244, 244, 245, 0.6);
  }

  a:hover {
    color: rgba(244, 244, 245);
  }

  .description {
    margin-top: 0.15rem;
    font-size: 0.9rem;
  }
}

tr.local {
  .latest, .size {
    color: rgba(244, 244, 245, .25);
  }
}

</style>
