<template>
  <tr :class="{ workspace: local?.workspace }">
    <td class="package" :class="local ? local.id ? 'active' : 'local' : 'remote'">
      <div>
        <a
          :href="'http://npmjs.com/package/' + data.name"
          target="blank" rel="noopener noreferrer"
        >{{ data.shortname }}</a>
        <span class="current" v-if="local">@{{ local.version }}</span>
        <k-badge type="success" v-if="data.official">官方</k-badge>
        <k-badge type="default" v-if="local?.workspace">本地</k-badge>
        <k-badge type="warning" v-else-if="hasUpdate">可更新</k-badge>
      </div>
      <k-markdown class="description" :source="local?.description || data.description"></k-markdown>
    </td>
    <td class="latest">{{ data.version }}</td>
    <td class="size">{{ formatSize(data.size) }}</td>
    <td class="score">{{ data.score.toFixed(2) }}</td>
    <td class="operation">
      <span v-if="downloading">安装中</span>
      <k-button frameless v-else-if="!local || hasUpdate"
        @click="install(data)"
      >{{ local ? '更新' : '安装' }}</k-button>
      <k-button frameless v-if="local">配置</k-button>
    </td>
  </tr>
</template>

<script lang="ts" setup>

import type { MarketProvider } from '@koishijs/plugin-manager/src'
import { send, store } from '~/client'
import { computed, ref, watch } from 'vue'
import { KMarkdown } from '../components'
import { ElMessage } from 'element-plus'

const props = defineProps<{ data: MarketProvider.Data }>()

const local = computed(() => store.packages[props.data.name])

const hasUpdate = computed(() => {
  if (!local.value) return false
  const { workspace, version } = local.value
  return !workspace && version !== props.data.version
})

function formatSize(size: number) {
  if (size >= 1024000) {
    return Math.round(size / 1048576) + ' MB'
  } else {
    return Math.round(size / 1024) + ' KB'
  }
}

const downloading = ref(false)

watch(() => local, () => {
  downloading.value = false
})

async function install(data: MarketProvider.Data) {
  downloading.value = true
  try {
    const code = await send('install', `${data.name}@^${data.version}`)
    if (code === 0) {
      ElMessage.success('安装成功！')
    } else {
      ElMessage.error('安装失败！')
    }
  } catch (err) {
    ElMessage.error('安装超时！')
  } finally {
    downloading.value = false
  }
}

</script>

<style lang="scss">

.package {
  text-align: left;
  padding-left: 3rem;
  position: relative;

  .current {
    color: var(--fg2);
    transition: color 0.3s ease;
  }

  a {
    font-weight: bold;
    color: var(--fg1);
    transition: color 0.3s ease;
  }

  .description {
    margin-top: 0.15rem;
    font-size: 0.9rem;

    p {
      margin: 0;
      line-height: 1.5;
    }
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
    transition: background-color 0.3s ease;
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
