<template>
  <k-card class="page-market frameless">
    <el-scrollbar>
      <table>
        <tr>
          <th>
            插件名称
            <k-hint placement="bottom">
              <b>为什么我的插件没有显示？</b>
              <br>1. 插件命名需满足规范，应该满足 koishi-plugin-xxx 或 @yyy/koishi-plugin-xxx 的格式。
              <br>2. 插件的 package.json 中需要在 peerDependencies (推荐) 或 dependencies 中声明 koishi 为其依赖，并且指定能够匹配当前运行时的版本。
              <br>3. 插件的对应版本不能被弃用（deprecate）。
            </k-hint>
          </th>
          <th>最新版本</th>
          <th>总体积</th>
          <th>综合评分</th>
          <th class="operation">操作</th>
        </tr>
        <package-view v-for="data in market" :data="data"/>
      </table>
    </el-scrollbar>
  </k-card>
</template>

<script setup lang="ts">

import PackageView from './package.vue'
import { market } from '~/client'

</script>

<style lang="scss">

.page-market {
  height: calc(100vh - 4rem);

  .k-card-body {
    height: 100%;
  }

  table {
    tr:first-child {
      border-top: none;
    }

    tr:last-child {
      border-bottom: none;
    }
  }

  th {
    top: 0;
    position: sticky;
    background-color: var(--bg0);
    z-index: 100;

    &::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      bottom: -1px;
      border-bottom: 1px solid var(--border);
    }
  }
}

</style>
