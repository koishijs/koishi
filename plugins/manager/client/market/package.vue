<template>
  <tr :class="{ workspace: data.local?.workspace }">
    <td class="package" :class="data.local ? data.local.id ? 'active' : 'local' : 'remote'">
      <div>
        <a
          :href="'http://npmjs.com/package/' + data.name"
          target="blank" rel="noopener noreferrer"
        >{{ data.shortname }}</a>
        <span class="current" v-if="data.local">@{{ data.local.version }}</span>
        <k-badge type="success" v-if="data.official">官方</k-badge>
        <k-badge type="primary" v-if="data.keywords.includes('service:adapter')">适配器</k-badge>
        <k-badge type="primary" v-if="data.keywords.includes('service:database')">数据库</k-badge>
        <k-badge type="primary" v-if="data.keywords.includes('service:assets')">资源存储</k-badge>
        <k-badge type="primary" v-if="data.keywords.includes('service:cache')">缓存</k-badge>
        <k-badge type="default" v-if="data.local?.workspace">本地</k-badge>
        <k-badge type="warning" v-else-if="hasUpdate">可更新</k-badge>
      </div>
      <div class="description">
        {{ data.description }}
      </div>
    </td>
    <td class="latest">{{ data.version }}</td>
    <td class="size">{{ formatSize(data.size) }}</td>
    <td class="operation">
      <span v-if="downloading">安装中</span>
      <k-button frameless v-else-if="!data.local || hasUpdate"
        @click="toggle(data)"
      >{{ data.local ? '更新' : '安装' }}</k-button>
    </td>
  </tr>
</template>

<script lang="ts" setup>

import type { MarketProvider } from '@koishijs/plugin-manager/src'
import { send } from '~/client'
import { computed, ref, watch } from 'vue'

const props = defineProps<{ data: MarketProvider.Data }>()

const hasUpdate = computed(() => {
  const { local, version } = props.data
  return local && !local.workspace && local.version !== version
})

function formatSize(size: number) {
  if (size >= 1024000) {
    return Math.round(size / 1048576) + ' MB'
  } else {
    return Math.round(size / 1024) + ' KB'
  }
}

const downloading = ref(false)

watch(() => props.data.local, () => {
  downloading.value = false
}, { deep: true })

function toggle(data: MarketProvider.Data) {
  send('install', { name: `${data.name}@^${data.version}` })
  downloading.value = true
}

</script>

<style lang="scss">

@import '~/variables';

.package {
  text-align: left;
  padding-left: 3rem;
  position: relative;

  .current {
    color: var(--fg2);
  }

  a {
    font-weight: bold;
    transition: 0.3s ease;
    color: var(--fg1);
  }

  .description {
    margin-top: 0.15rem;
    font-size: 0.9rem;
  }

  &::before {
    content: "";
    position: absolute;
    border-radius: 100%;
    width: 0.5rem;
    height: 0.5rem;
    top: 50%;
    left: 1.25rem;
    transform: translateY(-50%);
    transition: 0.3s ease;
    box-shadow: 1px 1px 2px #3333;
  }

  &.active::before {
    background-color: var(--success);
  }
  &.local::before {
    background-color: var(--warning);
  }
  &.remote::before {
    background-color: var(--disabled);
  }
}

.page-market td:not(.package) {
  min-width: 4rem;
}

tr.workspace {
  .latest, .size {
    opacity: 0.25;
  }
}

</style>
