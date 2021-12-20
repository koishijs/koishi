<template>
  <k-card class="page-market frameless">
    <table class="table-header">
      <colgroup>
        <col width="auto">
        <col width="160px">
        <col width="120px">
        <col width="120px">
      </colgroup>
      <thead>
        <tr>
          <th>
            插件名称
            <k-hint placement="bottom">
              <b>为什么某个插件没有显示？</b>
              <br>1. 插件命名需满足规范，应该满足 koishi-plugin-xxx 或 @yyy/koishi-plugin-xxx 的格式。
              <br>2. 插件需要在 peerDependencies (推荐) 或 dependencies 字段中声明 koishi 为其依赖，并且指定能够匹配当前运行时的版本。
            </k-hint>
          </th>
          <th>最新版本</th>
          <th>综合评分</th>
          <th class="operation">操作</th>
        </tr>
      </thead>
    </table>
    <el-scrollbar>
      <table class="table-body">
        <colgroup>
          <col width="auto">
          <col width="160px">
          <col width="120px">
          <col width="120px">
        </colgroup>
        <tbody>
          <template v-for="data in store.market" :key="data.name">
            <package-view :data="data"/>
          </template>
        </tbody>
      </table>
    </el-scrollbar>
  </k-card>
</template>

<script setup lang="ts">

import PackageView from './package.vue'
import { store } from '~/client'

</script>

<style lang="scss">

.page-market {
  height: calc(100vh - 4rem);

  .k-card-body {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  table {
    tr:first-child {
      border-top: none;
    }

    tr:last-child {
      border-bottom: none;
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

  th {
    top: 0;
    position: sticky;
    z-index: 100;

    &::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      bottom: -1px;
      border-bottom: 1px solid var(--border);
      transition: border-color 0.3s ease;
    }
  }
}

</style>
