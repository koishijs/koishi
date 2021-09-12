<template>
  <k-card class="page-market" title="依赖管理">
    <table>
      <tr>
        <th>插件名称</th>
        <th>当前版本</th>
        <th>最新版本</th>
        <th>总体积</th>
        <th>综合评分</th>
        <th class="operation">操作</th>
      </tr>
      <package-view v-for="data in market" :data="data"/>
    </table>
  </k-card>
</template>

<script setup lang="ts">

import PackageView from './package.vue'
import { market } from '~/client'

</script>
