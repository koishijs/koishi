<template>
  <k-card class="page-deps">
    <div class="controls">
      <el-checkbox v-model="config.showDepsOnly">只显示依赖的插件</el-checkbox>
      <span class="float-right" v-if="!overrideCount">当前没有变更的依赖</span>
      <template v-else>
        <k-button class="float-right" solid @click="install">更新依赖</k-button>
        <k-button class="float-right" solid type="error" @click="config.override = {}">放弃变更</k-button>
      </template>
    </div>
    <table>
      <colgroup>
        <col width="auto">
        <col width="30%">
        <col width="30%">
      </colgroup>
      <thead>
        <tr>
          <th>依赖名称</th>
          <th>当前版本</th>
          <th>目标版本</th>
        </tr>
      </thead>
    </table>
    <el-scrollbar>
      <table class="table-body">
        <colgroup>
          <col width="auto">
          <col width="30%">
          <col width="30%">
        </colgroup>
        <tbody>
          <package-view v-for="name in names" :key="name" :name="name"></package-view>
        </tbody>
      </table>
    </el-scrollbar>
  </k-card>
</template>

<script lang="ts" setup>

import { computed } from 'vue'
import { store, send } from '@koishijs/client'
import { config, overrideCount } from '../utils'
import { message, loading } from '@koishijs/client'
import PackageView from './package.vue'

const names = computed(() => {
  const data = config.showDepsOnly
    ? Object.keys(store.dependencies).filter(name => store.packages[name])
    : Object.values(store.packages).map(item => item.name).filter(Boolean)
  for (const key in config.override) {
    if (!data.includes(key) && store.market[key] && config.override[key]) data.push(key)
  }
  return data.sort((a, b) => a > b ? 1 : -1)
})

async function install() {
  const instance = loading({
    text: '正在更新依赖……',
  })
  try {
    const code = await send('install', config.override)
    if (code === 0) {
      message.success('安装成功！')
    } else {
      message.error('安装失败！')
    }
  } catch (err) {
    message.error('安装超时！')
  } finally {
    instance.close()
  }
}

</script>

<style lang="scss">

.page-deps {
  height: calc(100vh - 4rem);

  .k-card-body {
    padding: 0;
    margin: 0;
    height: calc(100vh - 4rem + 1px);
    display: flex;
    flex-direction: column;
  }

  .controls {
    height: 2rem;
    padding: 0 2rem;
    line-height: 2rem;
    margin: 1rem 0;
  }

  tbody {
    tr {
      transition: 0.3s ease;
    }

    tr:hover {
      background-color: var(--bg1);
    }

    tr:first-child {
      border-top: none;
    }
  }
}

</style>
