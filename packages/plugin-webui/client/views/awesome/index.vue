<template>
  <k-card class="page-awesome" title="依赖管理">
    <table>
      <tr>
        <th>模块名称</th>
        <th>当前版本</th>
        <th>最新版本</th>
        <th>总体积</th>
        <th>综合评分</th>
        <th class="operation">操作</th>
      </tr>
      <package-view v-for="data in awesome" :data="data"/>
    </table>
  </k-card>
</template>

<script setup lang="ts">

import PackageView from './package.vue'
import { awesome } from '~/client'

</script>
