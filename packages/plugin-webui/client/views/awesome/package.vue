<template>
  <tr :class="{ workspace: data.local?.isWorkspace }">
    <td class="package" :class="data.local ? data.local.isInstalled ? 'active' : 'local' : 'remote'">
      <div>
        <a
          :href="'http://npmjs.com/package/' + data.name"
          target="blank" rel="noopener noreferrer"
        >{{ data.name.replace('koishi-plugin-', '') }}</a>
        <k-badge type="success" v-if="data.official">官方</k-badge>
        <k-badge type="default" v-if="data.local?.isWorkspace">本地</k-badge>
        <k-badge type="warning" v-else-if="hasUpdate">可更新</k-badge>
      </div>
      <div class="description">
        {{ data.description }}
      </div>
    </td>
    <td class="version">{{ data.local ? data.local.version : '-' }}</td>
    <td class="latest">{{ data.version }}</td>
    <td class="size">{{ formatSize(data.size) }}</td>
    <td class="score">{{ +data.score.final.toFixed(2) }}</td>
    <td class="operation">
      <span v-if="downloading.includes(data.name)">安装中</span>
      <k-button frameless v-else-if="!data.local || hasUpdate"
        @click="toggle(data)"
      >{{ data.local ? '更新' : '安装' }}</k-button>
    </td>
  </tr>
</template>

<script lang="ts" setup>

import type { Awesome } from '~/server'
import { send, user } from '~/client'
import { defineProps, computed, ref } from 'vue'

const props = defineProps<{ data: Awesome.PackageData }>()

const hasUpdate = computed(() => {
  const { local, version } = props.data
  return local && !local.isWorkspace && local.version !== version
})

function formatSize(size: number) {
  if (size >= 1024000) {
    return Math.round(size / 1048576) + ' MB'
  } else {
    return Math.round(size / 1024) + ' KB'
  }
}

const downloading = ref([])

function toggle(data: Awesome.PackageData) {
  const { id, token } = user.value
  send('install', { name: `${data.name}@${data.version}`, id, token })
  downloading.value.push(data.name)
}

</script>

<style lang="scss">

@import '~/variables';

.package {
  text-align: left;
  padding-left: 3rem;
  position: relative;

  a {
    font-weight: bold;
    transition: 0.3s ease;
    color: rgba(244, 244, 245, 0.75);
  }

  a:hover {
    color: rgba(244, 244, 245);
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
    box-shadow: 1px 1px 2px #3333;
  }

  &.active::before {
    background: $success;
  }
  &.local::before {
    background: $warning;
  }
  &.remote::before {
    background: #eeeeee5f;
  }
}

.page-awesome td:not(.package) {
  min-width: 4rem;
}

tr.workspace {
  .latest, .size {
    color: rgba(244, 244, 245, .25);
  }
}

</style>
