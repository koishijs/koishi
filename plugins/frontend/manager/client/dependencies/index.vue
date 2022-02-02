<template>
  <nav>
    <k-button solid>下载全部</k-button>
  </nav>
  <k-card class="frameless">
    <table class="table-header">
      <colgroup>
        <col width="auto">
        <col width="160px">
        <col width="200px">
      </colgroup>
      <thead>
        <tr>
          <th>插件名称</th>
          <th>当前版本</th>
          <th>目标版本</th>
        </tr>
      </thead>
    </table>
    <el-scrollbar>
      <table class="table-body">
        <colgroup>
          <col width="auto">
          <col width="160px">
          <col width="200px">
        </colgroup>
        <tbody>
          <template v-for="name in names" :key="name">
            <tr>
              <td>{{ name }}</td>
              <td>{{ store.packages[name]?.version || '-' }}</td>
              <td>
                <el-select v-model="config.override[name]">
                  <el-option
                    v-for="({ version }, index) in store.market[name].versions"
                    :key="version" :label="version + (index ? '' : ' (最新)')" :value="version"
                  ></el-option>
                </el-select>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </el-scrollbar>
  </k-card>
</template>

<script lang="ts" setup>

import { computed } from 'vue'
import { store } from '~/client'
import { config } from '../utils'

const names = computed(() => {
  const data = Object.values(store.packages).filter(item => !item.workspace && store.market[item.name]).map(item => item.name)
  for (const key in config.override) {
    if (!data.includes(key) && store.market[key]) data.push(key)
  }
  return data.sort((a, b) => a > b ? 1 : -1)
})

</script>

<style lang="scss">

.route-versions nav {
  margin-top: 2rem;
  padding: 0 2rem;

  .right {
    float: right;
  }
}

.route-versions .k-card {
  position: absolute;
  bottom: 0;
  height: calc(100vh - 8rem);
  left: var(--aside-width);
  right: 0;

  .k-card-body {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  table {
    tr:first-child {
      border-top: none;
    }
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
