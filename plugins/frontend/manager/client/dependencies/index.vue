<template>
  <k-card class="page-deps">
    <div class="operation">
      <k-button solid @click="install" :disabled="!overrideCount">更新依赖</k-button>
    </div>
    <table class="table-body">
      <colgroup>
        <col width="auto">
        <col width="200px">
        <col width="200px">
      </colgroup>
      <thead>
        <tr>
          <th>插件名称</th>
          <th>当前版本</th>
          <th>目标版本</th>
        </tr>
      </thead>
      <tbody>
        <package-view v-for="name in names" :key="name" :name="name"></package-view>
      </tbody>
    </table>
    {{ config.override }}
  </k-card>
</template>

<script lang="ts" setup>

import { computed } from 'vue'
import { store, send } from '~/client'
import { config, state, overrideCount } from '../utils'
import { ElMessage } from 'element-plus'
import PackageView from './package.vue'

const names = computed(() => {
  const data = Object.values(store.packages).filter(item => !item.workspace && store.market[item.name]).map(item => item.name)
  for (const key in config.override) {
    if (!data.includes(key) && store.market[key] && config.override[key]) data.push(key)
  }
  return data.sort((a, b) => a > b ? 1 : -1)
})

async function install() {
  state.downloading = true
  try {
    const code = await send('install', config.override)
    if (code === 0) {
      ElMessage.success('安装成功！')
    } else {
      ElMessage.error('安装失败！')
    }
  } catch (err) {
    ElMessage.error('安装超时！')
  } finally {
    state.downloading = false
  }
}

</script>

<style lang="scss">

.page-deps {
  height: calc(100vh - 4rem);

  .k-card-body {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .operation {
    margin-bottom: 1.5rem;
  }

  tbody {
    tr {
      transition: 0.3s ease;
    }

    tr:hover {
      background-color: var(--bg1);
    }
  }
}

</style>
